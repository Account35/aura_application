# Submit Omni-Video Task

## API Specification

| Property | Value |
|----------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-k93RvqRrRZba.gateway.appmedo.com/v1/videos/omni-video` |
| HTTP Method | `POST` |
| Request Header Content-Type | `application/json` |
| Authorization Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Billing | Original price ¥160.80 / request, discounted price ¥134.00 / request (this endpoint is billed) |

---

## Parameter Reference

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model_name` | `string` | No | Model name; default `kling-v3-omni`; allowed value: `kling-v3-omni` |
| `multi_shot` | `boolean` | No | Whether to generate a multi-shot video; default `false` |
| `shot_type` | `string` | No | Storyboard type; enum value: `customize`; required when `multi_shot` is `true` |
| `prompt` | `string` | No | Text prompt; max 2500 characters; supports template format (e.g. `<<<image_1>>>`); required when `multi_shot` is `false` |
| `multi_prompt` | `array` | No | Array of multi-shot information containing `index`, `prompt`, and `duration` fields; max 6 shots; required when `multi_shot` is `true` |
| `image_list` | `array` | No | Reference image list; supports Base64 or URL; formats: jpg/jpeg/png; ≤10 MB; minimum 300 px |
| `element_list` | `array` | No | Reference element list based on element library IDs |
| `video_list` | `array` | No | Reference video list; supports MP4/MOV; ≥3 seconds; ≤200 MB; resolution 720–2160 px |
| `sound` | `string` | No | Whether to generate audio; enum value: `on`; default `on` |
| `mode` | `string` | No | Generation mode; enum value: `pro`; default `pro` |
| `aspect_ratio` | `string` | No | Video aspect ratio; enum values: `16:9`, `9:16`, `1:1` |
| `duration` | `string` | No | Video duration in seconds; enum values: `3`–`15`; default `5` |
| `watermark_info` | `object` | No | Watermark configuration containing an `enabled` boolean field |
| `callback_url` | `string` | No | Callback notification URL invoked when the task completes |
| `external_task_id` | `string` | No | User-defined task ID |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; `0` indicates success |
| `message` | `string` | Status description |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID used for subsequent query polling |
| `data.task_status` | `string` | Initial status; typically `submitted` |
| `data.task_info.external_task_id` | `string?` | User-defined task ID (if provided) |
| `data.created_at` | `number` | Task creation time (Unix timestamp in milliseconds) |
| `data.updated_at` | `number` | Task last-updated time (Unix timestamp in milliseconds) |

### Response Example

```json
{
  "code": 0,
  "message": "Success",
  "request_id": "req_abc123",
  "data": {
    "task_id": "task_xyz789",
    "task_status": "submitted",
    "task_info": {
      "external_task_id": "my_task_001"
    },
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

---

## Generation-time Usage (Direct Agent Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — key injected by platform

interface OmniVideoSubmitOptions {
  model_name?: string;
  multi_shot?: boolean;
  shot_type?: string;
  prompt?: string;
  multi_prompt?: Array<{ index: number; prompt: string; duration?: string }>;
  image_list?: Array<{ image_url?: string; image_base64?: string }>;
  element_list?: Array<{ element_id: string }>;
  video_list?: Array<{ video_url: string }>;
  sound?: string;
  mode?: string;
  aspect_ratio?: string;
  duration?: string;
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

async function submitOmniVideo(options: OmniVideoSubmitOptions): Promise<{ taskId: string }> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-k93RvqRrRZba.gateway.appmedo.com/v1/videos/omni-video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(options),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return { taskId: json.data.task_id };
}
```

---

## Post-generation Usage (In-app via Edge Function)

### Edge Function Code

```typescript
// edge-functions/kling-omni-video-submit.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let requestBody: Record<string, unknown>;
  try {
    requestBody = await req.json();
    // Validate: single-shot requires prompt; multi-shot requires multi_prompt
    if (!requestBody.multi_shot && !requestBody.prompt) {
      throw new Error("Missing prompt (required for single-shot mode)");
    }
    if (requestBody.multi_shot && !requestBody.multi_prompt) {
      throw new Error("Missing multi_prompt (required for multi-shot mode)");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Invalid request body" }), {
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
    "https://app-b0t9jb6nl2pt-api-k93RvqRrRZba.gateway.appmedo.com/v1/videos/omni-video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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

### Frontend Call — Edge Function (Submit Task)

**Recommended approach (when supabase client is available):**

```typescript
interface OmniVideoSubmitOptions {
  prompt?: string;
  multi_shot?: boolean;
  shot_type?: string;
  multi_prompt?: Array<{ index: number; prompt: string; duration?: string }>;
  image_list?: Array<{ image_url?: string; image_base64?: string }>;
  video_list?: Array<{ video_url: string }>;
  aspect_ratio?: string;
  duration?: string;
  mode?: string;
  sound?: string;
  external_task_id?: string;
}

async function submitOmniVideo(options: OmniVideoSubmitOptions) {
  const { data, error } = await supabase.functions.invoke("kling-omni-video-submit", {
    body: options,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data as { task_id: string; task_status: string };
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function submitOmniVideo(options: OmniVideoSubmitOptions) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-omni-video-submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
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
  return json.data as { task_id: string; task_status: string };
}
```

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in the Edge Function; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance); these error bodies must be forwarded verbatim to the frontend.
- **Billing**: Each task submission costs **¥134.00** (discounted; original price ¥160.80). After submission, always poll the query endpoint to avoid duplicate submissions that waste quota.
- **Single-shot vs. multi-shot**: When `multi_shot: false` (default), `prompt` is required; when `multi_shot: true`, both `shot_type` and `multi_prompt` (max 6 shots) are required.
- **Template prompts**: `prompt` supports `<<<image_1>>>` format to reference images in `image_list` for precise control.
- **Async nature**: This endpoint only returns a `task_id`; video content must be retrieved by polling the query endpoint (`references/query-api.md`).
