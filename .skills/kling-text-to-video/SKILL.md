---
name: kling-text-to-video
description: Generate short videos from text prompts using the Kling AI text-to-video API. Use this skill whenever the user wants to create a video from a script, scene description, or keywords — for e-commerce marketing, creative promotion, educational content, or entertainment production.
license: MIT
---

# Kling Text-to-Video

## Overview

Converts text descriptions into short videos using the Kling AI model, supporting asynchronous task polling (up to 10 minutes). Suitable for e-commerce marketing, creative promotion, educational content, and entertainment production.

| Property | Value |
|----------|-------|
| Submit Endpoint | `POST https://app-b0t9jb6nl2pt-api-qYGWo8XA7JVY.gateway.appmedo.com/v1/videos/text2video` |
| Query Endpoint | `GET https://app-b0t9jb6nl2pt-api-oLpZ7eD5j2Pa.gateway.appmedo.com/v1/videos/text2video/{id}` |
| Auth | Bearer Token (platform_managed) |
| Request Format | `application/json` |
| Response Format | JSON (includes video URL) |
| Billing | Original price ¥45.50 / request, discounted price ¥35.00 / request (submit endpoint billed, query endpoint free) |

### Main Request Parameters (Submit)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | Video generation prompt |
| `model_name` | `string` | No | Model name: `kling-v1`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1-master`, `kling-v2-5-turbo` |
| `negative_prompt` | `string` | No | Negative prompt |
| `aspect_ratio` | `string` | No | Video aspect ratio: `16:9`, `9:16`, `1:1` |
| `duration` | `string` | No | Video duration in seconds: `5` or `10` |

> For complete parameter descriptions and code, see `references/submit-api.md` and `references/query-api.md`.

---

## End-to-End Async Workflow

Kling video generation is an **async task**: first submit the task to obtain a `task_id`, then poll the query endpoint until the status becomes `succeed` or `failed`.

```typescript
// Full async workflow: submit → poll → retrieve video URL
async function generateAndWait(prompt: string, options?: {
  model_name?: string;
  aspect_ratio?: string;
  duration?: string;
  negative_prompt?: string;
}) {
  // Step 1: Submit task
  const { taskId } = await submitTextToVideo(prompt, options);

  // Step 2: Poll until complete
  const POLL_INTERVAL_MS = 7000;          // Recommended 5–10 seconds
  const TIMEOUT_MS = 10 * 60 * 1000;     // Max 10 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTask(taskId);
    if (result.task_status === "succeed") return result;
    if (result.task_status === "failed")  throw new Error(`Task failed: ${result.task_status_msg}`);
    // submitted / processing → continue polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

Task status descriptions:
- `submitted` — Task submitted, waiting to be processed
- `processing` — Task is being processed
- `succeed` — Task completed successfully; `task_result.videos` contains the video URL
- `failed` — Task failed

---

## Generation-Time Usage (Direct Agent Call)

Call both endpoints directly during generation time to complete the full submit → poll → download workflow.

> For the complete TypeScript code see the "Generation-Time Usage" section in `references/submit-api.md` (contains the submit function).
> For the query function code see the "Generation-Time Usage" section in `references/query-api.md`.

**Generation-time file download (required):**

The video URL returned by the generation endpoint is a CDN temporary link. After obtaining the URL you **must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o /tmp/generated_video.mp4 "<task_result.videos[0].url>"
```

**Complete generation-time workflow:**

1. Call the submit function to obtain `task_id`
2. Call the query function every 7 seconds until `task_status === "succeed"`
3. Retrieve the video URL from `task_result.videos[0].url`
4. Use the Bash tool to run `curl -L -o <local-path>.mp4 "<url>"` to download the video locally
5. Inform the user of the path where the file has been saved

> **Note**: Upstream CDN links are time-limited. Download immediately after obtaining the URL; do not delay.

---

## Post-Generation Usage (In-App via Edge Function)

In the application, proxy requests through two separate Edge Functions: one for submitting tasks and one for querying status. The query Edge Function transfers the video URL to Supabase Storage upon task completion and returns a persistent public URL to the frontend.

> For the complete Edge Function code and frontend call patterns see the "Post-Generation Usage" sections in `references/submit-api.md` and `references/query-api.md`.
