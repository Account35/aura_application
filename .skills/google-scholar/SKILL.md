---
name: google-scholar
description: Search Google Scholar for academic papers, citations, and literature via SerpApi. Use this skill whenever the user needs to find academic papers, research literature, citation counts, related versions of a paper, or wants to search Google Scholar by keyword, author, year range, or article ID.
license: MIT
---

# Google Scholar — Academic Literature Search

## Overview

Calls the Google Scholar search engine via SerpApi to retrieve academic literature, papers, and citation information. Supports keyword search, citation retrieval, year filtering, language restriction, pagination, and more.

| Property | Value |
|----------|-------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-Xa6JZq2055oa.gateway.appmedo.com/search` |
| Authentication | platform_managed (API Key read from `INTEGRATIONS_API_KEY` environment variable) |
| Search Engine | Google Scholar (`engine=google_scholar` fixed value) |
| Data Types | Academic papers, citation information, version clusters |
| Billing | Original price ¥3.00 / request, discounted price ¥2.50 / request |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `engine` | `string` | Yes | Fixed value `"google_scholar"`, specifies the search engine type |
| `q` | `string` | No | Search keywords, supports auxiliary operators like `author:`, `source:` |
| `cites` | `string` | No | Unique article ID for triggering citation retrieval |
| `cluster` | `string` | No | Article cluster ID for retrieving related versions |
| `as_ylo` | `string` | No | Start year, returns results from this year onwards |
| `as_yhi` | `string` | No | End year, returns results up to and including this year |
| `hl` | `string` | No | Interface language, two-letter language code, e.g. `en`, `zh`, `fr` |
| `lr` | `string` | No | Search language restriction, format `lang_code\|lang_code` |
| `start` | `string` | No | Pagination offset, e.g. `0` (page 1), `10` (page 2) |
| `as_sdt` | `string` | No | Search type: `0`-exclude patents (default), `7`-include patents, `4`-case law |
| `as_vis` | `string` | No | Show review articles only: `0`-show all results (default), `1`-show reviews only |
| `no_cache` | `string` | No | Force fetch new results: `false`-allow cache (default), `true`-disable cache |

### Response Example

```json
{
  "search_metadata": {
    "id": "search_123",
    "status": "Success",
    "created_at": "2024-01-01T12:00:00Z",
    "total_time_taken": 1.23
  },
  "search_parameters": {
    "engine": "google_scholar",
    "q": "machine learning"
  },
  "search_information": {
    "total_results": 1000000,
    "time_taken_displayed": 0.15,
    "query_displayed": "machine learning"
  },
  "organic_results": [
    {
      "position": 1,
      "title": "Machine Learning: A Probabilistic Perspective",
      "result_id": "abc123",
      "link": "https://example.com/paper",
      "snippet": "This book provides a comprehensive introduction...",
      "publication_info": {
        "summary": "K Murphy - 2012 - MIT Press"
      },
      "inline_links": {
        "cited_by": {
          "total": 15000,
          "link": "https://scholar.google.com/citations",
          "cites_id": "cite123"
        },
        "versions": {
          "total": 5,
          "cluster_id": "cluster123"
        }
      }
    }
  ],
  "pagination": {
    "current": 1,
    "next": "https://app-b0t9jb6nl2pt-api-Xa6JZq2055oa.gateway.appmedo.com/search?start=10"
  }
}
```

---

## Generation-Time Usage (Direct Agent Call)

This is a platform_managed skill. The API Key is read from `process.env["INTEGRATIONS_API_KEY"]!` and passed via the `X-Gateway-Authorization` header.

```typescript
const AUTH_VALUE = process.env["INTEGRATIONS_API_KEY"]!;

interface ScholarSearchParams {
  q?: string;           // Search keywords
  cites?: string;       // Article ID for citation retrieval
  cluster?: string;     // Version cluster ID
  as_ylo?: string;      // Start year
  as_yhi?: string;      // End year
  hl?: string;          // Interface language
  lr?: string;          // Search language restriction
  start?: string;       // Pagination offset
  as_sdt?: string;      // Search type
  as_vis?: string;      // Show review articles only
  no_cache?: string;    // Disable cache
}

interface ScholarResult {
  position: number;
  title: string;
  result_id: string;
  link?: string;
  snippet?: string;
  publication_info?: { summary: string };
  inline_links?: {
    cited_by?: { total: number; link: string; cites_id: string };
    versions?: { total: number; cluster_id: string };
  };
}

interface ScholarResponse {
  search_metadata: { id: string; status: string; created_at: string; total_time_taken: number };
  search_parameters: Record<string, string>;
  search_information?: { total_results: number; time_taken_displayed: number; query_displayed: string };
  organic_results?: ScholarResult[];
  pagination?: { current: number; next?: string };
}

async function searchGoogleScholar(params: ScholarSearchParams): Promise<ScholarResponse> {
  const queryParams = new URLSearchParams({
    engine: "google_scholar",
    ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
  });

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-Xa6JZq2055oa.gateway.appmedo.com/search?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": AUTH_VALUE,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: ScholarResponse = await response.json();
  return json;
}

// Example 1: Keyword search
const results = await searchGoogleScholar({ q: "deep learning", as_ylo: "2020", as_yhi: "2024" });
console.log(`Found approximately ${results.search_information?.total_results} papers`);
results.organic_results?.forEach(r => console.log(`[${r.position}] ${r.title} — ${r.publication_info?.summary}`));

// Example 2: Citation retrieval
const citations = await searchGoogleScholar({ cites: "abc123" });

// Example 3: Pagination (page 2)
const page2 = await searchGoogleScholar({ q: "transformer architecture", start: "10" });
```

---

## Post-Generation Usage (Calling via Edge Function in App)

When calling from within an application, proxy the request through an Edge Function to avoid exposing the API Key to the frontend.

### Edge Function Code

```typescript
// edge-functions/google-scholar.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let searchParams: Record<string, string>;
  try {
    const body = await req.json();
    // At least one of q or cites must be provided
    if (!body.q && !body.cites && !body.cluster) {
      throw new Error("At least one of q, cites, or cluster is required");
    }
    searchParams = Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === "string" && v !== "")
    ) as Record<string, string>;
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

  // --- Build upstream URL ---
  const queryParams = new URLSearchParams({
    engine: "google_scholar",
    ...searchParams,
  });

  // --- Call upstream ---
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-Xa6JZq2055oa.gateway.appmedo.com/search?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
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

**Recommended approach (when supabase client is available):**

```typescript
async function fetchScholarResults(params: {
  q?: string;
  cites?: string;
  cluster?: string;
  as_ylo?: string;
  as_yhi?: string;
  start?: string;
  hl?: string;
}) {
  const { data, error } = await supabase.functions.invoke("google-scholar", {
    body: params,
  });
  if (error) throw error;
  return data;
}
```

**Fallback approach (when supabase client is not available):**

```typescript
async function fetchScholarResults(params: Record<string, string>) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-scholar`, {
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

## Parameter Reference

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `engine` | `string` | Yes | Fixed value `"google_scholar"` (auto-filled by the code layer, no need to pass from user) |
| `q` | `string` | No* | Search keywords, supports auxiliary operators like `author:`, `source:` |
| `cites` | `string` | No* | Unique article ID for retrieving the citation list of that article |
| `cluster` | `string` | No* | Article cluster ID for retrieving different versions of the same article |
| `as_ylo` | `string` | No | Start year (inclusive), e.g. `"2020"` |
| `as_yhi` | `string` | No | End year (inclusive), e.g. `"2024"` |
| `hl` | `string` | No | Interface language code, e.g. `"en"`, `"zh-CN"` |
| `lr` | `string` | No | Search language restriction, e.g. `"lang_en\|lang_zh-CN"` |
| `start` | `string` | No | Pagination offset; 10 results per page — pass `"10"` for page 2, `"20"` for page 3 |
| `as_sdt` | `string` | No | Search scope: `"0"`-exclude patents (default), `"7"`-include patents, `"4"`-case law |
| `as_vis` | `string` | No | `"0"`-all results (default), `"1"`-review articles only |
| `no_cache` | `string` | No | `"false"`-use cache (default), `"true"`-force real-time fetch |

> *At least one of `q`, `cites`, or `cluster` must be provided.

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `search_metadata.id` | `string` | Unique ID of this search request |
| `search_metadata.status` | `string` | Request status; `"Success"` on success |
| `search_metadata.created_at` | `string` | Timestamp when the search was created |
| `search_metadata.total_time_taken` | `number` | Total search time in seconds |
| `search_parameters` | `object` | Echo of the query parameters sent (e.g. `engine`, `q`) |
| `search_information.total_results` | `number` | Estimated total number of results |
| `search_information.time_taken_displayed` | `number` | Search time displayed to the user (seconds) |
| `search_information.query_displayed` | `string` | The actual query string executed |
| `organic_results` | `array` | Array of search results |
| `organic_results[].position` | `number` | Rank position of the result |
| `organic_results[].title` | `string` | Article title |
| `organic_results[].result_id` | `string` | Unique article ID (can be used as the `cites` parameter for citation retrieval) |
| `organic_results[].link`? | `string` | Link to the full article |
| `organic_results[].snippet`? | `string` | Abstract snippet of the article |
| `organic_results[].publication_info.summary`? | `string` | Publication info summary, e.g. `"K Murphy - 2012 - MIT Press"` |
| `organic_results[].inline_links.cited_by.total`? | `number` | Number of times the article has been cited |
| `organic_results[].inline_links.cited_by.link`? | `string` | Link to the citation results page |
| `organic_results[].inline_links.cited_by.cites_id`? | `string` | Citation retrieval ID (pass to `cites` parameter to get the citation list) |
| `organic_results[].inline_links.versions.total`? | `number` | Total number of versions of this article |
| `organic_results[].inline_links.versions.cluster_id`? | `string` | Version cluster ID (pass to `cluster` parameter to get all versions) |
| `pagination.current` | `number` | Current page number |
| `pagination.next`? | `string` | Link to the next page of results (present when more results exist) |

---

## Notes

- **Key Security**: `INTEGRATIONS_API_KEY` must only be read on the Edge Function server side. Never expose it in frontend code or version control.
- **Error Handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance). SerpApi does not return an error when a search yields no results — it returns an empty `organic_results` array instead. Add null/empty checks at the business layer.
- **Billing**: Each API call costs a discounted price of **¥2.50** (original price ¥3.00). Cache search results at the application layer where appropriate to avoid redundant calls with the same query parameters.
- **Query Parameter Constraints**: At least one of `q`, `cites`, or `cluster` must be provided; otherwise SerpApi returns an error. The `engine` parameter is fixed as `"google_scholar"` and cannot be changed.
- **Pagination**: Each page returns a fixed 10 results. Control the offset via the `start` parameter (`0`, `10`, `20`, …). The presence of `pagination.next` indicates more results are available.
- **Citation and Version Retrieval**: When using the `cites` parameter, pass the value of `organic_results[].inline_links.cited_by.cites_id`; when using the `cluster` parameter, pass the value of `organic_results[].inline_links.versions.cluster_id`.
- **Data Source**: This API proxies Google Scholar public pages via SerpApi. Result freshness depends on SerpApi's caching policy (use `no_cache=true` to force a real-time fetch, but this consumes additional quota).
