---
name: web-search
description: Retrieve real-time web search results via the Smart Search API for fact-checking, news updates, and knowledge lookup.
license: MIT
---

## Overview

Execute web searches via the Smart Search API to obtain real-time results from the internet. Supports keyword filtering, time range, region, safe search, and pagination.

- **Endpoint**: `GET https://app-b0t9jb6nl2pt-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart`
- **Core capability**: Returns web search results for a given query; each result includes title, URL, snippet, and relevance score
- **Limitation**: One query per request; results are sourced from the Bing index, not live-crawled

**Response example:**

```json
{
  "queryContext": {
    "originalQuery": "space exploration"
  },
  "webPages": {
    "value": [
      {
        "name": "Space exploration - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Space_exploration",
        "displayUrl": "https://en.wikipedia.org/wiki/Space_exploration",
        "snippet": "Space exploration is the physical investigation of outer space by uncrewed robotic space probes and through human spaceflight. Buzz Aldrin taking a core sample ...",
        "score": 0.908165,
        "thumbnailUrl": "https://example.com/thumb.jpg",
        "dateLastCrawled": "2024-01-01T00:00:00Z",
        "siteName": "Wikipedia"
      }
    ]
  }
}
```

---

## Build-time Usage (Agent Direct Call)

This API uses `platform_managed` auth — the Access Key is injected by the platform via `process.env["INTEGRATIONS_API_KEY"]` and must never be hard-coded.

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed: injected by the platform

interface SearchResult {
  name: string;
  url: string;
  displayUrl: string;
  snippet: string;
  score: number;
  thumbnailUrl?: string;
  dateLastCrawled?: string;
  siteName?: string;
}

interface SmartSearchResponse {
  queryContext: { originalQuery: string };
  webPages: { value: SearchResult[] };
}

async function callWebSearch(
  q: string,
  options?: {
    count?: number;       // default 10
    offset?: number;      // default 0, for pagination
    freshness?: string;   // "Day" | "Week" | "Month" | "YYYY-MM-DD..YYYY-MM-DD"
    mkt?: string;         // e.g. "en-US"
    cc?: string;          // 2-char country code, e.g. "US"
    safeSearch?: "Off" | "Moderate" | "Strict"; // default "Moderate"
    setLang?: string;     // interface language code
  }
): Promise<SmartSearchResponse> {
  const params = new URLSearchParams({ q });
  if (options?.count    !== undefined) params.set("count",      String(options.count));
  if (options?.offset   !== undefined) params.set("offset",     String(options.offset));
  if (options?.freshness)              params.set("freshness",  options.freshness);
  if (options?.mkt)                    params.set("mkt",        options.mkt);
  if (options?.cc)                     params.set("cc",         options.cc);
  if (options?.safeSearch)             params.set("safeSearch", options.safeSearch);
  if (options?.setLang)                params.set("setLang",    options.setLang);

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  return response.json() as Promise<SmartSearchResponse>;
}
```

**Usage examples:**

```typescript
// Basic search
const result = await callWebSearch("artificial intelligence");

// Search with time filter (last week)
const recent = await callWebSearch("AI news", { freshness: "Week", count: 20 });

// Specify region and safe search
const localized = await callWebSearch("technology", { mkt: "en-US", safeSearch: "Moderate" });

// Paginate to get more results
const page2 = await callWebSearch("space exploration", { count: 10, offset: 10 });

// Process results
result.webPages.value.forEach((item) => {
  console.log(`[${item.score.toFixed(3)}] ${item.name}`);
  console.log(`  URL: ${item.url}`);
  console.log(`  Snippet: ${item.snippet}`);
});
```

---

## Runtime Usage (In-App via Edge Function)

At application runtime, proxy requests through an Edge Function to protect auth credentials.

### Edge Function

```typescript
// edge-functions/web-search.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let q: string;
  let count: string | undefined;
  let offset: string | undefined;
  let freshness: string | undefined;
  let mkt: string | undefined;
  let cc: string | undefined;
  let safeSearch: string | undefined;
  let setLang: string | undefined;

  try {
    const body = await req.json();
    q = body.q;
    if (!q) throw new Error("Missing q");
    count      = body.count      !== undefined ? String(body.count)  : undefined;
    offset     = body.offset     !== undefined ? String(body.offset) : undefined;
    freshness  = body.freshness;
    mkt        = body.mkt;
    cc         = body.cc;
    safeSearch = body.safeSearch;
    setLang    = body.setLang;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform credentials (never exposed to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Build query parameters ---
  const params = new URLSearchParams({ q });
  if (count)      params.set("count",      count);
  if (offset)     params.set("offset",     offset);
  if (freshness)  params.set("freshness",  freshness);
  if (mkt)        params.set("mkt",        mkt);
  if (cc)         params.set("cc",         cc);
  if (safeSearch) params.set("safeSearch", safeSearch);
  if (setLang)    params.set("setLang",    setLang);

  // --- Call upstream ---
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-VaOwP8E7dKEa.gateway.appmedo.com/search/FgEFxazBTfRUumJx/smart?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
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

### Frontend Call to Edge Function

**Recommended (when supabase client is available):**

```typescript
async function fetchWebSearch(
  q: string,
  options?: {
    count?: number;
    offset?: number;
    freshness?: string;
    mkt?: string;
    cc?: string;
    safeSearch?: "Off" | "Moderate" | "Strict";
    setLang?: string;
  }
) {
  const { data, error } = await supabase.functions.invoke("web-search", {
    body: { q, ...options },
  });
  if (error) throw error;
  return data; // { queryContext, webPages }
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function fetchWebSearch(
  q: string,
  options?: {
    count?: number;
    offset?: number;
    freshness?: string;
    mkt?: string;
    cc?: string;
    safeSearch?: "Off" | "Moderate" | "Strict";
    setLang?: string;
  }
) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, ...options }),
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

  return res.json(); // { queryContext, webPages }
}
```

---

## Parameters

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Search query; supports Bing advanced operators (e.g. `site:example.com`) |
| `count` | `string` | No | Number of results to return; default `10` |
| `offset` | `string` | No | Number of results to skip for pagination; default `0` |
| `freshness` | `string` | No | Time filter: `Day` / `Week` / `Month`, or date range `YYYY-MM-DD..YYYY-MM-DD` |
| `mkt` | `string` | No | Market/locale in `language-Country` format, e.g. `en-US`, `zh-CN` |
| `cc` | `string` | No | 2-character country code, e.g. `US`, `CN` |
| `safeSearch` | `string` | No | Adult content filter: `Off` / `Moderate` / `Strict`; default `Moderate` |
| `setLang` | `string` | No | UI language code (2- or 4-character) |

### Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `queryContext.originalQuery` | `string` | The original query as processed by the server |
| `webPages.value` | `array` | List of search results |
| `webPages.value[].name` | `string` | Page title |
| `webPages.value[].url` | `string` | Full page URL |
| `webPages.value[].displayUrl` | `string` | Display URL (shortened form) |
| `webPages.value[].snippet` | `string` | Page content summary |
| `webPages.value[].score` | `number` | Relevance score (0–1) |
| `webPages.value[].thumbnailUrl?` | `string` | Thumbnail URL (optional) |
| `webPages.value[].dateLastCrawled?` | `string` | Last crawled timestamp (ISO 8601, optional) |
| `webPages.value[].siteName?` | `string` | Site name (optional) |

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` is only accessible server-side in Edge Functions and must never be exposed to the frontend.
- **Error handling**: Always handle `429` (quota exceeded) and `402` (insufficient balance); both error bodies are passed through to the client as-is.
- **Billing**: Each call costs ¥0.60 (discounted ¥0.50). Avoid calling the same query repeatedly in a loop; use the `offset` parameter for pagination instead of re-querying.
- **Pagination**: Use `offset` with a fixed `count` for pagination (e.g. page 2: `offset=10&count=10`).
- **Time filter**: The `freshness` date range format is `YYYY-MM-DD..YYYY-MM-DD` (two dots as separator), not a slash or hyphen.
- **Bing advanced operators**: The `q` parameter supports Bing operators such as `site:`, `filetype:`, and `intitle:` for precise result filtering.
