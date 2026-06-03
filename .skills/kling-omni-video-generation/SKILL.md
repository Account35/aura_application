---
name: kling-omni-video-generation
description: Generate videos using Kling AI's Omni model via API gateway, supporting text-to-video, image-to-video, video editing, multi-shot storyboard, and video reference modes. Use this skill whenever the user wants to create a video from a text prompt or reference image/video — for creative content, marketing, short-video production, or any scenario involving AI video generation with Kling's omni model.
license: MIT
---

# Kling Omni Video Generation

## Overview

Generate videos using the Kling AI Omni model, supporting text-to-video, image-to-video, video editing, video reference, and multi-shot storyboard modes. Uses an asynchronous task pattern: submit a task to obtain a `task_id`, then poll the query endpoint until completion.

| Property | Value |
|----------|-------|
| Submit Endpoint | `POST https://app-b0t9jb6nl2pt-api-k93RvqRrRZba.gateway.appmedo.com/v1/videos/omni-video` |
| Query Endpoint | `GET https://app-b0t9jb6nl2pt-api-pLVzAEz1ZQOL.gateway.appmedo.com/v1/videos/omni-video/{task_id}` |
| Authentication | Bearer Token (platform_managed — key injected by platform) |
| Request Format | `application/json` |
| Response Format | JSON (includes video URL) |
| Billing | Original price ¥160.80 / request, discounted price ¥134.00 / request (submit endpoint is billed; query endpoint is free) |

### Key Capability Modes

| Mode | Description |
|------|-------------|
| Text-to-video | Generate video using `prompt` only |
| Image-to-video | Generate video using `prompt` + `image_list` reference images |
| Video editing | Modify existing video content using `prompt` + `video_list` |
| Video reference | Generate new video by referencing the motion/cinematography of an existing video |
| First/last frame | Generate video by specifying a start frame or both start and end frames |
| Multi-shot | Enable `multi_shot: true` + `multi_prompt` to support up to 6 storyboard shots |

> For full parameter details and code examples, see `references/submit-api.md` and `references/query-api.md`.

---

## End-to-End Async Workflow

Kling Omni video generation is **asynchronous**: submit a task to obtain a `task_id`, then poll the query endpoint until the status becomes `succeed` or `failed`.

```typescript
// Full async workflow: submit → poll → retrieve video URL
async function generateAndWait(submitFn: () => Promise<{ taskId: string }>) {
  const { taskId } = await submitFn();

  const POLL_INTERVAL_MS = 7000;          // recommended 5–10 seconds
  const TIMEOUT_MS = 10 * 60 * 1000;     // maximum 10 minutes
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
- `submitted` — task has been submitted, awaiting processing
- `processing` — task is being processed
- `succeed` — task completed successfully; `task_result.videos` contains the video URL
- `failed` — task failed

---

## Generation-time Usage (Direct Agent Call)

Call both endpoints directly during generation to complete the full submit → poll → download workflow.

> For the full TypeScript submit function, see the "Generation-time Usage" section in `references/submit-api.md`.
> For the query function, see the "Generation-time Usage" section in `references/query-api.md`.

**Generation-time file download (required):**

The video URL returned by the generation API is an ephemeral CDN link. After obtaining the URL, **you must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o /tmp/generated_omni_video.mp4 "<task_result.videos[0].url>"
```

**Complete generation-time workflow:**

1. Call the submit function to obtain `task_id` (see `references/submit-api.md`)
2. Call the query function every 7 seconds until `task_status === "succeed"`
3. Retrieve the video URL from `task_result.videos[0].url`
4. Use the Bash tool to run `curl -L -o <local-path>.mp4 "<url>"` to download the video locally
5. Inform the user that the file has been saved to the corresponding path

> **Note**: The upstream CDN link expires after 30 days. Download immediately after obtaining the URL — do not delay.

---

## Post-generation Usage (In-app via Edge Function)

In the application, proxy requests through two separate Edge Functions: one for submitting tasks and one for querying status. The query Edge Function transfers the video URL to Supabase Storage once the task is complete, returning a persistent public URL to the frontend.

> For complete Edge Function code and frontend call patterns, see the "Post-generation Usage" sections in `references/submit-api.md` and `references/query-api.md`.
