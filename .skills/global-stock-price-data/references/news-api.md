# Finance & Market News API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-AalZze1qEWML.gateway.appmedo.com/v1/news/all`

Retrieve the latest global financial news with entity recognition and sentiment analysis. Filter by stock symbols, industries, countries, sentiment score, keywords, language, and date range.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | `string` | Yes | API authentication token |
| `symbols` | `string` | No | Comma-separated list of ticker symbols (e.g. `TSLA,AMZN,MSFT`) |
| `entity_types` | `string` | No | Entity types to filter, e.g. `index,equity` |
| `industries` | `string` | No | Comma-separated industry list, e.g. `Technology,Industrials` |
| `countries` | `string` | No | Country codes, e.g. `us,ca` |
| `sentiment_gte` | `number` | No | Minimum sentiment score (−1 to 1; positive means positive sentiment) |
| `sentiment_lte` | `number` | No | Maximum sentiment score |
| `search` | `string` | No | Keyword search |
| `language` | `string` | No | Language codes, e.g. `en,es` |
| `published_before` | `string` | No | Upper bound on publication date in `Y-m-d` format |
| `published_after` | `string` | No | Lower bound on publication date in `Y-m-d` format |
| `sort` | `string` | No | Sort field: `published_on`, `entity_match_score`, `entity_sentiment_score`, or `relevance_score` |
| `limit` | `integer` | No | Number of results per page |
| `page` | `integer` | No | Page number |

---

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `meta.found` | `number` | Total number of matching articles |
| `meta.returned` | `number` | Number of articles returned on this page |
| `meta.limit` | `number` | Applied limit value |
| `meta.page` | `number` | Current page number |
| `data` | `array` | Array of news article objects |
| `data[].uuid` | `string` | Unique article identifier |
| `data[].title` | `string` | Article title |
| `data[].description` | `string` | Article description |
| `data[].url` | `string` | Link to original article |
| `data[].published_at` | `string` | Publication time (ISO 8601 UTC) |
| `data[].source` | `string` | News source |
| `data[].relevance_score` | `number` | Relevance score |
| `data[].entities` | `array` | Array of recognized entities |
| `data[].entities[].symbol` | `string` | Ticker symbol |
| `data[].entities[].name` | `string` | Company name |
| `data[].entities[].type` | `string` | Entity type (e.g. `equity`) |
| `data[].entities[].industry` | `string` | Industry |
| `data[].entities[].sentiment_score` | `number` | Sentiment score for this entity (−1 to 1) |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const API_TOKEN = "JhDKCuOjkX7RdCP22zqz0QU52DQELlf5Ld5IgRyd"; // user-managed — replace with actual token

interface NewsEntity {
  symbol: string;
  name: string;
  type: string;
  industry: string;
  sentiment_score: number;
}

interface NewsArticle {
  uuid: string;
  title: string;
  description: string;
  url: string;
  published_at: string;
  source: string;
  relevance_score: number;
  entities: NewsEntity[];
}

interface NewsResponse {
  meta: { found: number; returned: number; limit: number; page: number };
  data: NewsArticle[];
}

interface NewsParams {
  symbols?: string;
  entity_types?: string;
  industries?: string;
  countries?: string;
  sentiment_gte?: number;
  sentiment_lte?: number;
  search?: string;
  language?: string;
  published_before?: string;
  published_after?: string;
  sort?: "published_on" | "entity_match_score" | "entity_sentiment_score" | "relevance_score";
  limit?: number;
  page?: number;
}

async function getFinanceNews(params: NewsParams = {}): Promise<NewsResponse> {
  const query = new URLSearchParams({ api_token: API_TOKEN });
  if (params.symbols)          query.set("symbols", params.symbols);
  if (params.entity_types)     query.set("entity_types", params.entity_types);
  if (params.industries)       query.set("industries", params.industries);
  if (params.countries)        query.set("countries", params.countries);
  if (params.sentiment_gte !== undefined) query.set("sentiment_gte", String(params.sentiment_gte));
  if (params.sentiment_lte !== undefined) query.set("sentiment_lte", String(params.sentiment_lte));
  if (params.search)           query.set("search", params.search);
  if (params.language)         query.set("language", params.language);
  if (params.published_before) query.set("published_before", params.published_before);
  if (params.published_after)  query.set("published_after", params.published_after);
  if (params.sort)             query.set("sort", params.sort);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.page !== undefined)  query.set("page", String(params.page));

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-AalZze1qEWML.gateway.appmedo.com/v1/news/all?${query.toString()}`,
    { method: "GET", headers: { "Accept": "application/json" } }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
// Get positive English news about Tesla, limit 10
const result = await getFinanceNews({
  symbols: "TSLA",
  sentiment_gte: 0.5,
  language: "en",
  limit: 10,
  sort: "relevance_score",
});
result.data.forEach(a => console.log(`[${a.published_at}] ${a.title}`));
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/finance-news.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let params: Record<string, string> = {};
  try {
    const body = await req.json();
    params = Object.fromEntries(
      Object.entries(body as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    );
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const query = new URLSearchParams(params);

  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-AalZze1qEWML.gateway.appmedo.com/v1/news/all?${query.toString()}`,
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

### Frontend Call to Edge Function

**Recommended (when supabase client is available):**

```typescript
async function fetchFinanceNews(params: NewsParams = {}) {
  const { data, error } = await supabase.functions.invoke("finance-news", {
    body: params,
  });
  if (error) throw error;
  return data as NewsResponse;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function fetchFinanceNews(params: NewsParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-news`, {
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

  return res.json() as Promise<NewsResponse>;
}
```
