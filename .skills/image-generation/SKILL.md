---
name: image-generation
description: Generate images from text prompts or input images using an async API. Use this skill whenever the user wants to create, generate, or edit images — including text-to-image, image-to-image style transfer, or compositing multiple images. The workflow is submit a task, then poll until complete, then save the result. Triggers on requests like "generate an image of...", "create a picture of...", "convert this photo to...", "make an illustration of...", or any request involving AI image creation or editing.
license: MIT
---

# Image Generation (Advanced Version)

## Capability Overview

This skill drives an asynchronous image-generation service that supports three modes:

| Mode | Description |
|------|-------------|
| Text-to-Image | Generate an image from a text prompt alone |
| Image-to-Image | Upload one image + a text instruction (e.g. style transfer, background swap) |
| Multi-Image-to-Image | Compose two or more images together guided by a text prompt |

The workflow is always **submit → poll → result**. Tasks typically take up to 10 minutes; poll every 5–10 seconds.

> Read `references/submit-api.md` for the full submit endpoint spec.
> Read `references/query-api.md` for the full query/poll endpoint spec.

---

## End-to-End Async Workflow

```typescript
// Full async workflow: submit → poll → result
async function generateAndWait(
  contents: ContentPart[]
): Promise<string> {                      // returns the raw markdown image text
  const { taskId } = await submitTask(contents);

  const POLL_INTERVAL_MS = 7000;          // 5–10 s recommended
  const TIMEOUT_MS = 10 * 60 * 1000;     // 10 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTask(taskId);
    if (result.status === "SUCCESS") {
      // result.result.candidates[0].content.parts[0].text contains
      // the image as a Markdown string: ![image](data:image/jpeg;base64,...)
      return result.result.candidates[0].content.parts[0].text;
    }
    if (result.status === "FAILED") {
      throw new Error(`Task failed: ${JSON.stringify(result.error)}`);
    }
    if (result.status === "TIMEOUT") {
      throw new Error(`Task ${taskId} timed out on the server side`);
    }
    // PENDING → keep polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

---

## Generation-Time Usage (Agent Direct Call)

See `references/submit-api.md` and `references/query-api.md` for the individual function implementations. Compose them with the `generateAndWait` loop above.

**Generation-time file saving (required):**

The query response embeds the image directly as **Base64 data** inside a Markdown string (not a URL). After receiving the result, extract the Base64 payload and save it to disk immediately.

```bash
# Extract Base64 from the markdown string and decode to a file
echo "<base64_data>" | base64 -d > ~/generated-image.jpg
```

**Complete generation-time workflow (including save step):**

1. Call `submitTask(contents)` to submit the generation job → receive `taskId`
2. Poll `queryTask(taskId)` every 7 seconds until `status === "SUCCESS"`, `"FAILED"`, or `"TIMEOUT"` (timeout 10 min)
3. Extract the Base64 string from `candidates[0].content.parts[0].text` (strip the `![image](data:image/jpeg;base64,` prefix and the closing `)`)
4. Use Bash tool: `echo "<base64>" | base64 -d > <local-path>.jpg`
5. Tell the user the file has been saved

> **Note**: The Base64 image data exists only in the current response. Save it immediately — it will be lost if not persisted.

---

## Post-Generation Usage (In-App via Edge Function)

See `references/submit-api.md` for the submit Edge Function boilerplate and `references/query-api.md` for the query Edge Function boilerplate.

The recommended application-side pattern is:

1. Frontend calls the `image-generation-submit` Edge Function → receives `taskId`
2. Frontend polls the `image-generation-query` Edge Function every 7 seconds
3. On `SUCCESS`, the Edge Function decodes the Base64 and uploads to Supabase Storage, returning a persistent `publicUrl`
4. Frontend displays the image from `publicUrl`

---

## Billing

| Item | Price |
|------|-------|
| Original price | ¥17.60 / call |
| Discounted price | ¥13.50 / call |

Each complete generation (submit + poll to terminal state) is billed as **1 call**. Avoid resubmitting the same task.

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` may only be read server-side in an Edge Function; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance); forward those error bodies verbatim to the frontend.
- **Base64 format**: When uploading images, `inline_data.data` must be a pure Base64 string — do not include the `data:image/xxx;base64,` prefix.
- **Request size**: The total size of a single request (including all images) must not exceed **20 MB**.
- **Supported formats**: PNG, JPEG, WEBP.
- **Timeout**: Set the task timeout to at least 10 minutes; poll every 5–10 seconds.
