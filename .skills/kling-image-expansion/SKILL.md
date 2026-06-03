---
name: kling-image-expansion
description: Expand images in any direction using Kling AI. Use this skill whenever the user wants to extend an image outward, add canvas space around a photo, uncrop an image, or expand image borders in any direction (up, down, left, right) with AI-generated fill.
license: MIT
---

# Kling AI Image Expansion

Powered by Kling AI, this skill submits image expansion tasks and polls for results. It extends an existing image in any of the four directions (up, down, left, right) using configurable expansion ratios, with optional text prompt guidance and optional watermarking.

## Capability Overview

| Item | Details |
|------|---------|
| Create Task Endpoint | `POST https://app-b0t9jb6nl2pt-api-GYX1bbkRQj4a.gateway.appmedo.com/v1/images/editing/expand` |
| Query Task (Single) Endpoint | `GET https://app-b0t9jb6nl2pt-api-AalZkkAG5w7L.gateway.appmedo.com/v1/images/editing/expand/{task_id}` |
| Query Task (List) Endpoint | `GET https://app-b0t9jb6nl2pt-api-pLVzAAkGZwDL.gateway.appmedo.com/v1/images/editing/expand` |
| Authentication | Platform-managed — key injected via `INTEGRATIONS_API_KEY` |
| Billing | Original price ¥3.40 / request, discounted price ¥2.80 / request (billed on task creation only) |
| Async Mode | Returns `task_id` after submission; poll until `task_status` becomes `succeed` or `failed` |
| Image Expiry | CDN links expire after 30 days; download or transfer to storage immediately |

## End-to-End Workflow (submit → poll → result)

```
1. Call the create task endpoint → receive task_id
2. Poll the query endpoint every 7 seconds until task_status === "succeed" or "failed"
3. Extract image URLs from task_result.images[]
4. Download immediately (generation phase) or transfer to Supabase Storage (post-generation Edge Function)
```

### Polling Reference Implementation

```typescript
async function expandAndWait(submitFn: () => Promise<{ taskId: string }>) {
  const { taskId } = await submitFn();

  const POLL_INTERVAL_MS = 7000;       // 5–10 s recommended
  const TIMEOUT_MS = 10 * 60 * 1000;  // 10 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryExpandTask(taskId);
    if (result.task_status === "succeed") return result;
    if (result.task_status === "failed")
      throw new Error(`Task failed: ${result.task_status_msg}`);
    // submitted / processing → keep polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

## Generation-Phase Usage (Direct Agent Call)

> For detailed parameter descriptions, see `references/create-task-api.md` (create task) and `references/query-task-api.md` (query task).

A complete generation-phase call should follow these steps:
1. Call `createExpandTask()` to submit the expansion request and obtain a `task_id`
2. Poll `queryExpandTask(taskId)` until the task completes
3. Download the image immediately using `curl`

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed key injected by the platform

// Step 1: Submit expansion task
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

// Step 2: Query task status
async function queryExpandTask(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: { images: Array<{ index: number; url: string }> };
}> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-AalZkkAG5w7L.gateway.appmedo.com/v1/images/editing/expand/${taskId}`,
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

**Generation-phase file download (required):**

The image URLs returned by the generation API are temporary CDN links (expire after 30 days). After obtaining the URL during the generation phase (direct Agent call), **you must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o <local-path>.jpg "<generated image URL>"
```

**Complete generation-phase workflow (including download step):**

1. Call `createExpandTask()` to submit the task and obtain `task_id`
2. Call `queryExpandTask(taskId)` every 7 seconds until `task_status === "succeed"` or `"failed"`
3. Extract the image URL from `task_result.images[].url`
4. Use the Bash tool to run `curl -L -o <local-path>.jpg "<url>"` to download the image locally
5. Inform the user that the file has been saved to the corresponding path

> **Note**: The upstream CDN link expires after 30 days. Download immediately after obtaining the URL — do not delay.

## Post-Generation Usage (In-App via Edge Function)

> For detailed Edge Function implementations (including Supabase Storage transfer), see:
> - `references/create-task-api.md` — Create task Edge Function
> - `references/query-task-api.md` — Query task Edge Function (includes single query and list query)

**Frontend invocation example (supabase client):**

```typescript
// Submit expansion task
async function submitExpandTask(params: {
  image: string;
  up_expansion_ratio: number;
  down_expansion_ratio: number;
  left_expansion_ratio: number;
  right_expansion_ratio: number;
  prompt?: string;
  n?: number;
}) {
  const { data, error } = await supabase.functions.invoke("kling-expand-create", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data; // { task_id, task_status }
}

// Query expansion task result
async function pollExpandTask(taskId: string) {
  const { data, error } = await supabase.functions.invoke("kling-expand-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data; // { task_status, task_result: { images: [...] } }
}
```

**Alternative (when supabase client is unavailable):**

```typescript
async function submitExpandTask(params: {
  image: string;
  up_expansion_ratio: number;
  down_expansion_ratio: number;
  left_expansion_ratio: number;
  right_expansion_ratio: number;
}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-expand-create`, {
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

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in the Edge Function; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance).
- **Billing**: Only the create task endpoint (`api-GYX1bbkRQj4a`) is billed at a discounted price of ¥2.80 / request; query endpoints are free. Avoid repeatedly submitting new tasks due to polling logic errors.
- **Expansion ratio limits**: The total area of the expanded image must not exceed 3× the original; each directional ratio is in the range [0, 2] (as a multiple of the original image dimension).
- **Image format requirements**: Supports .jpg/.jpeg/.png, file size ≤ 10 MB, minimum dimension 300 px, aspect ratio between 1:2.5 and 2.5:1.
- **Base64 images**: When passing the `image` parameter as Base64, use raw Base64 encoding without the `data:image/...;base64,` prefix.
- **Image expiry**: Upstream CDN links expire after 30 days. The Edge Function should transfer images to Supabase Storage before returning URLs to the frontend (see `references/query-task-api.md`).
- **Async waiting**: Do not block within a single request waiting for task completion. In Edge Functions, prefer using `callback_url` + webhook, or have the frontend poll `kling-expand-query`.
