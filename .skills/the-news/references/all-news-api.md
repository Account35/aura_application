# All News API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all`

Access the complete news article database with comprehensive filtering by language, category, source, and publication date. Features advanced search capabilities with Boolean operators for precise content retrieval across all collected articles.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | `string` | No | Advanced search with operators: `+` (AND), `\|` (OR), `-` (NOT), `""` (phrase), `*` (prefix), `()` (precedence) |
| `search_fields` | `string` | No | Fields to search: `title`, `description`, `keywords`, `main_text`. Default: `title,main_text` |
| `categories` | `string` | No | Categories: `general`, `science`, `sports`, `business`, `health`, `entertainment`, `tech`, `politics`, `food`, `travel` |
| `exclude_categories` | `string` | No | Categories to exclude |
| `domains` | `string` | No | Comma-separated domain list |
| `exclude_domains` | `string` | No | Domains to exclude |
| `source_ids` | `string` | No | Comma-separated source IDs |
| `exclude_source_ids` | `string` | No | Source IDs to exclude |
| `language` | `string` | No | Language codes, e.g. `en,es` |
| `published_before` | `string` | No | Upper publication date bound. Formats: `Y-m-d\TH:i:s`, `Y-m-d\TH:i`, `Y-m-d\TH`, `Y-m-d`, `Y-m`, `Y` |
| `published_after` | `string` | No | Lower publication date bound (same formats as above) |
| `published_on` | `string` | No | Specific date, format: `Y-m-d` |
| `sort` | `string` | No | Sort order: `published_on` or `relevance_score` |
| `limit` | `number` | No | Results per page |
| `page` | `number` | No | Page number (max 20,000 total results) |

---

## Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `meta.found` | `number` | Total articles matching the query |
| `meta.returned` | `number` | Articles returned on the current page |
| `meta.limit` | `number` | Applied limit value |
| `meta.page` | `number` | Current page number |
| `data` | `array` | Array of article objects |
| `data[].uuid` | `string` | Unique article identifier |
| `data[].title` | `string` | Article title |
| `data[].description` | `string` | Meta description |
| `data[].keywords` | `string` | Meta keywords |
| `data[].snippet` | `string` | First 60 characters of body text |
| `data[].url` | `string` | Article URL |
| `data[].image_url` | `string?` | Image URL (nullable) |
| `data[].language` | `string` | Source language code |
| `data[].published_at` | `string` | Publication datetime (UTC) |
| `data[].source` | `string` | Source domain |
| `data[].categories` | `array` | Category tag array |
| `data[].relevance_score` | `number\|null` | Search relevance score (only populated on search queries) |
| `data[].locale` | `string` | Source locale code |

---

## Generation-time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"] ?? "";

interface AllNewsParams {
  search?: string;
  searchFields?: string;
  categories?: string;
  excludeCategories?: string;
  domains?: string;
  excludeDomains?: string;
  sourceIds?: string;
  excludeSourceIds?: string;
  language?: string;
  publishedBefore?: string;
  publishedAfter?: string;
  publishedOn?: string;
  sort?: "published_on" | "relevance_score";
  limit?: number;
  page?: number;
}

interface Article {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string | null;
  language: string;
  published_at: string;
  source: string;
  categories: string[];
  relevance_score: number | null;
  locale: string;
}

interface AllNewsResponse {
  meta: { found: number; returned: number; limit: number; page: number };
  data: Article[];
}

async function getAllNews(params: AllNewsParams = {}): Promise<AllNewsResponse> {
  const query = new URLSearchParams();
  if (params.search)            query.set("search", params.search);
  if (params.searchFields)      query.set("search_fields", params.searchFields);
  if (params.categories)        query.set("categories", params.categories);
  if (params.excludeCategories) query.set("exclude_categories", params.excludeCategories);
  if (params.domains)           query.set("domains", params.domains);
  if (params.excludeDomains)    query.set("exclude_domains", params.excludeDomains);
  if (params.sourceIds)         query.set("source_ids", params.sourceIds);
  if (params.excludeSourceIds)  query.set("exclude_source_ids", params.excludeSourceIds);
  if (params.language)          query.set("language", params.language);
  if (params.publishedBefore)   query.set("published_before", params.publishedBefore);
  if (params.publishedAfter)    query.set("published_after", params.publishedAfter);
  if (params.publishedOn)       query.set("published_on", params.publishedOn);
  if (params.sort)              query.set("sort", params.sort);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.page !== undefined)  query.set("page", String(params.page));

  const qs = query.toString();
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
// Search all English business news from last week
const result = await getAllNews({
  search: "AI investment",
  language: "en",
  categories: "business",
  publishedAfter: "2025-05-04",
  sort: "relevance_score",
  limit: 10,
});
result.data.forEach(a => console.log(a.title, a.published_at));
```

---

## Post-generation Usage (Edge Function Call from Application)

### Edge Function (`edge-functions/all-news.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let params: Record<string, string> = {};
  try {
    const body = await req.json();
    params = { ...body };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";

  const query = new URLSearchParams(params);
  const qs = query.toString();
  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-W9z3M6eOKQVL.gateway.appmedo.com/v1/news/all${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

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

### Frontend → Edge Function

**Recommended (when supabase client is available):**

```typescript
async function fetchAllNews(params: AllNewsParams = {}) {
  const { data, error } = await supabase.functions.invoke("all-news", {
    body: params,
  });
  if (error) throw error;
  return data as AllNewsResponse;
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function fetchAllNews(params: AllNewsParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/all-news`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Rate limit exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  return res.json() as Promise<AllNewsResponse>;
}
```
