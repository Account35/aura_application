# Similar News API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-m9xKXDbR1oka.gateway.appmedo.com/v1/news/similar/{uuid}`

Discover articles similar to a specific story using its UUID. Supports filtering by category, source, language, and publication date with relevance scoring to find related content.

---

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uuid` | `string` | Yes | Unique identifier of the target article (inserted in the URL path) |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categories` | `string` | No | Category filter |
| `exclude_categories` | `string` | No | Categories to exclude |
| `domains` | `string` | No | Domain filter |
| `exclude_domains` | `string` | No | Domains to exclude |
| `source_ids` | `string` | No | Source ID filter |
| `exclude_source_ids` | `string` | No | Source IDs to exclude |
| `language` | `string` | No | Language codes |
| `published_before` | `string` | No | Upper publication date bound |
| `published_after` | `string` | No | Lower publication date bound |
| `published_on` | `string` | No | Specific publication date, format: `Y-m-d` |
| `limit` | `number` | No | Results per page |
| `page` | `number` | No | Page number (max 20,000 total results) |

---

## Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `meta.found` | `number` | Total similar articles matching the query |
| `meta.returned` | `number` | Articles returned on the current page |
| `meta.limit` | `number` | Applied limit value |
| `meta.page` | `number` | Current page number |
| `data` | `array` | Array of similar articles (same structure as All News Article) |
| `data[].uuid` | `string` | Unique article identifier |
| `data[].title` | `string` | Article title |
| `data[].description` | `string` | Meta description |
| `data[].keywords` | `string` | Meta keywords |
| `data[].snippet` | `string` | First 60 characters of body text |
| `data[].url` | `string` | Article URL |
| `data[].image_url` | `string?` | Image URL (nullable) |
| `data[].language` | `string` | Source language |
| `data[].locale` | `string` | Locale code (e.g. `"en"`) |
| `data[].published_at` | `string` | Publication datetime (UTC) |
| `data[].source` | `string` | Source domain |
| `data[].categories` | `array` | Category tags |
| `data[].relevance_score` | `number\|null` | Relevance score relative to the target article |

---

## Generation-time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"] ?? "";

interface SimilarNewsParams {
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
  limit?: number;
  page?: number;
}

interface SimilarNewsResponse {
  meta: { found: number; returned: number; limit: number; page: number };
  data: Array<{
    uuid: string;
    title: string;
    description: string;
    keywords: string;
    snippet: string;
    url: string;
    image_url: string | null;
    language: string;
    locale: string;
    published_at: string;
    source: string;
    categories: string[];
    relevance_score: number | null;
  }>;
}

async function getSimilarNews(uuid: string, params: SimilarNewsParams = {}): Promise<SimilarNewsResponse> {
  const query = new URLSearchParams();
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
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.page !== undefined)  query.set("page", String(params.page));

  const qs = query.toString();
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-m9xKXDbR1oka.gateway.appmedo.com/v1/news/similar/${encodeURIComponent(uuid)}${qs ? `?${qs}` : ""}`,
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
const result = await getSimilarNews("cc11e3ab-ced0-4a42-9146-e426505e2e67", {
  language: "en",
  limit: 5,
});
result.data.forEach(a => console.log(a.title, a.relevance_score));
```

---

## Post-generation Usage (Edge Function Call from Application)

### Edge Function (`edge-functions/similar-news.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let uuid: string;
  let params: Record<string, string> = {};
  try {
    const body = await req.json();
    uuid = body.uuid;
    if (!uuid) throw new Error("Missing uuid");
    const { uuid: _uuid, ...rest } = body;
    params = rest;
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
    `https://app-b0t9jb6nl2pt-api-m9xKXDbR1oka.gateway.appmedo.com/v1/news/similar/${encodeURIComponent(uuid)}${qs ? `?${qs}` : ""}`,
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
async function fetchSimilarNews(uuid: string, params: SimilarNewsParams = {}) {
  const { data, error } = await supabase.functions.invoke("similar-news", {
    body: { uuid, ...params },
  });
  if (error) throw error;
  return data as SimilarNewsResponse;
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function fetchSimilarNews(uuid: string, params: SimilarNewsParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/similar-news`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid, ...params }),
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

  return res.json() as Promise<SimilarNewsResponse>;
}
```
