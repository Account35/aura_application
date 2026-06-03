# OCR.space — GET /parse/imageurl Endpoint Reference

## Endpoint Information

| Property | Value |
|----------|-------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-m9xKXDbRplNa.gateway.appmedo.com/parse/imageurl` |
| Content-Type | N/A (GET request; parameters passed via Query String) |
| Authentication | user_managed (API Key passed directly) |
| Auth Header | `X-Gateway-Authorization: K87649693488957` |
| Billing | Not enabled (free to use) |

> This endpoint is a simplified version of POST `/parse/image`. It **only supports image submission via URL**, making it ideal for quick integration and lightweight OCR scenarios. It is not billed and should be preferred.

### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | URL of the image or PDF file to be recognized |
| `language` | `string` | No | OCR language code, default `eng` (English). Supports: `ara` (Arabic), `chs` (Simplified Chinese), `cht` (Traditional Chinese), `eng` (English), `jpn` (Japanese), `kor` (Korean), and 28 other languages |
| `isOverlayRequired` | `boolean` | No | Whether to return text coordinate information, default `false` |

### Response Structure (200)

```json
{
  "ParsedResults": [
    {
      "FileParseExitCode": 1,
      "ParsedText": "Recognized text content",
      "TextOverlay": {
        "Lines": [
          {
            "Words": [
              {
                "WordText": "Word",
                "Left": 100,
                "Top": 50,
                "Height": 20,
                "Width": 40
              }
            ]
          }
        ]
      }
    }
  ],
  "OCRExitCode": 1,
  "IsErroredOnProcessing": false,
  "ProcessingTimeInMilliseconds": "1500"
}
```

### Response Field Descriptions

| Field Path | Type | Description |
|------------|------|-------------|
| `OCRExitCode` | `number` | OCR processing exit code: 1=success, 2=partial success, 3=failure, 4=error |
| `IsErroredOnProcessing` | `boolean` | Whether an error occurred during processing |
| `ProcessingTimeInMilliseconds` | `string` | Processing time in milliseconds |
| `ParsedResults` | `array` | Array of recognition results |
| `ParsedResults[].ParsedText` | `string` | Full recognized text content |
| `ParsedResults[].FileParseExitCode` | `number` | Individual file parse status code |
| `ParsedResults[].TextOverlay`? | `object` | Text coordinate information; only returned when `isOverlayRequired=true` |
| `ParsedResults[].TextOverlay.Lines[].Words[].WordText` | `string` | Word text |
| `ParsedResults[].TextOverlay.Lines[].Words[].Left` | `number` | Left boundary of the word (pixels) |
| `ParsedResults[].TextOverlay.Lines[].Words[].Top` | `number` | Top boundary of the word (pixels) |
| `ParsedResults[].TextOverlay.Lines[].Words[].Width` | `number` | Width of the word (pixels) |
| `ParsedResults[].TextOverlay.Lines[].Words[].Height` | `number` | Height of the word (pixels) |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const AUTH_VALUE = "K87649693488957"; // user_managed — API Key from source_context

interface OCRWord {
  WordText: string;
  Left: number;
  Top: number;
  Height: number;
  Width: number;
}

interface OCRParsedResult {
  ParsedText: string;
  FileParseExitCode: number;
  TextOverlay?: {
    Lines: Array<{ Words: OCRWord[] }>;
  };
}

interface OCRUrlResponse {
  ParsedResults: OCRParsedResult[];
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ProcessingTimeInMilliseconds: string;
}

/**
 * GET /parse/imageurl — Simplified OCR endpoint (URL-only, not billed)
 *
 * @param imageUrl          URL of the image or PDF to recognize
 * @param language          Language code, default "eng"
 * @param isOverlayRequired Whether to return coordinate information, default false
 */
async function ocrParseImageUrl(
  imageUrl: string,
  language = "eng",
  isOverlayRequired = false
): Promise<OCRUrlResponse> {
  const params = new URLSearchParams({
    url: imageUrl,
    language,
    isOverlayRequired: String(isOverlayRequired),
  });

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-m9xKXDbRplNa.gateway.appmedo.com/parse/imageurl?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": AUTH_VALUE,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: OCRUrlResponse = await response.json();

  if (json.IsErroredOnProcessing) {
    throw new Error(`OCR processing error (OCRExitCode: ${json.OCRExitCode})`);
  }
  if (json.OCRExitCode === 3 || json.OCRExitCode === 4) {
    throw new Error(`OCR failed with exit code: ${json.OCRExitCode}`);
  }

  return json;
}

// Usage example: recognize English text in an image URL
const result = await ocrParseImageUrl("https://example.com/image.jpg", "eng");
console.log(result.ParsedResults[0].ParsedText);

// Usage example: recognize text in a Chinese image
const chineseResult = await ocrParseImageUrl("https://example.com/chinese.jpg", "chs");
console.log(chineseResult.ParsedResults[0].ParsedText);
```

---

## Post-Generation Usage (Application Calls via Edge Function)

### Edge Function Code

```typescript
// edge-functions/ocr-parse-imageurl.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let imageUrl: string;
  let language: string;
  let isOverlayRequired: boolean;

  try {
    const body = await req.json();
    imageUrl = body.imageUrl;
    language = body.language ?? "eng";
    isOverlayRequired = body.isOverlayRequired ?? false;

    if (!imageUrl) throw new Error("Missing imageUrl");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body — imageUrl is required" }), {
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

  // --- Build query string ---
  const params = new URLSearchParams({
    url: imageUrl,
    language,
    isOverlayRequired: String(isOverlayRequired),
  });

  // --- Call upstream ---
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-m9xKXDbRplNa.gateway.appmedo.com/parse/imageurl?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": apiKey,
      },
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
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend Calling the Edge Function

**Recommended (when supabase client is available):**

```typescript
async function ocrFromUrl(imageUrl: string, language = "eng") {
  const { data, error } = await supabase.functions.invoke("ocr-parse-imageurl", {
    body: { imageUrl, language },
  });
  if (error) throw error;
  if (data.IsErroredOnProcessing) throw new Error(`OCR error, exit code: ${data.OCRExitCode}`);
  return data;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function ocrFromUrl(imageUrl: string, language = "eng") {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-parse-imageurl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, language }),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const json = await res.json();
  if (json.IsErroredOnProcessing) throw new Error(`OCR error, exit code: ${json.OCRExitCode}`);

  return json;
}
```
