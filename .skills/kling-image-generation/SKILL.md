---
name: kling-image-generation
description: Generate images from text or a reference image via Kling AI. Use for text-to-image and visual asset creation.
license: MIT
---

# Kling AI Image Generation

Powered by Kling AI, this skill submits image generation tasks and polls for results. It supports text-to-image and image-to-image modes, multiple aspect ratios, batch generation (up to 9 images), face/character reference, and optional watermarking.

## Overview

| Item | Details |
|------|---------|
| Create Task Endpoint | `POST https://app-b0t9jb6nl2pt-api-DY8MnRlwkXKa.gateway.appmedo.com/v1/images/generations` |
| Query Task Endpoint | `GET https://app-b0t9jb6nl2pt-api-M9v0wzOkZXGY.gateway.appmedo.com/v1/images/generations/{task_id}` |
| Authentication | Platform-managed — key injected via `INTEGRATIONS_API_KEY` |
| Billing | List price ¥0.50 / call, discounted ¥0.35 / call (create task only) |
| Async Mode | Returns `task_id` on submission; poll until `task_status` is `succeed` or `failed` |
| Image Expiry | CDN links expire after 30 days; download or transfer immediately |

## End-to-End Workflow (submit → poll → result)

```
1. Call the create task endpoint → receive task_id
2. Poll the query endpoint every 7 seconds until task_status === "succeed" or "failed"
3. Extract image URLs from task_result.images[]
4. Download immediately (generation-time) or transfer to Supabase Storage (post-generation Edge Function)
```

### Polling Reference Implementation

```typescript
async function generateAndWait(submitFn: () => Promise<{ taskId: string }>) {
  const { taskId } = await submitFn();

  const POLL_INTERVAL_MS = 7000;       // 5–10 s recommended
  const TIMEOUT_MS = 10 * 60 * 1000;  // 10 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTask(taskId);
    if (result.task_status === "succeed") return result;
    if (result.task_status === "failed")
      throw new Error(`Task failed: ${result.task_status_msg}`);
    // submitted / processing → keep polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

## Generation-Time Usage (Agent Direct Call)

> For detailed parameter descriptions, see `references/create-task-api.md` (create task) and `references/query-task-api.md` (query task).

A complete generation-time call should follow these steps:
1. Call `createImageTask()` to submit the generation request and obtain a `task_id`
2. Poll `queryImageTask(taskId)` until the task completes
3. Download the image immediately using `curl`

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed key injected by the platform

// Step 1: Submit image generation task
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

// Step 2: Query task status
async function queryImageTask(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: { images: Array<{ index: number; url: string; watermark_url?: string }> };
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

Image URLs returned by the generation API are temporary CDN links (expire after 30 days). After obtaining the URL at generation time (Agent direct call scenario), **you must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o <local-path>.jpg "<generated image URL>"
```

**Complete Generation-Time Workflow (including download step):**

1. Call `createImageTask()` to submit the task and obtain `task_id`
2. Call `queryImageTask(taskId)` every 7 seconds until `task_status === "succeed"` or `"failed"`
3. Extract image URLs from `task_result.images[].url`
4. Run `curl -L -o <local-path>.jpg "<url>"` via the Bash tool to download the image locally
5. Inform the user that the file has been saved to the corresponding path

> **Note**: Upstream CDN links expire after 30 days. Download immediately upon receiving the URL — do not delay.

## Post-Generation Usage (In-App via Edge Function)

> For the detailed Edge Function implementation (including Supabase Storage transfer), see:
> - `references/create-task-api.md` — Create Task Edge Function
> - `references/query-task-api.md` — Query Task Edge Function

**Frontend call example (supabase client):**

```typescript
// Submit image generation task
async function submitKlingImageTask(params: {
  prompt: string;
  n?: number;
  aspect_ratio?: string;
}) {
  const { data, error } = await supabase.functions.invoke("kling-create-task", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data; // { task_id, task_status }
}

// Query task result
async function pollKlingImageTask(taskId: string) {
  const { data, error } = await supabase.functions.invoke("kling-query-task", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data; // { task_status, task_result: { images: [...] } }
}
```

**Alternative (when supabase client is unavailable):**

```typescript
async function submitKlingImageTask(params: { prompt: string; n?: number; aspect_ratio?: string }) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-create-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (res.status === 429) throw new Error(`Quota exhausted: ${(await res.json()).message}`);
  if (res.status === 402) throw new Error(`Insufficient balance: ${(await res.json()).message}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data;
}
```

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` may only be read server-side in an Edge Function; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance).
- **Billing**: Only the create task call (`api-DY8MnRlwkXKa`) is billed at ¥0.35 / call (discounted); query task calls are free. Avoid re-submitting new tasks due to polling logic errors.
- **Async wait**: Do not block-wait for task completion within a single request. In Edge Functions, prefer using `callback_url` + webhook, or let the frontend poll `kling-query-task`.
- **Image expiry**: Upstream CDN links expire after 30 days. In Edge Functions, transfer images to Supabase Storage before returning URLs to the frontend (see `references/create-task-api.md`).
- **Base64 images**: When passing the `image` parameter, use raw Base64 encoding without the `data:image/...;base64,` prefix.
- **Image-to-image limitation**: `negative_prompt` is not supported in image-to-image mode.
