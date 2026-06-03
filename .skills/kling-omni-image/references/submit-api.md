# Submit Task — Omni-Image Create

**API ID:** `api-2Y00Vzbe0MBY`
**Endpoint:** `POST https://app-b0t9jb6nl2pt-api-2Y00Vzbe0MBY.gateway.appmedo.com/v1/images/omni-image`

## Overview

Submit an Omni-Image image generation task. Supports text prompts, reference images (URL or Base64), and element library resources. Configurable resolution (1k/2k), aspect ratio, output count, and single/series mode. Returns a `task_id` upon successful submission; use the query endpoint to poll for task status.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | Text prompt, maximum 2500 characters; supports `<<<>>>` format for referencing images or elements |
| `model_name` | `string` | No | Model name, default `kling-image-o1`. Options: `kling-image-o1`, `kling-v3-omni` |
| `image_list` | `array` | No | List of reference images supporting URL or Base64; each ≤10MB, minimum 300px, aspect ratio 1:2.5~2.5:1 |
| `element_list` | `array` | No | List of element library references using element IDs |
| `resolution` | `string` | No | Image resolution, default `1k`. Options: `1k`, `2k` |
| `result_type` | `string` | No | Output type, default `single`. Options: `single`, `series` |
| `n` | `integer` | No | Number of images to generate, range [1, 9], default 1 |
| `series_amount` | `integer` | **Conditionally required** | Number of images in series mode, **required and only allowed when `result_type=series`**, range [2, 9], default 4 |
| `aspect_ratio` | `string` | No | Image aspect ratio, default `9:16`. Options: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`, `auto` |
| `watermark_info` | `object` | No | Watermark configuration with an `enabled` boolean field |
| `callback_url` | `string` | No | Callback URL for task status updates |
| `external_task_id` | `string` | No | Custom task ID for tracking |

> **Strict constraints:**
> - `result_type = single`: `series_amount` field **must NOT appear** in the request body
> - `result_type = series`: `series_amount` **must be provided**, range [2, 9]
> - Base64 images must be raw encoded strings, **without** prefixes like `data:image/jpeg;base64,`

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code, 0 indicates success |
| `message` | `string` | Status message |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | System-generated task ID for subsequent queries |
| `data.task_info.external_task_id` | `string?` | Custom task ID (if provided) |
| `data.task_status` | `string` | Task status (typically `submitted` right after submission) |
| `data.created_at` | `number` | Task creation time (millisecond timestamp) |
| `data.updated_at` | `number` | Task update time (millisecond timestamp) |

### Response Example

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "abc123xyz",
    "task_info": {
      "external_task_id": "my-task-001"
    },
    "task_status": "submitted",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

---

## Generation-time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed key injected by the platform

interface SubmitParams {
  prompt: string;
  model_name?: "kling-image-o1" | "kling-v3-omni";
  image_list?: Array<{ image: string }>; // URL or raw Base64 (no prefix)
  element_list?: Array<{ element_id: number }>;
  resolution?: "1k" | "2k";
  result_type?: "single" | "series";
  n?: number; // [1, 9]
  series_amount?: number; // [2, 9], only pass when result_type=series
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9" | "auto";
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

interface SubmitResult {
  task_id: string;
  task_status: string;
  created_at: number;
}

async function submitOmniImageTask(params: SubmitParams): Promise<SubmitResult> {
  // Enforce series_amount constraint
  if (params.result_type === "single" && "series_amount" in params) {
    throw new Error("series_amount must NOT be provided when result_type is 'single'");
  }
  if (params.result_type === "series" && !params.series_amount) {
    throw new Error("series_amount is required when result_type is 'series'");
  }

  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-2Y00Vzbe0MBY.gateway.appmedo.com/v1/images/omni-image",
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

---

## Post-generation Usage (In-app via Edge Function)

### Edge Function — `edge-functions/kling-omni-image-submit.ts`

```typescript
// edge-functions/kling-omni-image-submit.ts
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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body.prompt) throw new Error("Missing required field: prompt");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Enforce series_amount constraint server-side
  if (body.result_type === "single" && "series_amount" in body) {
    return new Response(
      JSON.stringify({ error: "series_amount must not be provided when result_type is 'single'" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
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
    "https://app-b0t9jb6nl2pt-api-2Y00Vzbe0MBY.gateway.appmedo.com/v1/images/omni-image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
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

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend → Edge Function (Submit Task)

**Recommended approach (when supabase client is available):**

```typescript
async function submitOmniImageTask(params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("kling-omni-image-submit", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data; // { task_id, task_status, created_at }
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function submitOmniImageTask(params: Record<string, unknown>) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-omni-image-submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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

  return json.data; // { task_id, task_status, created_at }
}
```
