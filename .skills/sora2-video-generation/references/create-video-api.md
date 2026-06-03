# Create Video API — Sora 2

## Overview

Start a new video generation job from a text prompt using the Sora 2 model.

| Item | Details |
|------|---------|
| Endpoint | `POST https://api-rLobRzgWxVr9@plugin-us.openai.azure.com/openai/v1/videos` |
| Content-Type | `multipart/form-data` |
| Auth | Platform-managed (`INTEGRATIONS_API_KEY`) |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `string` | No | Model name, default `"sora-2"` |
| `prompt` | `string` | **Yes** | Natural-language description of the video scene |
| `size` | `string` | No | Output resolution: `"720x1280"` (portrait) or `"1280x720"` (landscape), default `"720x1280"` |
| `seconds` | `string` | No | Video duration: `4` / `8` / `12` seconds, default `4` |
| `input_reference` | `file` | No | Reference image (JPEG/PNG/WebP) for first-frame anchoring; resolution must match `size` |
| `remix_video_id` | `string` | No | ID of a previously completed video to use as the remix source |

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Video job ID, format `video_<hash>` |
| `status` | `string` | Job status: `queued` / `in_progress` / `completed` / `failed` / `cancelled` |
| `model` | `string` | Model name used |
| `prompt` | `string` | Original prompt text |

### Response Example

```json
{
  "id": "video_698c8e48cd108190ba08e5946d35d686",
  "status": "queued",
  "model": "sora-2",
  "prompt": "A cool cat on a motorcycle at night"
}
```

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed: key is injected by the platform

interface CreateVideoResponse {
  id: string;
  status: string;
  model: string;
  prompt: string;
}

async function createVideo(params: {
  prompt: string;
  size?: "720x1280" | "1280x720";
  seconds?: "4" | "8" | "12";
  model?: string;
}): Promise<CreateVideoResponse> {
  const formData = new FormData();
  formData.append("prompt", params.prompt);
  if (params.model)   formData.append("model", params.model);
  if (params.size)    formData.append("size", params.size);
  if (params.seconds) formData.append("seconds", params.seconds);

  const response = await fetch(
    "https://api-rLobRzgWxVr9@plugin-us.openai.azure.com/openai/v1/videos",
    {
      method: "POST",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
        // Do NOT set Content-Type manually — browser/Node sets multipart boundary automatically
      },
      body: formData,
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Generation-time file download (required):** After polling completes (see SKILL.md workflow) and `video_url` is available, immediately run:

```bash
curl -L -o ./output_video.mp4 "<video_url>"
```

> CDN links are time-limited; download immediately after receiving the URL.

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/create-video.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let prompt: string;
  let size: string | undefined;
  let seconds: string | undefined;
  let model: string | undefined;

  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    size    = body.size;
    seconds = body.seconds;
    model   = body.model;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = new FormData();
  formData.append("prompt", prompt);
  if (model)   formData.append("model", model);
  if (size)    formData.append("size", size);
  if (seconds) formData.append("seconds", seconds);

  const upstream = await fetch(
    "https://api-rLobRzgWxVr9@plugin-us.openai.azure.com/openai/v1/videos",
    {
      method: "POST",
      headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      body: formData,
    }
  );

  if (upstream.status === 429 || upstream.status === 402) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend → Edge Function

**Recommended (when supabase client is available):**

```typescript
async function createVideo(params: {
  prompt: string;
  size?: "720x1280" | "1280x720";
  seconds?: "4" | "8" | "12";
}) {
  const { data, error } = await supabase.functions.invoke("create-video", {
    body: params,
  });
  if (error) throw error;
  return data as { id: string; status: string };
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function createVideo(params: {
  prompt: string;
  size?: "720x1280" | "1280x720";
  seconds?: "4" | "8" | "12";
}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  return res.json() as Promise<{ id: string; status: string }>;
}
```
