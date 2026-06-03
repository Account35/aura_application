# Speech-to-Text API — Full Specification & Code

## API Specification

| Property | Value |
|----------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com/v1/audio/transcriptions` |
| HTTP Method | `POST` |
| Request Content-Type | `multipart/form-data` (file upload) or `application/x-www-form-urlencoded` (URL submission) |
| Auth Header | `X-Gateway-Authorization: Bearer <AUTH_VALUE>` |
| Response Content-Type | `application/json` (for `json` / `verbose_json` formats); `text/plain` (for `text`, `srt`, `vtt` formats) |

---

## Parameters

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | `string/binary` | Yes | Audio file object or public URL. Upload limit: 100 MB; URL submission limit: 1 GB. Supported formats: mp3, wav, flac, aac, opus, ogg, m4a, mp4, mpeg, mov, webm, and more |
| `response_format` | `string` | No | Response format: `json` (default), `text`, `srt`, `verbose_json`, `vtt` |
| `speaker_labels` | `boolean` | No | Enable speaker diarization. Requires `response_format=verbose_json` to access speaker labels in the response |
| `min_speakers` | `integer` | No | Minimum number of speakers; use with `speaker_labels=true` to improve accuracy |
| `max_speakers` | `integer` | No | Maximum number of speakers; use with `speaker_labels=true` |
| `prompt` | `string` | No | Text to guide the transcription style or continue a previous transcript. Must be in the same language as the audio. Useful for correcting proper nouns (e.g., "NFT, DeFi, DAO") |
| `language` | `string` | No | Audio language (e.g., `english`, `chinese`). Auto-detected if omitted; specifying a language improves accuracy and speed |
| `callback_url` | `string` | No | Async callback URL. The API will POST the result to this URL when transcription completes — useful for long audio files |
| `translate` | `boolean` | No | Set to `true` to translate the audio content to English |
| `timestamp_granularities[]` | `array` | No | Enable word-level timestamps by passing `["word"]`. Requires `response_format=verbose_json` |

### Response Fields

**`response_format=json` (default):**

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Full transcribed text |

**`response_format=verbose_json`:**

| Field | Type | Description |
|-------|------|-------------|
| `task` | `string` | Task type, always `"transcribe"` |
| `language` | `string` | Detected audio language (e.g., `"en"`) |
| `duration` | `number` | Audio duration in seconds |
| `text` | `string` | Full transcribed text |
| `segments[].id` | `number` | Segment index |
| `segments[].text` | `string` | Text content of the segment |
| `segments[].start` | `number` | Segment start time in seconds |
| `segments[].end` | `number` | Segment end time in seconds |
| `segments[].language` | `string` | Segment language |
| `segments[].speaker`? | `string` | Speaker label, e.g., `"SPEAKER_00"` (present when `speaker_labels=true`) |
| `segments[].words[].word` | `string` | Word text (present when `timestamp_granularities[]=word`) |
| `segments[].words[].start` | `number` | Word start time in seconds |
| `segments[].words[].end` | `number` | Word end time in seconds |
| `segments[].words[].speaker`? | `string` | Speaker label for this word |

**`response_format=text`:** Returns a plain text string (not JSON).

**`response_format=srt` / `vtt`:** Returns a subtitle file format string (not JSON) that can be used directly in video players.

**Example response (`response_format=json`, default):**

```json
{
  "text": "Artificial intelligence is the intelligence of machines or software..."
}
```

**Example response (`response_format=verbose_json`, with speaker labels):**

```json
{
  "task": "transcribe",
  "language": "en",
  "duration": 13.17,
  "text": "Artificial intelligence is the intelligence of machines...",
  "segments": [
    {
      "id": 0,
      "text": "Artificial intelligence is the intelligence of machines or software...",
      "start": 0.1,
      "end": 6.42,
      "language": "en",
      "speaker": "SPEAKER_00",
      "words": [
        { "word": "Artificial", "start": 0.1, "end": 0.561, "speaker": "SPEAKER_00" }
      ]
    }
  ]
}
```

---

## Generation-time Usage (Agent Direct Call)

The platform injects the API key via the environment variable — no user-supplied key is needed.

### Submit Audio via URL (Recommended)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — key injected by the platform

interface TranscriptionOptions {
  fileUrl: string;             // Public URL of the audio file (max 1 GB)
  language?: string;           // e.g., "english", "chinese"; auto-detected if omitted
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt"; // default: "json"
  speakerLabels?: boolean;     // Enable speaker diarization (requires verbose_json)
  minSpeakers?: number;        // Min speaker count (use with speakerLabels)
  maxSpeakers?: number;        // Max speaker count (use with speakerLabels)
  prompt?: string;             // Prompt to guide transcription style
  translate?: boolean;         // Translate audio to English
  callbackUrl?: string;        // Async callback URL
  timestampGranularities?: string[]; // e.g., ["word"], requires verbose_json
}

interface TranscriptionResult {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    text: string;
    start: number;
    end: number;
    language?: string;
    speaker?: string;
    words?: Array<{ word: string; start: number; end: number; speaker?: string }>;
  }>;
}

async function transcribeAudio(options: TranscriptionOptions): Promise<TranscriptionResult> {
  const params: Record<string, string> = {
    file: options.fileUrl,
  };
  if (options.language)             params.language = options.language;
  if (options.responseFormat)       params.response_format = options.responseFormat;
  if (options.speakerLabels)        params.speaker_labels = "true";
  if (options.minSpeakers != null)  params.min_speakers = String(options.minSpeakers);
  if (options.maxSpeakers != null)  params.max_speakers = String(options.maxSpeakers);
  if (options.prompt)               params.prompt = options.prompt;
  if (options.translate)            params.translate = "true";
  if (options.callbackUrl)          params.callback_url = options.callbackUrl;
  if (options.timestampGranularities) {
    // API expects repeated keys: timestamp_granularities[]=word
    params["timestamp_granularities[]"] = options.timestampGranularities.join(",");
  }

  const response = await fetch("https://app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  // The API returns plain text for response_format=text/srt/vtt,
  // and JSON for response_format=json/verbose_json
  const format = options.responseFormat ?? "json";
  if (format === "text" || format === "srt" || format === "vtt") {
    const text = await response.text();
    return { text };
  }

  const json = await response.json();
  return json;
}
```

### Upload a Local File (multipart/form-data)

When a local file must be uploaded, use `FormData` instead of `URLSearchParams`:

```typescript
async function transcribeLocalFile(
  filePath: string,
  fileBuffer: Buffer,
  fileName: string,
  options: Omit<TranscriptionOptions, "fileUrl"> = {}
): Promise<TranscriptionResult> {
  const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), fileName);
  if (options.language)             formData.append("language", options.language);
  if (options.responseFormat)       formData.append("response_format", options.responseFormat);
  if (options.speakerLabels)        formData.append("speaker_labels", "true");
  if (options.minSpeakers != null)  formData.append("min_speakers", String(options.minSpeakers));
  if (options.maxSpeakers != null)  formData.append("max_speakers", String(options.maxSpeakers));
  if (options.prompt)               formData.append("prompt", options.prompt);
  if (options.translate)            formData.append("translate", "true");
  if (options.timestampGranularities) {
    // Append each granularity value separately to correctly form repeated keys
    for (const g of options.timestampGranularities) {
      formData.append("timestamp_granularities[]", g);
    }
  }

  const response = await fetch("https://app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      // DO NOT set Content-Type manually — let fetch set the multipart boundary automatically
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const format = options.responseFormat ?? "json";
  if (format === "text" || format === "srt" || format === "vtt") {
    return { text: await response.text() };
  }
  return await response.json();
}
```

---

## Post-generation Usage (In-app via Edge Function)

When called from within an application, requests must be proxied through an Edge Function to keep the platform key out of the frontend.

### Edge Function (`edge-functions/speech-to-text.ts`)

```typescript
// edge-functions/speech-to-text.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let fileUrl: string;
  let language: string | undefined;
  let responseFormat: string | undefined;
  let speakerLabels: boolean | undefined;
  let minSpeakers: number | undefined;
  let maxSpeakers: number | undefined;
  let prompt: string | undefined;
  let translate: boolean | undefined;
  let callbackUrl: string | undefined;
  let timestampGranularities: string[] | undefined;

  try {
    const body = await req.json();
    fileUrl = body.fileUrl;
    if (!fileUrl) throw new Error("Missing fileUrl");
    language               = body.language;
    responseFormat         = body.responseFormat ?? "json";
    speakerLabels          = body.speakerLabels;
    minSpeakers            = body.minSpeakers;
    maxSpeakers            = body.maxSpeakers;
    prompt                 = body.prompt;
    translate              = body.translate;
    callbackUrl            = body.callbackUrl;
    // Accept timestampGranularities as a JSON array, e.g. ["word"]
    if (Array.isArray(body.timestampGranularities)) {
      timestampGranularities = body.timestampGranularities;
    }
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

  // --- Build request params ---
  const params: Record<string, string> = { file: fileUrl, response_format: responseFormat ?? "json" };
  if (language)             params.language = language;
  if (speakerLabels)        params.speaker_labels = "true";
  if (minSpeakers != null)  params.min_speakers = String(minSpeakers);
  if (maxSpeakers != null)  params.max_speakers = String(maxSpeakers);
  if (prompt)               params.prompt = prompt;
  if (translate)            params.translate = "true";
  if (callbackUrl)          params.callback_url = callbackUrl;
  // Forward timestamp_granularities[] as a repeated URL parameter key
  if (timestampGranularities && timestampGranularities.length > 0) {
    params["timestamp_granularities[]"] = timestampGranularities.join(",");
  }

  // --- Call upstream ---
  const upstream = await fetch("https://app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: new URLSearchParams(params).toString(),
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

  // For text/srt/vtt formats, upstream returns plain text
  const fmt = params.response_format;
  if (fmt === "text" || fmt === "srt" || fmt === "vtt") {
    const text = await upstream.text();
    return new Response(JSON.stringify({ text }), {
      status: 200,
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

### Frontend Call to Edge Function

**Recommended (when supabase client is available):**

```typescript
async function transcribeAudio(params: {
  fileUrl: string;
  language?: string;
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
  speakerLabels?: boolean;
  minSpeakers?: number;
  maxSpeakers?: number;
  prompt?: string;
  translate?: boolean;
  timestampGranularities?: string[]; // e.g., ["word"]
}) {
  const { data, error } = await supabase.functions.invoke("speech-to-text", {
    body: params,
  });
  if (error) throw error;
  return data; // { text: string } or verbose_json shape
}
```

**Fallback (when supabase client is not available):**

```typescript
async function transcribeAudio(params: {
  fileUrl: string;
  language?: string;
  responseFormat?: string;
  speakerLabels?: boolean;
  timestampGranularities?: string[]; // e.g., ["word"]
  minSpeakers?: number;
  maxSpeakers?: number;
  prompt?: string;
  translate?: boolean;
  callbackUrl?: string;
}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exhausted: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  return await res.json();
}
```

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read on the Edge Function server side. Never expose it in frontend code or client-side environments.
- **Error handling**: Always handle `429` (quota exceeded) and `402` (insufficient balance) responses — these error bodies are forwarded verbatim.
- **Pricing**: Each call costs $0.05 (discounted), original price $0.10. For long audio, confirm the content before calling to avoid unnecessary repeated requests.
- **Speaker diarization**: `speaker_labels=true` requires `response_format=verbose_json`; speaker labels will not appear in the response otherwise.
- **File upload vs URL**: Local files must be uploaded via `multipart/form-data` (do not set `Content-Type` manually — let fetch fill in the boundary automatically); URL submission uses `application/x-www-form-urlencoded` and is simpler.
- **EU compliance**: To process data on EU servers, replace `app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com` with `eu-app-b0t9jb6nl2pt-api-DY8MNQoqOnMa.gateway.appmedo.com`. Note: EU processing incurs a 20% surcharge (i.e., $0.60 per 3 hours instead of $0.50).
- **Async transcription**: For longer audio (tens of minutes or more), use the `callback_url` parameter to trigger async transcription and avoid request timeouts.
- **Subtitle generation**: `srt` and `vtt` formats can be used directly as video subtitle files — no additional parsing needed.
