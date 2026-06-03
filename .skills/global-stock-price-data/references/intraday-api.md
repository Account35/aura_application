# Intraday Data (Adjusted) API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-pLVzJ8y7V3KL.gateway.appmedo.com/v1/data/intraday`

Retrieve intraday OHLCV data for a US-listed stock at minute or hour granularity, adjusted for splits. Supports filtering by date range and sorting order.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | `string` | Yes | API authentication token |
| `symbols` | `string` | Yes | Ticker symbol (single, e.g. `AAPL`) |
| `interval` | `string` | No | Data granularity: `minute` or `hour` |
| `sort` | `string` | No | Sort order: `asc` (ascending) or `desc` (descending) |
| `date_from` | `string` | No | Start date in `Y-m-d` format |
| `date_to` | `string` | No | End date in `Y-m-d` format |
| `date` | `string` | No | Single specific date in `Y-m-d` format |
| `extended_hours` | `boolean` | No | Whether to include pre/post-market data |
| `key_by_date` | `boolean` | No | Whether to key results by date/time |
| `key_by_ticker` | `boolean` | No | Whether to key results by ticker symbol |
| `format` | `string` | No | Response format: `json` or `csv` |

---

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `meta.date_from` | `string` | Actual start date of returned data |
| `meta.date_to` | `string` | Actual end date of returned data |
| `meta.max_period_days` | `number` | Maximum time span per request (days) |
| `data` | `array` | Array of OHLCV bar objects |
| `data[].date` | `string` | Bar timestamp (ISO 8601 UTC) |
| `data[].ticker` | `string` | Ticker symbol |
| `data[].data.open` | `number` | Open price |
| `data[].data.high` | `number` | High price |
| `data[].data.low` | `number` | Low price |
| `data[].data.close` | `number` | Close price |
| `data[].data.volume` | `number` | Trading volume |
| `data[].data.is_extended_hours` | `boolean` | Whether this bar is from pre/post-market hours |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const API_TOKEN = "JhDKCuOjkX7RdCP22zqz0QU52DQELlf5Ld5IgRyd"; // user-managed — replace with actual token

interface IntradayBar {
  date: string;
  ticker: string;
  data: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    is_extended_hours: boolean;
  };
}

interface IntradayResponse {
  meta: { date_from: string; date_to: string; max_period_days: number };
  data: IntradayBar[];
}

interface IntradayParams {
  interval?: "minute" | "hour";
  sort?: "asc" | "desc";
  date_from?: string;
  date_to?: string;
  date?: string;
  extended_hours?: boolean;
  key_by_date?: boolean;
  key_by_ticker?: boolean;
  format?: "json" | "csv";
}

async function getIntradayData(symbol: string, params: IntradayParams = {}): Promise<IntradayResponse> {
  const query = new URLSearchParams({ api_token: API_TOKEN, symbols: symbol });
  if (params.interval)         query.set("interval", params.interval);
  if (params.sort)             query.set("sort", params.sort);
  if (params.date_from)        query.set("date_from", params.date_from);
  if (params.date_to)          query.set("date_to", params.date_to);
  if (params.date)             query.set("date", params.date);
  if (params.extended_hours !== undefined) query.set("extended_hours", String(params.extended_hours));
  if (params.key_by_date !== undefined)    query.set("key_by_date", String(params.key_by_date));
  if (params.key_by_ticker !== undefined)  query.set("key_by_ticker", String(params.key_by_ticker));
  if (params.format)           query.set("format", params.format);

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-pLVzJ8y7V3KL.gateway.appmedo.com/v1/data/intraday?${query.toString()}`,
    { method: "GET", headers: { "Accept": "application/json" } }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
// Get minute-level data for AAPL on 2024-01-15, sorted ascending
const result = await getIntradayData("AAPL", {
  interval: "minute",
  date: "2024-01-15",
  sort: "asc",
});
result.data.forEach(bar => console.log(`${bar.date}: close=${bar.data.close}, vol=${bar.data.volume}`));
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/intraday.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let symbols: string;
  let extraParams: Record<string, string> = {};
  try {
    const body = await req.json();
    symbols = body.symbols;
    if (!symbols) throw new Error("Missing symbols");
    // Forward all optional params as-is
    const { symbols: _s, ...rest } = body;
    extraParams = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
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

  const query = new URLSearchParams({ symbols, ...extraParams });

  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-pLVzJ8y7V3KL.gateway.appmedo.com/v1/data/intraday?${query.toString()}`,
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
async function fetchIntradayData(symbol: string, params: IntradayParams = {}) {
  const { data, error } = await supabase.functions.invoke("intraday", {
    body: { symbols: symbol, ...params },
  });
  if (error) throw error;
  return data as IntradayResponse;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function fetchIntradayData(symbol: string, params: IntradayParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intraday`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols: symbol, ...params }),
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

  return res.json() as Promise<IntradayResponse>;
}
```
