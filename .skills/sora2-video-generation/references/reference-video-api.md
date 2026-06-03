# Reference Image Video API — Sora 2

## Overview

Generate a video anchored to a reference image (first-frame anchor). The source image resolution must exactly match the output video resolution.

| Item | Details |
|------|---------|
| Endpoint | `POST https://api-GYX1blQvVAja@plugin-us.openai.azure.com/openai/v1/videos` |
| Content-Type | `multipart/form-data` |
| Auth | Platform-managed (`INTEGRATIONS_API_KEY`) |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `string` | No | Model name, default `"sora-2"` |
| `prompt` | `string` | **Yes** | Natural-language description of the video scene |
| `size` | `string` | **Yes** | Output resolution: `"720x1280"` or `"1280x720"` (must match `input_reference` image resolution) |
| `seconds` | `string` | No | Video duration: `4` / `8` / `12` seconds, default `4` |
| `input_reference` | `file` | **Yes** | Reference image (JPEG/PNG/WebP); **resolution must exactly match `size`** |

> **Important**: The `input_reference` image resolution must exactly match the `size` parameter. For example, if `size="1280x720"`, the uploaded image must also be 1280×720 pixels.

### Response Fields

Same as the Create Video endpoint; see `create-video-api.md`.

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed: key is injected by the platform

import * as fs from "fs";

async function createReferenceVideo(params: {
  prompt: string;
  size: "720x1280" | "1280x720";
  referenceImagePath: string;  // local file path
  seconds?: "4" | "8" | "12";
  model?: string;
}): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append("prompt", params.prompt);
  formData.append("size", params.size);

  // Attach reference image
  const imageBuffer = fs.readFileSync(params.referenceImagePath);
  const imageBlob = new Blob([imageBuffer], { type: "image/jpeg" }); // adjust MIME if needed
  formData.append("input_reference", imageBlob, "reference.jpg");

  if (params.model)   formData.append("model", params.model);
  if (params.seconds) formData.append("seconds", params.seconds);

  const response = await fetch(
    "https://api-GYX1blQvVAja@plugin-us.openai.azure.com/openai/v1/videos",
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
curl -L -o ./reference_output.mp4 "<video_url>"
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/reference-video.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Expect multipart/form-data forwarded from client, or JSON with a Supabase Storage path
  let prompt: string;
  let size: string;
  let seconds: string | undefined;
  let model: string | undefined;
  let referenceImageUrl: string; // Supabase Storage URL to the reference image

  try {
    const body = await req.json();
    prompt = body.prompt;
    size = body.size;
    seconds = body.seconds;
    model = body.model;
    referenceImageUrl = body.reference_image_url;
    if (!prompt || !size || !referenceImageUrl) throw new Error("Missing required fields");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch the reference image from Supabase Storage
  const imgResponse = await fetch(referenceImageUrl);
  if (!imgResponse.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch reference image" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imgBlob = await imgResponse.blob();

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("size", size);
  formData.append("input_reference", imgBlob, "reference.jpg");
  if (model)   formData.append("model", model);
  if (seconds) formData.append("seconds", seconds);

  const upstream = await fetch(
    "https://api-GYX1blQvVAja@plugin-us.openai.azure.com/openai/v1/videos",
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

```typescript
async function createReferenceVideo(params: {
  prompt: string;
  size: "720x1280" | "1280x720";
  reference_image_url: string; // Supabase Storage public URL of the reference image
  seconds?: "4" | "8" | "12";
}) {
  const { data, error } = await supabase.functions.invoke("reference-video", {
    body: params,
  });
  if (error) throw error;
  return data as { id: string; status: string };
}
```

> After submitting, poll with the `query-video` Edge Function (see `query-video-api.md`).
