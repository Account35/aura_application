---
name: gemini-image-generation-lite
description: Call the Gemini Image Generation (Lite) API to edit or generate images via text instructions and Base64-encoded input images. Use this skill whenever the user wants to edit an image (replace background, change elements, adjust style), generate an image from a text prompt, or apply visual transformations through natural language — even if they don't say "Gemini" or "API". Covers both agent-direct calls and Edge Function deployment patterns.
license: MIT
---

# Gemini Image Generation (Lite Version)

Cost-effective multimodal image generation and editing powered by `gemini-3.1-flash-image-preview`. Accepts text instructions plus an optional reference image; returns Base64-encoded PNG output. Ideal for background replacement, element modification, style adjustment, content illustration, cover design, and marketing material creation.

## Capability Overview

| Item | Value |
|------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-rLobRWZ712b9.gateway.appmedo.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent` |
| Auth | Platform-managed — `INTEGRATIONS_API_KEY` injected by platform |
| Content-Type | `application/json` |
| Output | Base64-encoded PNG embedded in response body (no URL) |
| Billing | Original ¥12.20 / unit · Discounted ¥10.10 / unit (10.1 call-units per request) |

**Core capabilities:**
- Background replacement ("replace the background with a beach scene")
- Element modification ("remove the logo in the top-right corner")
- Style adjustment ("convert to watercolor painting style")
- Text-to-image generation (omit `inlineData` and describe the desired image in `text`)

**Response summary:**

```json
{
  "candidates": [{
    "content": {
      "role": "model",
      "parts": [
        { "text": "**Extracting the Subjects**...", "thought": true },
        { "inlineData": { "mimeType": "image/png", "data": "<base64>" } }
      ]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": {
    "promptTokenCount": 537,
    "candidatesTokenCount": 1120,
    "totalTokenCount": 1879
  }
}
```

> Read `references/generate-content-api.md` for the full parameter table, generation-time TypeScript code, and Edge Function boilerplate.

---

## End-to-End Workflow

### Image editing (most common)

1. Obtain the source image as a Base64 string (read file → encode, or accept from user).
2. Call the generation endpoint with `text` instruction + `inlineData` (mimeType + base64 data).
3. Extract `candidates[0].content.parts` — find the entry where `inlineData` exists (skip `thought: true` entries).
4. Decode and save the Base64 PNG to disk immediately (data exists only in this response).

### Text-to-image (no source image)

1. Call the generation endpoint with only a `text` part — omit `inlineData`.
2. Same extraction and save steps as above.

**Base64 save pattern (generation-time):**

```bash
echo "<base64_data>" | base64 -d > output.png
```

---

## Generation-Time Usage (Agent Direct Call)

> Read `references/generate-content-api.md` — Section "Generation-Time Usage" — for the complete TypeScript call function and save workflow.

**Quick reference:**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;
// POST to: https://app-b0t9jb6nl2pt-api-rLobRWZ712b9.gateway.appmedo.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent
// Header: "X-Gateway-Authorization": `Bearer ${apiKey}`
// Body:   JSON with contents[].parts[] containing text + optional inlineData
```

**Generation-time file saving (required):**

This API returns **Base64-encoded image data** directly (no URL). After obtaining the Base64 data at generation time, **you must immediately use the Bash tool to decode and save it locally** so the user can view the result.

```bash
echo "<base64_data>" | base64 -d > output.png
```

Complete generation-time workflow (including save step):

1. Call the generation function and extract `inlineData.data` from `candidates[0].content.parts`
2. Use the Bash tool to decode and save the Base64 data: `echo "<base64>" | base64 -d > <local_path>.png`
3. Notify the user that the file has been saved to the corresponding path

> **Note**: Base64 data exists only in the current response — save it immediately or the data will be lost.

---

## Post-Generation Usage (In-App via Edge Function)

> Read `references/generate-content-api.md` — Section "Post-Generation Usage" — for the complete Edge Function boilerplate and frontend call pattern.

The Edge Function pattern:
- Client sends `{ instruction, imageBase64?, mimeType? }` JSON to the Edge Function.
- Edge Function injects `INTEGRATIONS_API_KEY` as `X-Gateway-Authorization: Bearer ${apiKey}` — the key is never exposed to the browser.
- Edge Function returns `{ imageBase64: string, mimeType: string, usageMetadata: object }`.
- 429 (quota exceeded) and 402 (insufficient balance) are forwarded verbatim to the client.

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in the Edge Function — never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance).
- **Billing**: Each request costs approximately ¥10.10 (discounted price); image tokens are calculated independently (approximately 500–1000 tokens/MB). Avoid retry loops to prevent unexpected charges.
- **Image size**: Recommend compressing input images to ≤5MB for optimal processing speed.
- **Thought entry filtering**: Entries with `thought: true` in the response `parts` array are internal thinking logs, not the final image — skip them when extracting; look for entries with `inlineData`.
- **Chinese instructions**: Chinese editing instructions are supported; specify the operation type clearly (background replacement / element modification / style adjustment).
- **Temperature parameter**: Use low temperature for precise editing tasks (stable output); increase it for creative generation.
