# Query Task API — Kling Image Expansion

Covers two endpoints:
- **Single task query** — retrieve a specific task by task ID
- **Task list query** — retrieve a paginated list of all expansion tasks

---

## Single Task Query

### Capability Overview

| Item | Details |
|------|---------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-AalZkkAG5w7L.gateway.appmedo.com/v1/images/editing/expand/{task_id}` |
| Function | Queries the status and result of a single image expansion task, including generated image URLs |
| Billing | Free |

### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `task_id` | `string` | Path | **Yes** | System-generated task ID, or the `external_task_id` provided at creation time |
| `external_task_id` | `string` | Query | No | Custom task ID provided when the task was created |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; 0 = success, non-zero = failure |
| `message` | `string` | Error message (present on failure) |
| `request_id` | `string` | Request trace ID |
| `data.task_id` | `string` | Task ID |
| `data.task_status` | `string` | Task status: `submitted` \| `processing` \| `succeed` \| `failed` |
| `data.task_status_msg` | `string?` | Status description (contains failure reason on failure) |
| `data.task_info.external_task_id` | `string?` | Custom task ID |
| `data.final_unit_deduction` | `string?` | Final per-unit deduction for the task |
| `data.watermark_info.enabled` | `boolean?` | Whether watermark is enabled |
| `data.task_result.images` | `array` | List of generated images |
| `data.task_result.images[].index` | `number` | Image index |
| `data.task_result.images[].url` | `string` | Image CDN URL (valid for 30 days) |
| `data.created_at` | `number` | Creation timestamp (milliseconds) |
| `data.updated_at` | `number` | Last updated timestamp (milliseconds) |

---

## Task List Query

### Capability Overview

| Item | Details |
|------|---------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-pLVzAAkGZwDL.gateway.appmedo.com/v1/images/editing/expand` |
| Function | Retrieves a paginated list of all image expansion tasks |
| Billing | Free |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageNum` | `integer` | No | Page number, range [1, 1000], default 1 |
| `pageSize` | `integer` | No | Items per page, range [1, 500], default 30 |

### Response Fields

Same as the single task query, but `data` is an array where each element contains the full task information. Additional field:

| Field Path | Type | Description |
|------------|------|-------------|
| `data[].task_result.images[].watermark_url` | `string?` | Watermarked image download URL (hotlink-protected format) |

---

## Generation-Phase Usage (Direct Agent Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

// Query a single task
async function queryExpandTask(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  watermark_info?: { enabled: boolean };
  task_result?: { images: Array<{ index: number; url: string }> };
  created_at: number;
  updated_at: number;
}> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-AalZkkAG5w7L.gateway.appmedo.com/v1/images/editing/expand/${taskId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data;
}

// Query task list
async function listExpandTasks(pageNum = 1, pageSize = 30): Promise<Array<{
  task_id: string;
  task_status: string;
  task_result?: { images: Array<{ index: number; url: string; watermark_url?: string }> };
}>> {
  const url = new URL(
    "https://app-b0t9jb6nl2pt-api-pLVzAAkGZwDL.gateway.appmedo.com/v1/images/editing/expand"
  );
  url.searchParams.set("pageNum", String(pageNum));
  url.searchParams.set("pageSize", String(pageSize));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data;
}
```

---

## Post-Generation Usage (Edge Function)

The query Edge Function also handles transferring image URLs to Supabase Storage so that ephemeral CDN links are replaced with persistent public URLs before they reach the frontend.

```typescript
// edge-functions/kling-expand-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote image directly into Supabase Storage.
 */
async function streamImageToStorage(
  imageUrl: string,
  bucketName: string
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    new URL(imageUrl);
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let task_id: string;
  try {
    const body = await req.json();
    task_id = body.task_id;
    if (!task_id) throw new Error("Missing task_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-AalZkkAG5w7L.gateway.appmedo.com/v1/images/editing/expand/${task_id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // Forward quota/balance errors verbatim
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const responseJson = await upstream.json();

  // --- Transfer image URLs to Supabase Storage when task succeeds ---
  if (
    responseJson.code === 0 &&
    responseJson.data?.task_status === "succeed" &&
    Array.isArray(responseJson.data?.task_result?.images)
  ) {
    const transferredImages = await Promise.all(
      responseJson.data.task_result.images.map(
        async (img: { index: number; url: string }) => {
          const transfer = await streamImageToStorage(img.url, "generated-media");
          return {
            ...img,
            url: transfer.success ? transfer.publicUrl : img.url,
          };
        }
      )
    );
    responseJson.data.task_result.images = transferredImages;
  }

  return new Response(JSON.stringify(responseJson), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

> **Note**: When the task status is `succeed`, the Edge Function automatically transfers the upstream CDN temporary links to Supabase Storage and replaces `images[].url` with persistent public URLs. The frontend does not need to handle image transfer separately.
