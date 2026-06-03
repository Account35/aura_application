# Create Task API — Kling Image Generation

## Overview

| Item | Details |
|------|---------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-DY8MnRlwkXKa.gateway.appmedo.com/v1/images/generations` |
| Function | Submit an image generation task; supports text-to-image and image-to-image. Returns a `task_id` for subsequent polling. |
| Billing | Discounted price ¥0.35 / call |

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model_name` | `string` | No | Model version; default `kling-v1` |
| `prompt` | `string` | **Yes** | Positive text prompt; max 2500 characters |
| `negative_prompt` | `string` | No | Negative prompt; max 2500 characters (not supported in image-to-image mode) |
| `image` | `string` | No | Reference image URL or Base64 (jpg/jpeg/png, ≤10 MB, shortest side ≥300 px, aspect ratio 1:2.5–2.5:1) |
| `image_fidelity` | `float` | No | Face reference strength [0, 1]; default 0.5 (supported by kling-v1) |
| `element_list` | `array` | No | Element library ID list, format `[{"element_id": <long>}]`; max 10 entries (including reference image) |
| `resolution` | `string` | No | Output resolution; currently only `1k`; default `1k` |
| `n` | `int` | No | Number of images to generate [1, 9]; default 1 |
| `aspect_ratio` | `string` | No | Aspect ratio: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`; default `16:9` |
| `watermark_info` | `object` | No | Watermark settings: `{"enabled": boolean}` |
| `callback_url` | `string` | No | Webhook URL for task status callbacks |
| `external_task_id` | `string` | No | Custom task ID (must be unique per user) |

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; 0 = success, non-0 = failure |
| `message` | `string` | Error message (present when failed) |
| `request_id` | `string` | Request trace ID |
| `data.task_id` | `string` | System-generated task ID for subsequent polling |
| `data.task_status` | `string` | Task status: `submitted` \| `processing` \| `succeed` \| `failed` |
| `data.task_info.external_task_id` | `string?` | Custom task ID supplied at creation time |
| `data.created_at` | `number` | Creation timestamp (milliseconds) |
| `data.updated_at` | `number` | Last update timestamp (milliseconds) |

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function createImageTask(params: {
  prompt: string;
  model_name?: string;
  negative_prompt?: string;
  image?: string;
  image_fidelity?: number;
  element_list?: Array<{ element_id: number }>;
  resolution?: string;
  n?: number;
  aspect_ratio?: string;
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}): Promise<{ task_id: string; task_status: string }> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-DY8MnRlwkXKa.gateway.appmedo.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data;
}
```

## Post-Generation Usage (Edge Function)

```typescript
// edge-functions/kling-create-task.ts
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
  let prompt: string;
  let restParams: Record<string, unknown>;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    const { prompt: _p, ...rest } = body;
    restParams = rest;
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
    "https://app-b0t9jb6nl2pt-api-DY8MnRlwkXKa.gateway.appmedo.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt, ...restParams }),
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

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

> **Note**: The create task endpoint returns only a `task_id` — it does not include image URLs. Image URLs are retrieved after the task completes via the `kling-query-task` Edge Function, which also transfers them to Supabase Storage (see `query-task-api.md`).
