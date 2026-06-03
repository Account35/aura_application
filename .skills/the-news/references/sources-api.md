# Sources API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-oLpZ7eD5jJ5a.gateway.appmedo.com/v1/news/sources`

Access the complete list of available news sources with their identifiers, domains, languages, and categories. Use this endpoint to discover `source_ids` and `domains` values for filtering other news endpoints.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categories` | `string` | No | Filter sources by category |
| `exclude_categories` | `string` | No | Exclude sources with specified categories |
| `language` | `string` | No | Filter by language code |
| `page` | `number` | No | Page number (fixed 50 results per page) |

---

## Response Fields

| Field path | Type | Description |
|------------|------|-------------|
| `meta.found` | `number` | Total matching sources |
| `meta.returned` | `number` | Sources returned on the current page (up to 50) |
| `meta.limit` | `number` | Fixed value: 50 |
| `meta.page` | `number` | Current page number |
| `data` | `array` | Array of source objects |
| `data[].source_id` | `string` | Unique source identifier (use with `source_ids` parameter) |
| `data[].domain` | `string` | Source domain (use with `domains` parameter) |
| `data[].language` | `string` | Source language code |
| `data[].locale` | `string` | Source locale code |
| `data[].categories` | `array` | Categories covered by this source |

---

## Generation-time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"] ?? "";

interface SourcesParams {
  categories?: string;
  excludeCategories?: string;
  language?: string;
  page?: number;
}

interface NewsSource {
  source_id: string;
  domain: string;
  language: string;
  locale: string;
  categories: string[];
}

interface SourcesResponse {
  meta: { found: number; returned: number; limit: number; page: number };
  data: NewsSource[];
}

async function getSources(params: SourcesParams = {}): Promise<SourcesResponse> {
  const query = new URLSearchParams();
  if (params.categories)        query.set("categories", params.categories);
  if (params.excludeCategories) query.set("exclude_categories", params.excludeCategories);
  if (params.language)          query.set("language", params.language);
  if (params.page !== undefined) query.set("page", String(params.page));

  const qs = query.toString();
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-oLpZ7eD5jJ5a.gateway.appmedo.com/v1/news/sources${qs ? `?${qs}` : ""}`,
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
// List English-language tech news sources
const result = await getSources({ language: "en", categories: "tech" });
console.log(`Found ${result.meta.found} sources`);
result.data.forEach(s => console.log(s.source_id, s.domain));
```

---

## Post-generation Usage (Edge Function Call from Application)

### Edge Function (`edge-functions/news-sources.ts`)

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
    `https://app-b0t9jb6nl2pt-api-oLpZ7eD5jJ5a.gateway.appmedo.com/v1/news/sources${qs ? `?${qs}` : ""}`,
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
async function fetchNewsSources(params: SourcesParams = {}) {
  const { data, error } = await supabase.functions.invoke("news-sources", {
    body: params,
  });
  if (error) throw error;
  return data as SourcesResponse;
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function fetchNewsSources(params: SourcesParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-sources`, {
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

  return res.json() as Promise<SourcesResponse>;
}
```
