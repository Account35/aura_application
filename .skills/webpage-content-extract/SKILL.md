---
name: webpage-content-extract
description: Extract clean article text, metadata, and structured data from any web page URL using the Diffbot Article API. Use this skill whenever the user wants to read, summarize, or analyze a webpage, extract article content, author, publication date, images, tags, or sentiment from a news article or blog post.
license: MIT
---

## Overview

Extract structured article content from any web page URL using the Diffbot Article API, including body text, cleaned HTML, author, publication date, images, tags, categories, and sentiment scores. Also supports directly submitting an HTML string for extraction without remote fetching.

- **Endpoint**: `GET/POST https://app-b0t9jb6nl2pt-api-Q9KWZ8R7Qv09.gateway.appmedo.com/v3/article`
- **Core capabilities**: Automatically extract body content and related metadata from news articles, blog posts, and long-form pages; supports comment extraction, quote extraction, and summary generation
- **Limitations**: Each request corresponds to a single URL; the `quotes` field only supports English-language pages; `discussion` (comments) is enabled by default — disable it explicitly when comments are not needed to improve response speed

**Response example:**

```json
{
  "request": {
    "pageUrl": "https://example.com/article",
    "api": "article",
    "version": 3
  },
  "humanLanguage": "en",
  "objects": [
    {
      "title": "Article Title",
      "text": "Extracted plain text content",
      "html": "Cleaned HTML content",
      "author": "Author Name",
      "date": "Publication Date",
      "siteName": "Site Name",
      "images": [{ "url": "https://example.com/image.jpg", "primary": true }],
      "tags": [{ "label": "Technology", "score": 0.95 }],
      "sentiment": 0.5,
      "pageUrl": "https://example.com/article"
    }
  ]
}
```

---

## Usage During Generation (Direct Agent Call)

This API uses `user_managed` authentication — the Access Key is provided by the plugin creator and passed as the `X-Gateway-Authorization` request header.

```typescript
const AUTH_VALUE = "c9648ace061426be55d2079f80d0235c"; // user_managed: use the API Key from the plugin configuration

interface ArticleImage {
  url: string;
  primary?: boolean;
  width?: number;
  height?: number;
  caption?: string;
}

interface ArticleTag {
  label: string;
  score: number;
  sentiment?: number;
  uri?: string;
}

interface ArticleObject {
  title?: string;
  text?: string;
  html?: string;
  author?: string;
  authors?: Array<{ name: string; link?: string }>;
  date?: string;
  siteName?: string;
  pageUrl?: string;
  images?: ArticleImage[];
  tags?: ArticleTag[];
  categories?: Array<{ name: string; score: number }>;
  sentiment?: number;
  quotes?: Array<{ quote: string; speaker?: string }>;
  discussion?: object;
}

interface ArticleResponse {
  request: { pageUrl: string; api: string; version: number };
  humanLanguage?: string;
  objects: ArticleObject[];
}

async function callWebpageContentExtract(
  url: string,
  options?: {
    fields?: string;          // comma-separated, e.g. "title,text,author,date,images"
    discussion?: boolean;     // extract comments, default true
    quotes?: boolean;         // extract quotes (English only)
    summaryNumSentences?: number; // max sentences in generated summary, default 3
    html?: string;            // POST: directly submit HTML for extraction
    text?: string;            // POST: directly submit plain text for extraction
  }
): Promise<ArticleResponse> {
  const params = new URLSearchParams({ url });
  if (options?.fields !== undefined)              params.set("fields",              options.fields);
  if (options?.discussion !== undefined)          params.set("discussion",          String(options.discussion));
  if (options?.quotes !== undefined)              params.set("quotes",              String(options.quotes));
  if (options?.summaryNumSentences !== undefined) params.set("summaryNumSentences", String(options.summaryNumSentences));

  const hasBody = options?.html !== undefined || options?.text !== undefined;

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-Q9KWZ8R7Qv09.gateway.appmedo.com/v3/article?${params.toString()}`,
    {
      method: hasBody ? "POST" : "GET",
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        "X-Gateway-Authorization": AUTH_VALUE,
      },
      ...(hasBody
        ? { body: JSON.stringify({ html: options?.html, text: options?.text }) }
        : {}),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  return response.json() as Promise<ArticleResponse>;
}
```

**Usage examples:**

```typescript
// Extract article content from a URL (GET)
const result = await callWebpageContentExtract("https://www.example.com/article");
const article = result.objects[0];
console.log(article.title);
console.log(article.text);
console.log(article.author);

// Fetch only specific fields with comment extraction disabled (faster)
const lean = await callWebpageContentExtract(
  "https://www.example.com/news",
  { fields: "title,text,author,date", discussion: false }
);

// Get article summary (up to 2 sentences)
const summary = await callWebpageContentExtract(
  "https://www.example.com/news",
  { fields: "title,summary", summaryNumSentences: 2, discussion: false }
);

// Directly submit HTML for extraction (POST)
const fromHtml = await callWebpageContentExtract(
  "https://www.example.com",
  { html: "<html><body><h1>Title</h1><p>Content...</p></body></html>", discussion: false }
);

// Iterate over results
result.objects.forEach((obj) => {
  console.log(`Title: ${obj.title}`);
  console.log(`Author: ${obj.author}`);
  console.log(`Sentiment score: ${obj.sentiment}`);
  obj.tags?.forEach((t) => console.log(`  Tag: ${t.label} (${t.score.toFixed(2)})`));
});
```

---

## Usage After Generation (Calling via Edge Function Inside the App)

At application runtime, proxy requests through an Edge Function to protect authentication credentials.

### Edge Function

```typescript
// edge-functions/webpage-content-extract.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let url: string;
  let fields: string | undefined;
  let discussion: string | undefined;
  let quotes: string | undefined;
  let summaryNumSentences: string | undefined;
  let html: string | undefined;
  let text: string | undefined;

  try {
    const body = await req.json();
    url = body.url;
    if (!url) throw new Error("Missing url");
    fields              = body.fields;
    discussion          = body.discussion !== undefined ? String(body.discussion) : undefined;
    quotes              = body.quotes !== undefined ? String(body.quotes) : undefined;
    summaryNumSentences = body.summaryNumSentences !== undefined ? String(body.summaryNumSentences) : undefined;
    html                = body.html;
    text                = body.text;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject user-managed credentials (not exposed to the client) ---
  const apiKey = Deno.env.get("DIFFBOT_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error: DIFFBOT_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Build query parameters ---
  const params = new URLSearchParams({ url });
  if (fields)              params.set("fields",              fields);
  if (discussion)          params.set("discussion",          discussion);
  if (quotes)              params.set("quotes",              quotes);
  if (summaryNumSentences) params.set("summaryNumSentences", summaryNumSentences);

  const hasBody = html !== undefined || text !== undefined;

  // --- Call upstream ---
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-Q9KWZ8R7Qv09.gateway.appmedo.com/v3/article?${params.toString()}`,
    {
      method: hasBody ? "POST" : "GET",
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        "X-Gateway-Authorization": apiKey,
      },
      ...(hasBody ? { body: JSON.stringify({ html, text }) } : {}),
    }
  );

  // Pass through quota/balance errors
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
async function fetchWebpageContentExtract(
  url: string,
  options?: {
    fields?: string;
    discussion?: boolean;
    quotes?: boolean;
    summaryNumSentences?: number;
    html?: string;
    text?: string;
  }
) {
  const { data, error } = await supabase.functions.invoke("webpage-content-extract", {
    body: { url, ...options },
  });
  if (error) throw error;
  return data; // { request, humanLanguage, objects }
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function fetchWebpageContentExtract(
  url: string,
  options?: {
    fields?: string;
    discussion?: boolean;
    quotes?: boolean;
    summaryNumSentences?: number;
    html?: string;
    text?: string;
  }
) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webpage-content-extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, ...options }),
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

  return res.json(); // { request, humanLanguage, objects }
}
```

---

## Parameter Reference

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | URL of the article page to extract content from |
| `fields` | `string` | No | Specify return fields, comma-separated, e.g. `"title,text,author,date,images"` |
| `discussion` | `boolean` | No | Whether to extract comments; default `true`. Set to `false` when comments are not needed for faster responses |
| `quotes` | `boolean` | No | Whether to return quotes from the article (English only) |
| `summaryNumSentences` | `integer` | No | Maximum number of sentences in the generated summary; default `3` |
| `html` | `string` | No | POST only: directly submit HTML content for extraction (skips remote URL fetching) |
| `text` | `string` | No | POST only: directly submit plain text content for extraction |

### Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `request.pageUrl` | `string` | The requested page URL |
| `request.api` | `string` | API name (`"article"`) |
| `request.version` | `number` | API version number |
| `humanLanguage?` | `string` | Page language code (e.g. `"en"`, `"zh"`) |
| `objects` | `array` | List of extracted article objects (typically one element) |
| `objects[].title?` | `string` | Article title |
| `objects[].text?` | `string` | Extracted plain text body |
| `objects[].html?` | `string` | Cleaned HTML body |
| `objects[].author?` | `string` | Author name (primary author) |
| `objects[].authors?` | `array` | Author list with name and link |
| `objects[].date?` | `string` | Publication date |
| `objects[].siteName?` | `string` | Site name |
| `objects[].pageUrl?` | `string` | Article page URL |
| `objects[].images?` | `array` | Image list with `url`, `primary`, width, height, and caption |
| `objects[].tags?` | `array` | Tag list with `label`, `score`, `sentiment`, and `uri` |
| `objects[].categories?` | `array` | Category information with `name` and `score` |
| `objects[].sentiment?` | `number` | Sentiment score (-1.0 to 1.0; positive values indicate positive sentiment) |
| `objects[].quotes?` | `array` | List of quotes from the article (requires enablement; English only) |
| `objects[].discussion?` | `object` | Comment section data (requires enablement) |

---

## Notes

- **Key security**: `DIFFBOT_API_KEY` must be set as a Supabase Edge Function secret and must never be exposed to the frontend. The `AUTH_VALUE` embedded in the generation-time call contains credentials — do not commit it to a public repository.
- **Error handling**: Always handle `429` (quota exceeded) and `402` (insufficient balance); these error bodies are passed through to the client as-is.
- **Billing**: This plugin is currently free to call (`original_price: "0.00"`); caching results and avoiding repeated calls for the same URL is still recommended.
- **`discussion` is enabled by default**: Diffbot crawls and parses the comment section by default, which increases response time. Pass `discussion: false` explicitly when comment data is not needed.
- **`quotes` is English only**: Enabling the `quotes` parameter for Chinese or other non-English pages will not return valid data.
- **POST vs GET**: GET requires Diffbot to remotely fetch the URL; POST (with `html` or `text`) parses local content directly, which is faster and requires no network access — ideal when you already have the HTML.
- **`objects` array**: The response `objects` array typically contains only one element; access `result.objects[0]` for the main article object and check that the array is non-empty before accessing it.
