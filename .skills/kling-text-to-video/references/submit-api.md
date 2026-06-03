# Submit Text-to-Video Task

## API Specification

| Property | Value |
|----------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-qYGWo8XA7JVY.gateway.appmedo.com/v1/videos/text2video` |
| HTTP Method | `POST` |
| Request Header Content-Type | `application/json` |
| Auth Header | `X-Gateway-Authorization: Bearer <AUTH_VALUE>` |
| Billing | Original price ¥45.50 / request, discounted price ¥35.00 / request (this endpoint is billed) |

---

## Parameters

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | Video generation prompt |
| `model_name` | `string` | No | Model name: `kling-v1`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1-master`, `kling-v2-5-turbo`; default recommended: `kling-v2-master` |
| `negative_prompt` | `string` | No | Negative prompt describing content that should not appear in the video |
| `cfg_scale` | `number` | No | Video generation flexibility; higher values make output closer to the prompt but reduce flexibility |
| `aspect_ratio` | `string` | No | Video aspect ratio: `16:9` (landscape), `9:16` (portrait), `1:1` (square) |
| `duration` | `string` | No | Video duration in seconds: `5` or `10` |
| `callback_url` | `string` | No | Callback notification URL to call when the task completes |
| `external_task_id` | `string` | No | User-defined task ID for business-side correlation |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; `0` means success |
| `message` | `string` | Status description |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID used for subsequent polling |
| `data.task_status` | `string` | Initial status, typically `submitted` |
| `data.task_info.external_task_id` | `string?` | User-defined task ID (if provided) |
| `data.created_at` | `number` | Task creation time (Unix timestamp, seconds) |
| `data.updated_at` | `number` | Task last updated time (Unix timestamp, seconds) |

### Response Example

```json
{
  "code": 0,
  "message": "Success",
  "request_id": "req_123456",
  "data": {
    "task_id": "task_789012",
    "task_status": "submitted",
    "task_info": {
      "external_task_id": "user_task_001"
    },
    "created_at": 1704067200,
    "updated_at": 1704067200
  }
}
```

---

## Generation-Time Usage (Direct Agent Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — key injected by platform

async function submitTextToVideo(
  prompt: string,
  options?: {
    model_name?: string;
    negative_prompt?: string;
    cfg_scale?: number;
    aspect_ratio?: string;
    duration?: string;
    callback_url?: string;
    external_task_id?: string;
  }
): Promise<{ taskId: string }> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-qYGWo8XA7JVY.gateway.appmedo.com/v1/videos/text2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        ...options,
      }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return { taskId: json.data.task_id };
}
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function Code

```typescript
// edge-functions/kling-submit-text2video.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let prompt: string;
  let model_name: string | undefined;
  let negative_prompt: string | undefined;
  let cfg_scale: number | undefined;
  let aspect_ratio: string | undefined;
  let duration: string | undefined;
  let callback_url: string | undefined;
  let external_task_id: string | undefined;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    model_name = body.model_name;
    negative_prompt = body.negative_prompt;
    cfg_scale = body.cfg_scale;
    aspect_ratio = body.aspect_ratio;
    duration = body.duration;
    callback_url = body.callback_url;
    external_task_id = body.external_task_id;
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

  // --- Build request body (omit undefined fields) ---
  const requestBody: Record<string, unknown> = { prompt };
  if (model_name)       requestBody.model_name = model_name;
  if (negative_prompt)  requestBody.negative_prompt = negative_prompt;
  if (cfg_scale !== undefined) requestBody.cfg_scale = cfg_scale;
  if (aspect_ratio)     requestBody.aspect_ratio = aspect_ratio;
  if (duration)         requestBody.duration = duration;
  if (callback_url)     requestBody.callback_url = callback_url;
  if (external_task_id) requestBody.external_task_id = external_task_id;

  // --- Call upstream ---
  const upstream = await fetch(
    "https://app-b0t9jb6nl2pt-api-qYGWo8XA7JVY.gateway.appmedo.com/v1/videos/text2video",
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

### Frontend Call to Edge Function (Submit Task)

**Recommended (when supabase client is available):**

```typescript
async function submitTextToVideo(
  prompt: string,
  options?: {
    model_name?: string;
    negative_prompt?: string;
    cfg_scale?: number;
    aspect_ratio?: string;
    duration?: string;
    external_task_id?: string;
  }
) {
  const { data, error } = await supabase.functions.invoke("kling-submit-text2video", {
    body: { prompt, ...options },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data as { task_id: string; task_status: string };
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function submitTextToVideo(
  prompt: string,
  options?: {
    model_name?: string;
    negative_prompt?: string;
    cfg_scale?: number;
    aspect_ratio?: string;
    duration?: string;
    external_task_id?: string;
  }
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-submit-text2video`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...options }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exhausted: ${err.message ?? res.statusText}`);
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

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in Edge Functions; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance); forward these error bodies verbatim to the frontend.
- **Billing**: Each task submission costs **¥35.00** discounted (¥45.50 original price). After submitting, always pair with the query endpoint for polling to avoid duplicate submissions that waste quota.
- **Model selection**: `kling-v2-master` is recommended for best quality; use `kling-v2-5-turbo` if speed is a priority.
- **Async behavior**: The submit endpoint only returns a `task_id`. Video content must be retrieved by polling the query endpoint (`references/query-api.md`).
