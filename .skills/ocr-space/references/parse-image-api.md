# OCR.space — POST /parse/image Endpoint Reference

## Endpoint Information

| Property | Value |
|----------|-------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-W9z3M6eONl3L.gateway.appmedo.com/parse/image` |
| Content-Type | `multipart/form-data` |
| Authentication | user_managed (API Key passed directly) |
| Auth Header | `X-Gateway-Authorization: K87649693488957` |
| Billing | Enabled, per-call billing, list price ¥0.00 (currently free) |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Conditionally required | URL of the image or PDF file (`url`/`file`/`base64Image` — one of the three must be provided) |
| `file` | `binary` | Conditionally required | Uploaded image or PDF file (binary format) |
| `base64Image` | `string` | Conditionally required | Base64-encoded image data; must include data type prefix such as `data:image/jpeg;base64,` |
| `language` | `string` | No | OCR language code, default `eng`; supports 30+ languages: `ara`/`chs`/`cht`/`eng`/`jpn`/`kor`, etc. |
| `isOverlayRequired` | `boolean` | No | Whether to return text coordinate information, default `false` |
| `detectOrientation` | `boolean` | No | Whether to auto-rotate the image and detect orientation, default `false` |
| `isTable` | `boolean` | No | Whether to return text by rows for table OCR, default `false` |
| `OCREngine` | `integer` | No | OCR engine selection: `1` (multi-language support) or `2` (automatic language detection), default `1` |
| `isCreateSearchablePdf` | `boolean` | No | Whether to generate a searchable PDF, default `false`; when enabled the response includes `SearchablePDFURL` |
| `isSearchablePdfHideTextLayer` | `boolean` | No | Whether to hide the text layer in the generated searchable PDF, default `false` |
| `scale` | `boolean` | No | Whether to scale the image to improve recognition accuracy, default `false` |

### Response Structure (200)

```json
{
  "ParsedResults": [
    {
      "TextOverlay": {
        "Lines": [
          {
            "Words": [
              {
                "WordText": "Recognized text",
                "Left": 100,
                "Top": 50,
                "Height": 20,
                "Width": 80
              }
            ],
            "MaxHeight": 20,
            "MinTop": 50
          }
        ],
        "HasOverlay": true
      },
      "ParsedText": "Complete recognized text content",
      "FileParseExitCode": 1,
      "ErrorMessage": null
    }
  ],
  "OCRExitCode": 1,
  "IsErroredOnProcessing": false,
  "ProcessingTimeInMilliseconds": "1500",
  "SearchablePDFURL": "https://..."
}
```

### Response Field Descriptions

| Field Path | Type | Description |
|------------|------|-------------|
| `OCRExitCode` | `number` | OCR processing exit code: 1=success, 2=partial success, 3=failure, 4=error |
| `IsErroredOnProcessing` | `boolean` | Whether an error occurred during processing |
| `ProcessingTimeInMilliseconds` | `string` | Processing time in milliseconds |
| `ParsedResults` | `array` | Array of recognition results per page/file |
| `ParsedResults[].ParsedText` | `string` | Full recognized text content |
| `ParsedResults[].FileParseExitCode` | `number` | Individual file parse status code |
| `ParsedResults[].ErrorMessage` | `string \| null` | Error message; `null` if no error |
| `ParsedResults[].TextOverlay` | `object?` | Text coordinate information; only returned when `isOverlayRequired=true` |
| `ParsedResults[].TextOverlay.Lines[].Words[].WordText` | `string` | Word text |
| `ParsedResults[].TextOverlay.Lines[].Words[].Left` | `number` | Left boundary of the word (pixels) |
| `ParsedResults[].TextOverlay.Lines[].Words[].Top` | `number` | Top boundary of the word (pixels) |
| `ParsedResults[].TextOverlay.Lines[].Words[].Width` | `number` | Width of the word (pixels) |
| `ParsedResults[].TextOverlay.Lines[].Words[].Height` | `number` | Height of the word (pixels) |
| `SearchablePDFURL`? | `string` | Download link for the searchable PDF; only returned when `isCreateSearchablePdf=true` |

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

interface OCRLine {
  Words: OCRWord[];
  MaxHeight: number;
  MinTop: number;
}

interface OCRParsedResult {
  ParsedText: string;
  FileParseExitCode: number;
  ErrorMessage: string | null;
  TextOverlay?: {
    Lines: OCRLine[];
    HasOverlay: boolean;
  };
}

interface OCRResponse {
  ParsedResults: OCRParsedResult[];
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ProcessingTimeInMilliseconds: string;
  SearchablePDFURL?: string;
}

/**
 * POST /parse/image — Core OCR endpoint (supports URL / Base64 / advanced options)
 *
 * @param imageUrl    URL of the image or PDF (mutually exclusive with base64Image)
 * @param base64Image Base64-encoded image data (with prefix; mutually exclusive with imageUrl)
 * @param language    Language code, default "eng"
 * @param options     Optional advanced parameters
 */
async function ocrParseImage(params: {
  imageUrl?: string;
  base64Image?: string;
  language?: string;
  isOverlayRequired?: boolean;
  isTable?: boolean;
  detectOrientation?: boolean;
  OCREngine?: 1 | 2;
}): Promise<OCRResponse> {
  if (!params.imageUrl && !params.base64Image) {
    throw new Error("Must provide either imageUrl or base64Image");
  }

  const form = new FormData();
  if (params.imageUrl)     form.append("url",               params.imageUrl);
  if (params.base64Image)  form.append("base64Image",        params.base64Image);
  if (params.language)     form.append("language",           params.language);
  if (params.isOverlayRequired !== undefined) form.append("isOverlayRequired", String(params.isOverlayRequired));
  if (params.isTable !== undefined)           form.append("isTable",           String(params.isTable));
  if (params.detectOrientation !== undefined) form.append("detectOrientation", String(params.detectOrientation));
  if (params.OCREngine !== undefined)         form.append("OCREngine",         String(params.OCREngine));

  const response = await fetch("https://app-b0t9jb6nl2pt-api-W9z3M6eONl3L.gateway.appmedo.com/parse/image", {
    method: "POST",
    headers: {
      "X-Gateway-Authorization": AUTH_VALUE,
      // Content-Type is set automatically by fetch when using FormData (multipart/form-data with boundary)
    },
    body: form,
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: OCRResponse = await response.json();

  if (json.IsErroredOnProcessing) {
    const errMsg = json.ParsedResults?.[0]?.ErrorMessage ?? "Unknown OCR error";
    throw new Error(`OCR processing error: ${errMsg}`);
  }
  if (json.OCRExitCode === 3 || json.OCRExitCode === 4) {
    throw new Error(`OCR failed with exit code: ${json.OCRExitCode}`);
  }

  return json;
}

// Usage example: recognize text in an image URL
const result = await ocrParseImage({ imageUrl: "https://example.com/image.jpg", language: "eng" });
console.log(result.ParsedResults[0].ParsedText);

// Usage example: recognize a Base64 image and return coordinate overlay
const resultWithOverlay = await ocrParseImage({
  base64Image: "data:image/jpeg;base64,/9j/4AAQ...",
  isOverlayRequired: true,
});
```

---

## Post-Generation Usage (Application Calls via Edge Function)

### Edge Function Code

```typescript
// edge-functions/ocr-parse-image.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let imageUrl: string | undefined;
  let base64Image: string | undefined;
  let language: string | undefined;
  let isOverlayRequired: boolean | undefined;
  let isTable: boolean | undefined;

  try {
    const body = await req.json();
    imageUrl       = body.imageUrl;
    base64Image    = body.base64Image;
    language       = body.language;
    isOverlayRequired = body.isOverlayRequired;
    isTable        = body.isTable;

    if (!imageUrl && !base64Image) {
      throw new Error("Missing imageUrl or base64Image");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body — provide imageUrl or base64Image" }), {
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

  // --- Build multipart/form-data params ---
  const form = new FormData();
  if (imageUrl)     form.append("url",               imageUrl);
  if (base64Image)  form.append("base64Image",        base64Image);
  if (language)     form.append("language",           language);
  if (isOverlayRequired !== undefined) form.append("isOverlayRequired", String(isOverlayRequired));
  if (isTable !== undefined)           form.append("isTable",           String(isTable));

  // --- Call upstream ---
  const upstream = await fetch("https://app-b0t9jb6nl2pt-api-W9z3M6eONl3L.gateway.appmedo.com/parse/image", {
    method: "POST",
    headers: {
      "X-Gateway-Authorization": apiKey,
      // Content-Type is set automatically by fetch when using FormData (multipart/form-data with boundary)
    },
    body: form,
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
async function ocrParseImage(params: {
  imageUrl?: string;
  base64Image?: string;
  language?: string;
  isOverlayRequired?: boolean;
  isTable?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke("ocr-parse-image", {
    body: params,
  });
  if (error) throw error;
  if (data.IsErroredOnProcessing) throw new Error(`OCR error: ${data.ParsedResults?.[0]?.ErrorMessage}`);
  return data;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function ocrParseImage(params: {
  imageUrl?: string;
  base64Image?: string;
  language?: string;
  isOverlayRequired?: boolean;
}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-parse-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
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
  if (json.IsErroredOnProcessing) throw new Error(`OCR error: ${json.ParsedResults?.[0]?.ErrorMessage}`);

  return json;
}
```
