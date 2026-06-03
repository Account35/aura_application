# Stock Prices API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-oYA6Z8wDBN1a.gateway.appmedo.com/v1/data/quote`

Retrieve real-time stock quote data for one or more US-listed stocks, including price, daily high/low, 52-week range, market cap, volume, and pre/post-market data.

---

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | `string` | Yes | API authentication token |
| `symbols` | `string` | Yes | Comma-separated list of ticker symbols (e.g. `AAPL,TSLA,MSFT`) |
| `extended_hours` | `boolean` | No | Whether to include pre-market and after-hours trading data |
| `key_by_ticker` | `boolean` | No | Whether to return results keyed by ticker symbol |

---

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `meta.requested` | `number` | Number of stocks requested |
| `meta.returned` | `number` | Number of stocks successfully returned |
| `data` | `array` | Array of quote objects |
| `data[].ticker` | `string` | Ticker symbol |
| `data[].name` | `string` | Company name |
| `data[].price` | `number` | Current price |
| `data[].day_high` | `number` | Today's high price |
| `data[].day_low` | `number` | Today's low price |
| `data[].day_open` | `number` | Today's open price |
| `data[].52_week_high` | `number` | 52-week high price |
| `data[].52_week_low` | `number` | 52-week low price |
| `data[].market_cap` | `number` | Market capitalization (USD) |
| `data[].previous_close_price` | `number` | Previous trading day's closing price |
| `data[].day_change` | `number` | Today's price change (percentage) |
| `data[].volume` | `number` | Today's trading volume |
| `data[].currency` | `string` | Pricing currency (usually `USD`) |
| `data[].exchange_short` | `string` | Exchange short name (e.g. `NASDAQ`) |
| `data[].exchange_long` | `string` | Exchange full name |
| `data[].mic_code` | `string` | MIC market identifier code |
| `data[].is_extended_hours_price` | `boolean` | Whether the current price is a pre/post-market price |
| `data[].last_trade_time` | `string` | Last trade time (ISO 8601 UTC) |
| `data[].previous_close_price_time` | `string` | Previous close price time (ISO 8601 UTC) |

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const API_TOKEN = "JhDKCuOjkX7RdCP22zqz0QU52DQELlf5Ld5IgRyd"; // user-managed — replace with actual token

interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  day_high: number;
  day_low: number;
  day_open: number;
  "52_week_high": number;
  "52_week_low": number;
  market_cap: number;
  previous_close_price: number;
  day_change: number;
  volume: number;
  currency: string;
  exchange_short: string;
  exchange_long: string;
  mic_code: string;
  is_extended_hours_price: boolean;
  last_trade_time: string;
  previous_close_price_time: string;
}

interface StockQuoteResponse {
  meta: { requested: number; returned: number };
  data: StockQuote[];
}

async function getStockPrices(
  symbols: string,
  options: { extendedHours?: boolean; keyByTicker?: boolean } = {}
): Promise<StockQuoteResponse> {
  const query = new URLSearchParams({ api_token: API_TOKEN, symbols });
  if (options.extendedHours !== undefined) query.set("extended_hours", String(options.extendedHours));
  if (options.keyByTicker !== undefined)   query.set("key_by_ticker", String(options.keyByTicker));

  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-oYA6Z8wDBN1a.gateway.appmedo.com/v1/data/quote?${query.toString()}`,
    { method: "GET", headers: { "Accept": "application/json" } }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
// Get real-time quotes for Apple, Tesla, and Microsoft
const result = await getStockPrices("AAPL,TSLA,MSFT");
result.data.forEach(q => console.log(`${q.ticker}: $${q.price} (${q.day_change > 0 ? "+" : ""}${q.day_change}%)`));
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/stock-prices.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let symbols: string;
  let extendedHours: string | undefined;
  let keyByTicker: string | undefined;
  try {
    const body = await req.json();
    symbols = body.symbols;
    if (!symbols) throw new Error("Missing symbols");
    extendedHours = body.extended_hours;
    keyByTicker   = body.key_by_ticker;
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

  const query = new URLSearchParams({ symbols });
  if (extendedHours !== undefined) query.set("extended_hours", extendedHours);
  if (keyByTicker !== undefined)   query.set("key_by_ticker", keyByTicker);

  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-oYA6Z8wDBN1a.gateway.appmedo.com/v1/data/quote?${query.toString()}`,
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
async function fetchStockPrices(symbols: string, options: { extendedHours?: boolean; keyByTicker?: boolean } = {}) {
  const { data, error } = await supabase.functions.invoke("stock-prices", {
    body: {
      symbols,
      ...(options.extendedHours !== undefined && { extended_hours: String(options.extendedHours) }),
      ...(options.keyByTicker !== undefined && { key_by_ticker: String(options.keyByTicker) }),
    },
  });
  if (error) throw error;
  return data as StockQuoteResponse;
}
```

**Fallback (when supabase client is not available):**

```typescript
async function fetchStockPrices(symbols: string, options: { extendedHours?: boolean; keyByTicker?: boolean } = {}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stock-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols, ...options }),
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

  return res.json() as Promise<StockQuoteResponse>;
}
```
