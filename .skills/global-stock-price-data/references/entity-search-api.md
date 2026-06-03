# Entity Search API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-Xa6JZq205MNa.gateway.appmedo.com/v1/entity/search`

Search for financial market entities (stocks, funds, indices, etc.) by keyword, ticker symbol, exchange, type, industry, or country. Useful for resolving company names to ticker symbols before querying price data. Returns up to 50 results per request.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | `string` | Yes | API authentication token |
| `search` | `string` | No | Keyword search (partial company name or ticker symbol) |
| `symbols` | `string` | No | Comma-separated list of ticker symbols |
| `exchanges` | `string` | No | Exchange filter (e.g. `NASDAQ,NYSE`) |
| `types` | `string` | No | Entity type filter |
| `industries` | `string` | No | Industry filter |
| `countries` | `string` | No | ISO 3166-1 two-letter country codes (e.g. `us,gb`) |
| `page` | `integer` | No | Page number (50 results per page, fixed) |

---

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `meta.found` | `number` | Total number of matching entities |
| `meta.returned` | `number` | Number of entities returned on this page (max 50) |
| `meta.limit` | `number` | Fixed at 50 |
| `meta.page` | `number` | Current page number |
| `data` | `array` | Array of entity objects |
| `data[].symbol` | `string` | Ticker symbol |
| `data[].name` | `string` | Company or entity name |
| `data[].type` | `string` | Entity type (e.g. `Common Stock`) |
| `data[].industry` | `string` | Industry |
| `data[].exchange` | `string` | Exchange short name |
| `data[].exchange_long` | `string` | Exchange full name |
| `data[].mic_code` | `string` | MIC market identifier code |
| `data[].country` | `string` | Listing country (ISO 3166-1 two-letter code) |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const API_TOKEN = "JhDKCuOjkX7RdCP22zqz0QU52DQELlf5Ld5IgRyd"; // user-managed — replace with actual token

interface StockEntity {
  symbol: string;
  name: string;
  type: string;
  industry: string;
  exchange: string;
  exchange_long: string;
  mic_code: string;
  country: string;
}

interface EntitySearchResponse {
  meta: { found: number; returned: number; limit: number; page: number };
  data: StockEntity[];
}

interface EntitySearchParams {
  search?: string;
  symbols?: string;
  exchanges?: string;
  types?: string;
  industries?: string;
  countries?: string;
  page?: number;
}

async function searchEntities(params: EntitySearchParams = {}): Promise<EntitySearchResponse> {
  const query = new URLSearchParams({ api_token: API_TOKEN });
  if (params.search)      query.set("search", params.search);
  if (params.symbols)     query.set("symbols", params.symbols);
  if (params.exchanges)   query.set("exchanges", params.exchanges);
  if (params.types)       query.set("types", params.types);
  if (params.industries)  query.set("industries", params.industries);
  if (params.countries)   query.set("countries", params.countries);
  if (params.page !== undefined) query.set("page", String(params.page));

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-Xa6JZq205MNa.gateway.appmedo.com/v1/entity/search?${query.toString()}`,
    { method: "GET", headers: { "Accept": "application/json" } }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
// Find Apple's ticker symbol
const result = await searchEntities({ search: "Apple", countries: "us" });
result.data.forEach(e => console.log(`${e.symbol} — ${e.name} (${e.exchange})`));

// Look up multiple known tickers at once
const tickers = await searchEntities({ symbols: "AAPL,GOOGL,AMZN" });
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/entity-search.ts`)

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
    `https://app-b0t9jb6nl2pt-api-Xa6JZq205MNa.gateway.appmedo.com/v1/entity/search?${query.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (upstream.status === 429 || upstream.status === 402) {
    return new Response(await upstream.text(), {
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
async function fetchEntitySearch(params: EntitySearchParams = {}) {
  const { data, error } = await supabase.functions.invoke("entity-search", {
    body: params,
  });
  if (error) throw error;
  return data as EntitySearchResponse;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function fetchEntitySearch(params: EntitySearchParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/entity-search`, {
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

  return res.json() as Promise<EntitySearchResponse>;
}
```
