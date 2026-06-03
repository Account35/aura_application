# End-of-day Historical Data API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-V9gDze3qV2PL.gateway.appmedo.com/v1/data/eod`

Retrieve historical end-of-day OHLCV data for US stocks (adjusted for splits), plus crypto and forex history. Supports day/week/month/quarter/year intervals and date range filtering.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | `string` | Yes | API authentication token |
| `symbols` | `string` | Yes | Stock, crypto, or forex symbol (e.g. `AAPL`) |
| `interval` | `string` | No | Time granularity: `day`, `week`, `month`, `quarter`, or `year` |
| `sort` | `string` | No | Sort order: `asc` (ascending) or `desc` (descending) |
| `date_from` | `string` | No | Start date in `Y-m-d` format |
| `date_to` | `string` | No | End date in `Y-m-d` format |
| `date` | `string` | No | Single specific date in `Y-m-d` format |
| `key_by_date` | `boolean` | No | Whether to key results by date |
| `format` | `string` | No | Response format: `json` or `csv` |

---

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `meta.date_from` | `string` | Actual start date of returned data |
| `meta.date_to` | `string` | Actual end date of returned data |
| `meta.max_period_days` | `number` | Maximum time span per request (days) |
| `data` | `array` | Array of historical OHLCV bars |
| `data[].date` | `string` | Trading date (`Y-m-d`) |
| `data[].open` | `number` | Open price |
| `data[].high` | `number` | High price |
| `data[].low` | `number` | Low price |
| `data[].close` | `number` | Close price (adjusted for splits) |
| `data[].volume` | `number` | Trading volume |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const API_TOKEN = "JhDKCuOjkX7RdCP22zqz0QU52DQELlf5Ld5IgRyd"; // user-managed — replace with actual token

interface EodBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface EodResponse {
  meta: { date_from: string; date_to: string; max_period_days: number };
  data: EodBar[];
}

interface EodParams {
  interval?: "day" | "week" | "month" | "quarter" | "year";
  sort?: "asc" | "desc";
  date_from?: string;
  date_to?: string;
  date?: string;
  key_by_date?: boolean;
  format?: "json" | "csv";
}

async function getEodData(symbol: string, params: EodParams = {}): Promise<EodResponse> {
  const query = new URLSearchParams({ api_token: API_TOKEN, symbols: symbol });
  if (params.interval)           query.set("interval", params.interval);
  if (params.sort)               query.set("sort", params.sort);
  if (params.date_from)          query.set("date_from", params.date_from);
  if (params.date_to)            query.set("date_to", params.date_to);
  if (params.date)               query.set("date", params.date);
  if (params.key_by_date !== undefined) query.set("key_by_date", String(params.key_by_date));
  if (params.format)             query.set("format", params.format);

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-V9gDze3qV2PL.gateway.appmedo.com/v1/data/eod?${query.toString()}`,
    { method: "GET", headers: { "Accept": "application/json" } }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
// Get daily AAPL data for January 2024, sorted ascending
const result = await getEodData("AAPL", {
  interval: "day",
  date_from: "2024-01-01",
  date_to: "2024-01-31",
  sort: "asc",
});
result.data.forEach(bar => console.log(`${bar.date}: close=${bar.close}`));
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/eod.ts`)

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
    `https://app-b0t9jb6nl2pt-api-V9gDze3qV2PL.gateway.appmedo.com/v1/data/eod?${query.toString()}`,
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
async function fetchEodData(symbol: string, params: EodParams = {}) {
  const { data, error } = await supabase.functions.invoke("eod", {
    body: { symbols: symbol, ...params },
  });
  if (error) throw error;
  return data as EodResponse;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function fetchEodData(symbol: string, params: EodParams = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eod`, {
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

  return res.json() as Promise<EodResponse>;
}
```
