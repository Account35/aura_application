---
name: google-text-translation
description: Translate text between languages using Google Cloud Translation API. Use this skill whenever the user wants to translate text, detect a source language, or convert content between languages — including bulk translation, multilingual form handling, or any i18n/localization task in an app.
license: MIT
---

# Google Text Translation

## Capability Overview

Translate any text into a specified target language via the Google Cloud Translation Advanced API, with automatic source language detection supported.

| Item | Details |
|------|---------|
| Endpoint | `POST https://app-b0t9jb6nl2pt-api-GaDwZ8DX7jPY.gateway.appmedo.com/language/translate/v2` |
| Auth | platform_managed — key injected via `INTEGRATIONS_API_KEY` |
| Billing | Original price ¥0.50 / call, discount price ¥0.40 / call |

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Text content to be translated |
| `target` | `string` | Yes | Target language code, e.g. `zh` (Chinese), `es` (Spanish), `fr` (French) |
| `source` | `string` | No | Source language code; omit to enable automatic detection |
| `format` | `string` | No | Text format: `"text"` (default) or `"html"` |

**Response Example:**

```json
{
  "data": {
    "translations": [
      {
        "translatedText": "你好，世界！",
        "detectedSourceLanguage": "en"
      }
    ]
  }
}
```

**Capability Limitations:**
- Each request supports only a single text segment (`q` is a single string)
- Translation responses are synchronous, not streaming
- Language codes must conform to BCP-47 / ISO 639-1 standards

---

## Generation-Time Usage (Agent Direct Call)

> Use case: The Agent calls the API directly during generation to complete a translation task, returning the result as text to the user.

```typescript
// platform_managed — key is injected by the platform at runtime
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface TranslateParams {
  q: string;           // Text to translate
  target: string;      // Target language code, e.g. "zh", "en", "fr"
  source?: string;     // Source language code (optional; omit for auto-detection)
  format?: "text" | "html"; // Text format (default "text")
}

interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

async function translateText(params: TranslateParams): Promise<TranslationResult[]> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-GaDwZ8DX7jPY.gateway.appmedo.com/language/translate/v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        q: params.q,
        target: params.target,
        ...(params.source && { source: params.source }),
        ...(params.format && { format: params.format }),
      }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  // Google Translation API returns data directly (no code/msg wrapper)
  return json.data.translations as TranslationResult[];
}

// Usage example
const results = await translateText({ q: "Hello, world!", target: "zh" });
console.log(results[0].translatedText);          // "你好，世界！"
console.log(results[0].detectedSourceLanguage);  // "en" (returned when auto-detection is active)
```

---

## Post-Generation Usage (In-App via Edge Function)

> Use case: Invoking the translation feature from within a frontend application. The Edge Function acts as a proxy to ensure the API key is never exposed to the browser.

### Edge Function (`edge-functions/google-text-translation.ts`)

```typescript
// edge-functions/google-text-translation.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let q: string;
  let target: string;
  let source: string | undefined;
  let format: string | undefined;

  try {
    const body = await req.json();
    q = body.q;
    target = body.target;
    source = body.source;
    format = body.format;
    if (!q) throw new Error("Missing q");
    if (!target) throw new Error("Missing target");
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
  const requestBody: Record<string, string> = { q, target };
  if (source) requestBody.source = source;
  if (format) requestBody.format = format;

  const upstream = await fetch(
    "https://app-b0t9jb6nl2pt-api-GaDwZ8DX7jPY.gateway.appmedo.com/language/translate/v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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

**Recommended approach (when supabase client is available):**

```typescript
async function translateText(q: string, target: string, source?: string, format?: string) {
  const { data, error } = await supabase.functions.invoke("google-text-translation", {
    body: { q, target, source, format },
  });
  if (error) throw error;
  return data.data.translations as Array<{ translatedText: string; detectedSourceLanguage?: string }>;
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function translateText(q: string, target: string, source?: string, format?: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-text-translation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, target, source, format }),
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

  const json = await res.json();
  return json.data.translations as Array<{ translatedText: string; detectedSourceLanguage?: string }>;
}
```

---

## Parameter Reference

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Text content to be translated |
| `target` | `string` | Yes | Target language code (BCP-47), e.g. `zh`, `en`, `es`, `fr`, `ja` |
| `source` | `string` | No | Source language code; omit to let the API auto-detect |
| `format` | `string` | No | Text format: `"text"` (default) or `"html"` |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `data.translations` | `array` | Array of translation results (currently always a single element) |
| `data.translations[0].translatedText` | `string` | The translated text |
| `data.translations[0].detectedSourceLanguage?` | `string` | Auto-detected source language code (only returned when `source` is not specified) |

---

## Notes

- **Key Security**: `INTEGRATIONS_API_KEY` may only be read server-side in the Edge Function and must never be exposed to the frontend.
- **Error Handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance); these error bodies are forwarded verbatim by the Edge Function.
- **Billing**: This plugin is billed per call — discount price ¥0.40 / call (original price ¥0.50). Confirm that text actually needs translation before calling to avoid unnecessary repeated requests.
- **Language Codes**: Target/source languages must use BCP-47 or ISO 639-1 codes (e.g. `zh`, `en`, `fr`, `ja`, `ko`, `de`); full language names are not accepted.
- **HTML Translation**: If the text contains HTML tags, set `format: "html"` to preserve tag structure and translate only the visible text content.
- **Single Text Per Request**: The current API endpoint translates one text segment per request (`q` is a single string); batch translation requires multiple calls.
