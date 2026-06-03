# Generate Content API — Full Specification

API ID: `api-rLobRWZ712b9`
Plugin: Image Generation (Lite Version) · `a02d2a73-a173-4f8c-8565-c8df8fa929a1`

---

## Capability Overview

| Item | Value |
|------|-------|
| Method | `POST` |
| Endpoint | `https://app-b0t9jb6nl2pt-api-rLobRWZ712b9.gateway.appmedo.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent` |
| Content-Type | `application/json` |
| Auth header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |

---

## Parameter Reference

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contents` | `array` | Yes | Content blocks array supporting multimodal inputs |
| `contents[].parts` | `array` | Yes | Mixed-type array containing text and image data |
| `contents[].parts[].text` | `string` | Yes | Text instruction describing the editing intent (supports Chinese; specify operation type clearly) |
| `contents[].parts[].inlineData` | `object` | No | Original image data to be edited (may be omitted for text-to-image) |
| `contents[].parts[].inlineData.mimeType` | `string` | Yes* | Image MIME type; supports `image/jpeg`, `image/png` |
| `contents[].parts[].inlineData.data` | `string` | Yes* | Base64-encoded raw image data (recommended ≤5MB) |
| `responseModalities` | `string` | No | Controls return content type: `"image"` returns an image, `"text"` returns operation logs |
| `temperature` | `number` | No | Lower values produce more stable results (precise editing); higher values increase creativity (artistic generation) |
| `n` | `integer` | No | Number of generation results |

\* Required when `inlineData` is present

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `candidates` | `array` | Generated results array |
| `candidates[0].content.role` | `string` | Fixed value `"model"` |
| `candidates[0].content.parts` | `array` | Multimodal output array (contains thinking logs and images) |
| `candidates[0].content.parts[].text` | `string?` | Operation log text (`thought: true` entries represent the thinking process, not the final image) |
| `candidates[0].content.parts[].thought` | `boolean?` | `true` indicates a thinking-process entry — skip these when extracting the image |
| `candidates[0].content.parts[].inlineData.mimeType` | `string?` | Output image format (typically `image/png`) |
| `candidates[0].content.parts[].inlineData.data` | `string?` | Base64-encoded image data — **this is the final output** |
| `candidates[0].finishReason` | `string` | Termination reason: `STOP` / `MAX_TOKENS` / `ERROR` |
| `usageMetadata.promptTokenCount` | `integer` | Total input tokens (image + text) |
| `usageMetadata.candidatesTokenCount` | `integer` | Total output tokens |
| `usageMetadata.totalTokenCount` | `integer` | Cumulative token consumption |
| `usageMetadata.trafficType` | `string?` | Billing mode (`ON_DEMAND` for pay-as-you-go) |
| `usageMetadata.promptTokensDetails` | `array` | Input token breakdown by modality |
| `usageMetadata.candidatesTokensDetails` | `array` | Output token breakdown by modality |
| `usageMetadata.thoughtsTokenCount` | `integer` | Thinking process token count |
| `modelVersion` | `string` | Model version identifier |
| `createTime` | `string` | Response creation time (ISO 8601, UTC) |
| `responseId` | `string` | Unique response ID |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed key injected by platform

interface ImagePart {
  inlineData: { mimeType: string; data: string };
}

interface TextPart {
  text: string;
}

interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

async function generateOrEditImage(
  instruction: string,
  sourceImageBase64?: string,
  sourceMimeType: string = "image/jpeg",
  options?: { temperature?: number; responseModalities?: string; n?: number }
): Promise<GenerateImageResult> {
  const parts: (TextPart | ImagePart)[] = [{ text: instruction }];

  if (sourceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: sourceMimeType,
        data: sourceImageBase64,
      },
    });
  }

  const body: Record<string, unknown> = {
    contents: [{ parts }],
  };
  if (options?.responseModalities) body.responseModalities = options.responseModalities;
  if (options?.temperature !== undefined) body.temperature = options.temperature;
  if (options?.n !== undefined) body.n = options.n;

  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-rLobRWZ712b9.gateway.appmedo.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();

  // Extract the image part (skip thought: true entries)
  const parts_out = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts_out.find(
    (p: { thought?: boolean; inlineData?: { data: string; mimeType: string } }) =>
      !p.thought && p.inlineData?.data
  );

  if (!imagePart) throw new Error("No image part found in response");

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
    usageMetadata: json.usageMetadata,
  };
}
```

**Generation-time file saving (required):**

This API returns **Base64-encoded image data** directly (no URL). After obtaining the Base64 data at generation time, **you must immediately use the Bash tool to decode and save it locally** so the user can view the result.

```bash
echo "<base64_data>" | base64 -d > output.png
```

**Complete generation-time workflow (including save step):**

1. Call `generateOrEditImage(instruction, sourceImageBase64?, mimeType?)` to obtain `imageBase64`
2. Use the Bash tool to decode and save the Base64 data: `echo "<imageBase64>" | base64 -d > <local_path>.png`
3. Notify the user that the file has been saved to the corresponding path

> **Note**: Base64 data exists only in the current response — save it immediately or the data will be lost.

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function

```typescript
// edge-functions/gemini-image-generation-lite.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let instruction: string;
  let imageBase64: string | undefined;
  let mimeType: string;
  let temperature: number | undefined;
  let responseModalities: string | undefined;

  try {
    const body = await req.json();
    instruction = body.instruction;
    if (!instruction) throw new Error("Missing instruction");
    imageBase64 = body.imageBase64;          // optional for text-to-image
    mimeType = body.mimeType ?? "image/jpeg";
    temperature = body.temperature;
    responseModalities = body.responseModalities;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Build upstream request body ---
  const parts: unknown[] = [{ text: instruction }];
  if (imageBase64) {
    parts.push({ inlineData: { mimeType, data: imageBase64 } });
  }

  const upstreamBody: Record<string, unknown> = { contents: [{ parts }] };
  if (temperature !== undefined) upstreamBody.temperature = temperature;
  if (responseModalities) upstreamBody.responseModalities = responseModalities;

  // --- Call upstream ---
  const upstream = await fetch(
    "https://app-b0t9jb6nl2pt-api-rLobRWZ712b9.gateway.appmedo.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    }
  );

  // Forward quota/balance errors verbatim
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();

  // Extract image part (skip thought entries)
  const parts_out = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts_out.find(
    (p: { thought?: boolean; inlineData?: { data: string; mimeType: string } }) =>
      !p.thought && p.inlineData?.data
  );

  if (!imagePart) {
    return new Response(JSON.stringify({ error: "No image returned by upstream" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      usageMetadata: data.usageMetadata,
      finishReason: data.candidates?.[0]?.finishReason,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
```

### Frontend → Edge Function

**Recommended approach (when supabase client is available):**

```typescript
interface GenerateImageResponse {
  imageBase64: string;
  mimeType: string;
  usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
  finishReason: string;
}

async function callGeminiImageGeneration(
  instruction: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<GenerateImageResponse> {
  const { data, error } = await supabase.functions.invoke("gemini-image-generation-lite", {
    body: { instruction, imageBase64, mimeType },
  });
  if (error) throw error;
  return data as GenerateImageResponse;
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function callGeminiImageGeneration(
  instruction: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<GenerateImageResponse> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-image-generation-lite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, imageBase64, mimeType }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  return res.json() as Promise<GenerateImageResponse>;
}
```

**Rendering the returned Base64 image in the frontend:**

```typescript
// React example
<img
  src={`data:${result.mimeType};base64,${result.imageBase64}`}
  alt="Generated image"
/>
```

---

## Notes

- **Thought entry filtering**: Entries with `thought: true` in the `parts` array are internal logs and do not contain the final image — always filter with `!p.thought && p.inlineData?.data`.
- **Image size**: Recommend input images ≤5MB; high-resolution output images consume more output tokens.
- **Token billing**: IMAGE modality tokens are calculated independently (approximately 500–1000 tokens/MB); Chinese text is approximately 2–3 tokens per character.
- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in the Edge Function — never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance) and notify the user.
- **Billing note**: Discounted price ¥10.10 / unit — avoid retry loops to prevent unexpected charges.
