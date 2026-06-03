# Create Task API — Kling Image Expansion

## Capability Overview

| Item | Details |
|------|---------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-GYX1bbkRQj4a.gateway.appmedo.com/v1/images/editing/expand` |
| Function | Submits an image expansion task that extends the original image outward in four directions. Returns a `task_id` for subsequent polling. |
| Billing | Discounted price ¥2.80 / request |

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | `string` | **Yes** | Reference image; accepts Base64 or URL format; formats .jpg/.jpeg/.png, ≤ 10 MB, minimum 300 px, aspect ratio 1:2.5–2.5:1; Base64 uses raw encoding without the `data:image/...;base64,` prefix |
| `up_expansion_ratio` | `float` | **Yes** | Upward expansion ratio (multiple of original image height), range [0, 2] |
| `down_expansion_ratio` | `float` | **Yes** | Downward expansion ratio (multiple of original image height), range [0, 2] |
| `left_expansion_ratio` | `float` | **Yes** | Leftward expansion ratio (multiple of original image width), range [0, 2] |
| `right_expansion_ratio` | `float` | **Yes** | Rightward expansion ratio (multiple of original image width), range [0, 2] |
| `prompt` | `string` | No | Positive text prompt, up to 2500 characters |
| `n` | `integer` | No | Number of images to generate, range [1, 9], default 1 |
| `watermark_info` | `object` | No | Watermark settings: `{"enabled": boolean}` |
| `callback_url` | `string` | No | Webhook URL for task status callbacks |
| `external_task_id` | `string` | No | Custom task ID (must be unique per user) |

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; 0 = success, non-zero = failure |
| `message` | `string` | Error message (present on failure) |
| `request_id` | `string` | Request trace ID |
| `data.task_id` | `string` | System-generated task ID used for subsequent polling |
| `data.task_status` | `string` | Task status: `submitted` \| `processing` \| `succeed` \| `failed` |
| `data.task_info.external_task_id` | `string?` | Custom task ID passed at creation time |
| `data.created_at` | `number` | Creation timestamp (milliseconds) |
| `data.updated_at` | `number` | Last updated timestamp (milliseconds) |

## Generation-Phase Usage (Direct Agent Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function createExpandTask(params: {
  image: string;
  up_expansion_ratio: number;
  down_expansion_ratio: number;
  left_expansion_ratio: number;
  right_expansion_ratio: number;
  prompt?: string;
  n?: number;
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}): Promise<{ task_id: string; task_status: string }> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-GYX1bbkRQj4a.gateway.appmedo.com/v1/images/editing/expand",
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
// edge-functions/kling-expand-create.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let image: string;
  let up_expansion_ratio: number;
  let down_expansion_ratio: number;
  let left_expansion_ratio: number;
  let right_expansion_ratio: number;
  let restParams: Record<string, unknown>;

  try {
    const body = await req.json();
    image = body.image;
    up_expansion_ratio = body.up_expansion_ratio;
    down_expansion_ratio = body.down_expansion_ratio;
    left_expansion_ratio = body.left_expansion_ratio;
    right_expansion_ratio = body.right_expansion_ratio;

    if (!image) throw new Error("Missing image");
    if (up_expansion_ratio === undefined) throw new Error("Missing up_expansion_ratio");
    if (down_expansion_ratio === undefined) throw new Error("Missing down_expansion_ratio");
    if (left_expansion_ratio === undefined) throw new Error("Missing left_expansion_ratio");
    if (right_expansion_ratio === undefined) throw new Error("Missing right_expansion_ratio");

    const { image: _img, up_expansion_ratio: _u, down_expansion_ratio: _d,
            left_expansion_ratio: _l, right_expansion_ratio: _r, ...rest } = body;
    restParams = rest;
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
    "https://app-b0t9jb6nl2pt-api-GYX1bbkRQj4a.gateway.appmedo.com/v1/images/editing/expand",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        image,
        up_expansion_ratio,
        down_expansion_ratio,
        left_expansion_ratio,
        right_expansion_ratio,
        ...restParams,
      }),
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

> **Note**: The create task endpoint only returns a `task_id` — it does not include image URLs. Image URLs are retrieved after task completion by the `kling-expand-query` Edge Function, which also transfers them to Supabase Storage (see `query-task-api.md`).
