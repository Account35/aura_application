# Text-to-Speech API — Full Specification & Code

## API Specification

| Property | Value |
|----------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-GYX1lzGw01Xa.gateway.appmedo.com/v1/audio/speech` |
| HTTP Method | `POST` |
| Request Content-Type | `application/json` |
| Auth Header | `X-Gateway-Authorization: Bearer <AUTH_VALUE>` |
| Response Content-Type | `application/octet-stream` (binary audio data returned directly) |

---

## Parameters

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `string` | Yes | The text content to convert to speech |
| `voice` | `string` | Yes | Voice type, e.g.: `heart` |
| `response_format` | `string` | No | Output audio format; supports `mp3`, `wav`, `ogg`, etc. Defaults to `mp3` |

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| (response body) | `ArrayBuffer` / `Uint8Array` | Raw binary audio data with no JSON wrapper — write directly to a file |
| Response header `Content-Type` | `string` | Value is `application/octet-stream` |

---

## Generation-time Usage (Agent Direct Call)

In the generation-time scenario (Agent direct call), the API returns **binary audio data**. The response body must be saved to a local file before it can be used by the end user.

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — key injected by the platform

async function textToSpeech(
  input: string,
  voice: string = "heart",
  responseFormat: string = "mp3"
): Promise<ArrayBuffer> {
  const response = await fetch("https://app-b0t9jb6nl2pt-api-GYX1lzGw01Xa.gateway.appmedo.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input,
      voice,
      response_format: responseFormat,
    }),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  // Response body is binary audio data — return as ArrayBuffer
  return response.arrayBuffer();
}
```

**Generation-time file download (required):**

This endpoint returns **binary audio data directly** (no URL). After obtaining the audio data in the generation-time context, you **must immediately use the Bash tool to save it to a local file** so that the user can view or play the result.

Save the binary response directly using `curl` (recommended):

```bash
curl -s -X POST "https://app-b0t9jb6nl2pt-api-GYX1lzGw01Xa.gateway.appmedo.com/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Authorization: Bearer $INTEGRATIONS_API_KEY" \
  -d '{"input": "Hello, world!", "voice": "heart", "response_format": "mp3"}' \
  -o /tmp/output.mp3
```

**Complete generation-time workflow (including save step):**

1. Make the request using the `curl` command above (or the TypeScript function)
2. Use the Bash tool to run `curl ... -o <local-path>.mp3` to save the audio locally
3. Inform the user that the file has been saved to the specified path and explain how to play it

> **Note**: Binary audio data exists only within the current response. It must be saved promptly or the data will be lost.

---

## Post-generation Usage (In-app via Edge Function)

When called from within an application, the Edge Function receives the client request, calls the upstream API, retrieves the binary audio data, uploads it to Supabase Storage, and returns a persistent public URL to the frontend.

### Edge Function Code

```typescript
// edge-functions/text-to-speech.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let input: string;
  let voice: string;
  let responseFormat: string;
  try {
    const body = await req.json();
    input = body.input;
    voice = body.voice ?? "heart";
    responseFormat = body.response_format ?? "mp3";
    if (!input) throw new Error("Missing input");
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

  // --- Call upstream ---
  const upstream = await fetch("https://app-b0t9jb6nl2pt-api-GYX1lzGw01Xa.gateway.appmedo.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input, voice, response_format: responseFormat }),
  });

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

  // --- Transfer binary audio to Supabase Storage ---
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const ext = responseFormat ?? "mp3";
  const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("generated-media")
    .upload(filePath, upstream.body!, {
      contentType,
      cacheControl: "no-cache",
      duplex: "half",
    } as RequestInit & { cacheControl: string; upsert?: boolean });

  if (error) {
    return new Response(
      JSON.stringify({ error: `Storage upload failed: ${error.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: urlData } = supabase.storage.from("generated-media").getPublicUrl(filePath);

  return new Response(
    JSON.stringify({ audioUrl: urlData.publicUrl, path: data.path }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

### Frontend Call to Edge Function

**Recommended (when supabase client is available):**

```typescript
async function fetchTextToSpeech(
  input: string,
  voice: string = "heart",
  responseFormat: string = "mp3"
) {
  const { data, error } = await supabase.functions.invoke("text-to-speech", {
    body: { input, voice, response_format: responseFormat },
  });
  if (error) throw error;
  return data as { audioUrl: string; path: string };
}
```

**Fallback (when supabase client is not available):**

```typescript
async function fetchTextToSpeech(
  input: string,
  voice: string = "heart",
  responseFormat: string = "mp3"
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, voice, response_format: responseFormat }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exhausted: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const json = await res.json();
  return json as { audioUrl: string; path: string };
}
```

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read on the Edge Function server side. Never expose it in frontend code or version control.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance) — these error bodies must be forwarded verbatim to the frontend.
- **Pricing**: Each API call costs $0.05 at the discounted rate (original price $0.10). Avoid unnecessary repeated calls for the same text (e.g., synthesizing the same content multiple times).
- **Binary response**: This endpoint does not return JSON — it returns a raw binary audio stream. In the generation-time context, the data must be saved to a file immediately after the call. In-app usage via Edge Function should upload the stream to Supabase Storage and return the URL to the frontend.
- **Voice selection**: The example value for the `voice` parameter is `heart`. Select from the available voice list as appropriate.
- **Format support**: Common values for `response_format` are `mp3` (default), `wav`, and `ogg`. Different formats vary in file size and compatibility; `mp3` is recommended for frontend playback.
