# Query Task API — Kling Image Generation

## Overview

| Item | Details |
|------|---------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-M9v0wzOkZXGY.gateway.appmedo.com/v1/images/generations/{task_id}` |
| Function | Query the status and result of a single image generation task. Returns image URLs once the task completes. |
| Billing | Free (not billed) |

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | `string` | **Yes** | Task ID returned by the system when the task was created (placed in the URL path) |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_task_id` | `string` | No | Custom task ID supplied at creation time; can be used instead of `task_id` to query the task |

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; 0 = success, non-0 = failure |
| `message` | `string` | Error message (present when failed) |
| `request_id` | `string` | Request trace ID |
| `data.task_id` | `string` | Task ID |
| `data.task_status` | `string` | Task status: `submitted` \| `processing` \| `succeed` \| `failed` |
| `data.task_status_msg` | `string?` | Failure reason (e.g. content moderation rejection) |
| `data.final_unit_deduction` | `string?` | Resource units consumed by this task |
| `data.watermark_info` | `object?` | Watermark settings: `{"enabled": boolean}` |
| `data.task_info.external_task_id` | `string?` | Custom task ID supplied at creation time |
| `data.created_at` | `number` | Creation timestamp (milliseconds) |
| `data.updated_at` | `number` | Last update timestamp (milliseconds) |
| `data.task_result.images` | `array?` | List of generated images (only present when status is `succeed`) |
| `data.task_result.images[].index` | `number` | Image index (0-based) |
| `data.task_result.images[].url` | `string` | Image CDN URL (expires after 30 days) |
| `data.task_result.images[].watermark_url` | `string?` | Watermarked image URL |

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function queryImageTask(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: {
    images: Array<{ index: number; url: string; watermark_url?: string }>;
  };
}> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-M9v0wzOkZXGY.gateway.appmedo.com/v1/images/generations/${taskId}`,
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

**Generation-Time File Download (required):**

After the task succeeds, `task_result.images[].url` is a temporary CDN link (expires after 30 days). **You must immediately use the Bash tool to download the files locally.**

```bash
# Download a single image
curl -L -o ./generated_image_0.jpg "<task_result.images[0].url>"

# Batch download (when n > 1)
for i in 0 1 2; do
  curl -L -o "./generated_image_${i}.jpg" "<task_result.images[$i].url>"
done
```

## Post-Generation Usage (Edge Function)

This Edge Function receives a `task_id`, queries the task status, and — if the task has completed — transfers all images to Supabase Storage before returning persistent URLs.

```typescript
// edge-functions/kling-query-task.ts
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
  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
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
    `https://app-b0t9jb6nl2pt-api-M9v0wzOkZXGY.gateway.appmedo.com/v1/images/generations/${taskId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

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

  // --- Transfer images to Supabase Storage if task succeeded ---
  if (
    responseData.code === 0 &&
    responseData.data?.task_status === "succeed" &&
    responseData.data?.task_result?.images
  ) {
    const BUCKET = "generated-media";
    const images = responseData.data.task_result.images as Array<{
      index: number;
      url: string;
      watermark_url?: string;
    }>;

    const transferredImages = await Promise.all(
      images.map(async (img) => {
        const transfer = await streamImageToStorage(img.url, BUCKET);
        return {
          ...img,
          url: transfer.success ? transfer.publicUrl : img.url,
          // Also transfer watermark_url if present
          watermark_url: img.watermark_url
            ? await streamImageToStorage(img.watermark_url, BUCKET).then((r) =>
                r.success ? r.publicUrl : img.watermark_url
              )
            : undefined,
        };
      })
    );

    responseData.data.task_result.images = transferredImages;
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

**Frontend Polling Example:**

```typescript
async function waitForKlingTask(taskId: string, maxAttempts = 60): Promise<{
  images: Array<{ index: number; url: string; watermark_url?: string }>;
}> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 7000)); // 7 second interval

    const { data, error } = await supabase.functions.invoke("kling-query-task", {
      body: { task_id: taskId },
    });
    if (error) throw error;
    if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);

    const taskData = data.data;
    if (taskData.task_status === "succeed") return taskData.task_result;
    if (taskData.task_status === "failed")
      throw new Error(`Task failed: ${taskData.task_status_msg}`);
    // submitted / processing → keep polling
  }
  throw new Error(`Task ${taskId} timed out (approx. 7 minutes)`);
}
```
