# Remix Video API — Sora 2

## Overview

Modify specific aspects of an existing completed Sora video while preserving its core structure and motion. Useful for targeted edits (e.g., change the setting, style, or subject while keeping the motion pattern).

| Item | Details |
|------|---------|
| Endpoint | `POST https://api-m9xKVXpN3J8a@plugin-us.openai.azure.com/openai/v1/videos/remix` |
| Content-Type | `multipart/form-data` |
| Auth | Platform-managed (`INTEGRATIONS_API_KEY`) |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `string` | No | Model name, default `"sora-2"` |
| `prompt` | `string` | **Yes** | Natural-language prompt describing the target video effect |
| `remix_video_id` | `string` | **Yes** | ID of the previously completed video (`video_<hash>`) to use as the remix source |
| `size` | `string` | No | Output resolution: `"720x1280"` or `"1280x720"`, default `"720x1280"` |
| `seconds` | `string` | No | Video duration: `4` / `8` / `12` seconds, default matches the source video |

### Response Fields

Same as the Create Video endpoint; see `create-video-api.md`.

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed: key is injected by the platform

async function remixVideo(params: {
  prompt: string;
  remixVideoId: string;
  size?: "720x1280" | "1280x720";
  seconds?: "4" | "8" | "12";
  model?: string;
}): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append("prompt", params.prompt);
  formData.append("remix_video_id", params.remixVideoId);

  if (params.model)   formData.append("model", params.model);
  if (params.size)    formData.append("size", params.size);
  if (params.seconds) formData.append("seconds", params.seconds);

  const response = await fetch(
    "https://api-m9xKVXpN3J8a@plugin-us.openai.azure.com/openai/v1/videos/remix",
    {
      method: "POST",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
        // Do NOT set Content-Type — let runtime set multipart boundary
      },
      body: formData,
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Generation-time file download (required):** After polling completes (see SKILL.md workflow) and `video_url` is available:

```bash
curl -L -o ./remixed_output.mp4 "<video_url>"
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/remix-video.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let prompt: string;
  let remix_video_id: string;
  let size: string | undefined;
  let seconds: string | undefined;
  let model: string | undefined;

  try {
    const body = await req.json();
    prompt = body.prompt;
    remix_video_id = body.remix_video_id;
    if (!prompt || !remix_video_id) throw new Error("Missing prompt or remix_video_id");
    size = body.size;
    seconds = body.seconds;
    model = body.model;
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
  formData.append("remix_video_id", remix_video_id);
  if (size)    formData.append("size", size);
  if (seconds) formData.append("seconds", seconds);
  if (model)   formData.append("model", model);

  const upstream = await fetch(
    "https://api-m9xKVXpN3J8a@plugin-us.openai.azure.com/openai/v1/videos/remix",
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
async function remixVideo(params: {
  prompt: string;
  remix_video_id: string;
  size?: "720x1280" | "1280x720";
  seconds?: "4" | "8" | "12";
}) {
  const { data, error } = await supabase.functions.invoke("remix-video", {
    body: params,
  });
  if (error) throw error;
  return data as { id: string; status: string };
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function remixVideo(params: {
  prompt: string;
  remix_video_id: string;
  size?: "720x1280" | "1280x720";
  seconds?: "4" | "8" | "12";
}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remix-video`, {
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

> After submitting, poll with the `query-video` Edge Function (see `query-video-api.md`).
