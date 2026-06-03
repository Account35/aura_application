# Query Task — Omni-Image (Single)

**API ID:** `api-n9QVxo8blgrL`
**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-n9QVxo8blgrL.gateway.appmedo.com/v1/images/omni-image/{task_id}`

## Overview

Query the status and result of a single Omni-Image generation task. Poll this endpoint until `task_status` is `succeed` or `failed`. On success, retrieve image URLs from `task_result.images` (single mode) or `task_result.series_images` (series mode).

**Task status values:**
- `submitted` — task has been submitted
- `processing` — task is being processed
- `succeed` — task completed successfully
- `failed` — task failed

> This endpoint is not billed and may be polled freely. Recommended polling interval: 5–10 seconds.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | `string` (path parameter) | Yes | System-generated task ID (from `data.task_id` in the submit response) |
| `external_task_id` | `string` (query parameter) | No | Custom task ID (the `external_task_id` passed at submission time) |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code, 0 indicates success |
| `message` | `string` | Status message |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID |
| `data.task_status` | `string` | Task status: `submitted`, `processing`, `succeed`, `failed` |
| `data.task_status_msg` | `string?` | Task status description (contains error info when failed) |
| `data.task_info.external_task_id` | `string?` | Custom task ID |
| `data.task_result.result_type` | `string` | Result type: `single` or `series` |
| `data.task_result.images` | `array?` | List of result images in single mode |
| `data.task_result.images[].index` | `number` | Image index |
| `data.task_result.images[].url` | `string` | Image URL (valid for 30 days) |
| `data.task_result.images[].watermark_url` | `string?` | Watermarked image URL |
| `data.task_result.series_images` | `array?` | List of result images in series mode (same field structure as images) |
| `data.watermark_info.enabled` | `boolean` | Whether watermark is enabled |
| `data.final_unit_deduction` | `string?` | Final deduction unit count |
| `data.created_at` | `number` | Task creation time (millisecond timestamp) |
| `data.updated_at` | `number` | Task update time (millisecond timestamp) |

### Response Example (Success)

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "abc123xyz",
    "task_status": "succeed",
    "task_status_msg": "",
    "task_info": { "external_task_id": "my-task-001" },
    "task_result": {
      "result_type": "single",
      "images": [
        { "index": 0, "url": "https://cdn.example.com/image.jpg", "watermark_url": "https://cdn.example.com/image_wm.jpg" }
      ],
      "series_images": []
    },
    "watermark_info": { "enabled": false },
    "final_unit_deduction": "1",
    "created_at": 1722769557708,
    "updated_at": 1722769589123
  }
}
```

---

## Generation-time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed key injected by the platform

interface ImageItem {
  index: number;
  url: string;
  watermark_url?: string;
}

interface QueryResult {
  task_id: string;
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_result?: {
    result_type: "single" | "series";
    images: ImageItem[];
    series_images: ImageItem[];
  };
  final_unit_deduction?: string;
}

async function queryOmniImageTask(taskId: string): Promise<QueryResult> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-n9QVxo8blgrL.gateway.appmedo.com/v1/images/omni-image/${taskId}`,
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
```

**Generation-time File Download (Required):**

The URLs returned by the generation API are temporary CDN links that expire after 30 days. During generation time (Agent direct call scenario), after obtaining a URL, **you must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o <local-path>.jpg "<generated image URL>"
```

**Complete generation-time workflow (including download step):**

1. Call `submitOmniImageTask()` to submit the task and obtain a `task_id`
2. Repeatedly call `queryOmniImageTask(taskId)` at 7-second intervals until `task_status` is `succeed` or `failed`
3. Retrieve the URL list from `task_result.images` (single) or `task_result.series_images` (series)
4. For each image, use the Bash tool to run `curl -L -o <local-path> "<url>"` to download it locally
5. Notify the user of the file paths where images have been saved

> **Note**: Upstream CDN links expire after 30 days. Download immediately after obtaining the URL — do not delay.

---

## Post-generation Usage (In-app via Edge Function)

### Edge Function — `edge-functions/kling-omni-image-query.ts`

```typescript
// edge-functions/kling-omni-image-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote image directly into Supabase Storage for persistence.
 * Call this when task_status === "succeed" to replace ephemeral CDN URLs.
 */
async function streamImageToStorage(
  imageUrl: string,
  bucketName: string
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
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
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Accept task_id via query param (GET) or request body (POST)
  let taskId: string | null = null;
  let transferToStorage = false;
  let bucketName = "generated-media";

  if (req.method === "GET") {
    const url = new URL(req.url);
    taskId = url.searchParams.get("task_id");
  } else {
    try {
      const body = await req.json();
      taskId = body.task_id;
      transferToStorage = body.transfer_to_storage ?? false;
      bucketName = body.bucket_name ?? "generated-media";
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!taskId) {
    return new Response(JSON.stringify({ error: "Missing required field: task_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-n9QVxo8blgrL.gateway.appmedo.com/v1/images/omni-image/${taskId}`,
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

  const responseData = await upstream.json();

  // --- Transfer images to Supabase Storage when task succeeds ---
  if (
    transferToStorage &&
    responseData.code === 0 &&
    responseData.data?.task_status === "succeed"
  ) {
    const taskResult = responseData.data.task_result;
    const imageArrays = [
      { key: "images", items: taskResult?.images ?? [] },
      { key: "series_images", items: taskResult?.series_images ?? [] },
    ];

    for (const { key, items } of imageArrays) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.url) {
          const transfer = await streamImageToStorage(item.url, bucketName);
          if (transfer.success) {
            responseData.data.task_result[key][i].url = transfer.publicUrl;
          }
          // watermark_url: optionally transfer as well
        }
      }
    }
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend → Edge Function (Query Task + Auto Transfer)

**Recommended approach (when supabase client is available):**

```typescript
async function queryOmniImageTask(taskId: string, transferToStorage = false) {
  const { data, error } = await supabase.functions.invoke("kling-omni-image-query", {
    body: { task_id: taskId, transfer_to_storage: transferToStorage, bucket_name: "generated-media" },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data;
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function queryOmniImageTask(taskId: string, transferToStorage = false) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-omni-image-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        transfer_to_storage: transferToStorage,
        bucket_name: "generated-media",
      }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const json = await res.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data;
}
```

**Complete frontend polling workflow:**

```typescript
async function pollUntilDone(taskId: string): Promise<void> {
  const POLL_INTERVAL_MS = 7000;
  const MAX_ATTEMPTS = 80; // ~9 minutes

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    // Pass transfer_to_storage=true on final query to auto-save images
    const result = await queryOmniImageTask(taskId, false);

    if (result.task_status === "succeed") {
      // Final query with storage transfer enabled
      const finalResult = await queryOmniImageTask(taskId, true);
      const images =
        finalResult.task_result?.images?.length > 0
          ? finalResult.task_result.images
          : finalResult.task_result?.series_images ?? [];
      console.log("Generated images:", images.map((img: { url: string }) => img.url));
      return;
    }

    if (result.task_status === "failed") {
      throw new Error(`Image generation failed: ${result.task_status_msg}`);
    }
    // submitted / processing → keep polling
  }

  throw new Error(`Task ${taskId} timed out`);
}
```
