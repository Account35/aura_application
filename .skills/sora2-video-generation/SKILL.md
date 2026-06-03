---
name: sora2-video-generation
description: Generate high-quality videos with Sora 2 — text-to-video, image-to-video, or video remix — and poll until completion. Use this skill whenever the user wants to create, generate, or produce a video from a text prompt or image, remix an existing video, or check/query the status of a Sora video generation job.
license: MIT
---

# Sora 2 Video Generation (Advanced)

Generates high-quality videos from text prompts or reference images using the Sora 2 model. Supports portrait/landscape resolutions, durations of 4/8/12 seconds, reference-image anchoring, and video remix. Video jobs are asynchronous — submit a job, then poll until `completed`.

## Overview

| Item | Details |
|------|---------|
| Create Video | `POST https://api-rLobRzgWxVr9@plugin-us.openai.azure.com/openai/v1/videos` |
| Query Status | `POST https://api-DYJwnoM46d6a@app-b0t9jb6nl2pt-api-DYJwnoM46d6a.gateway.appmedo.com` |
| Reference Image Video | `POST https://api-GYX1blQvVAja@plugin-us.openai.azure.com/openai/v1/videos` (with `input_reference` file) |
| Remix Video | `POST https://api-m9xKVXpN3J8a@plugin-us.openai.azure.com/openai/v1/videos/remix` |
| Model | `sora-2` |
| Resolution | `720x1280` (portrait), `1280x720` (landscape) |
| Duration | 4 / 8 / 12 seconds |

> Read `references/create-video-api.md` for the full Create Video spec and code.
> Read `references/query-video-api.md` for the full Query Status spec and code.
> Read `references/reference-video-api.md` for the Reference Image Video spec and code.
> Read `references/remix-video-api.md` for the Remix Video spec and code.

---

## End-to-End Workflow (Async Polling)

All video generation endpoints are asynchronous. The standard workflow is:

1. **Submit** — call the Create Video (or Reference/Remix) endpoint; receive `{ id, status: "queued" }`.
2. **Poll** — call the Query endpoint every ~7 seconds with the returned `id`.
3. **Result** — when `status === "completed"`, the response includes `video_url`. Download it immediately (CDN links are ephemeral).

### Async polling pattern

```typescript
async function generateAndWait(
  submitFn: () => Promise<{ id: string; status: string }>
): Promise<{ video_url: string; [key: string]: unknown }> {
  const { id } = await submitFn();

  const POLL_INTERVAL_MS = 7000;        // 7 s between polls
  const TIMEOUT_MS = 10 * 60 * 1000;   // 10-minute hard timeout
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoStatus(id);
    if (result.status === "completed") return result;
    if (result.status === "failed")    throw new Error(`Job failed: ${JSON.stringify(result.error)}`);
    if (result.status === "cancelled") throw new Error("Job was cancelled");
    // queued | in_progress → keep polling
  }
  throw new Error(`Video job ${id} timed out after 10 minutes`);
}
```

---

## Generation-Time Usage (Agent Direct Call)

See `references/create-video-api.md` and `references/query-video-api.md` for the generation-time TypeScript code for each endpoint.

**Generation-time file download (required):**

The `video_url` returned by the query endpoint is an ephemeral CDN link. After obtaining the URL during generation, **you must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o ./output_video.mp4 "<video_url>"
```

Complete generation-time workflow:
1. Call the Create Video endpoint to get the `id`
2. Poll the Query endpoint until `status === "completed"` and extract `video_url`
3. Use the Bash tool to run `curl -L -o <local_path> "<video_url>"` to download the video
4. Inform the user that the file has been saved to the corresponding path

> **Note**: CDN links are time-limited. Download immediately after receiving the URL — do not delay.

---

## Post-Generation Usage (In-App via Edge Function)

See each `references/<endpoint>-api.md` for the full Edge Function boilerplate and frontend caller for each endpoint.

The security contract for all endpoints:
- Client sends JSON to the Edge Function.
- Edge Function reads `INTEGRATIONS_API_KEY` from Deno env and attaches it as `X-Gateway-Authorization: Bearer ${apiKey}`.
- The raw API key is never exposed to the browser.
- 429 (quota exceeded) and 402 (insufficient balance) are forwarded verbatim to the client.
- Completed videos return a Supabase Storage `publicUrl` instead of the ephemeral CDN URL.

---

## Important Notes

- **Key security**: `INTEGRATIONS_API_KEY` may only be read server-side in the Edge Function; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance).
- **Billing**: Create Video, Reference Video, and Remix Video are all billed (original price 96 credits/request, discounted price 80 credits/request); Query Status is free. Avoid submitting duplicate jobs in a loop.
- **Resolution constraint**: When using `input_reference` (reference image), the source image and output video resolutions must match exactly (only `720x1280` / `1280x720` are supported).
- **Content restrictions**: Only content suitable for audiences under 18 is allowed; no copyrighted characters or music; no real people (including public figures); input images containing human faces require special authorization.
- **Video expiry**: Generated video CDN URLs are time-limited; download or transfer to Supabase Storage immediately after retrieval.
