---
name: global-stock-price-data
description: Query global stock prices, intraday data, historical EOD data, financial news, and entity search via StockData.org. Use this skill whenever the user wants real-time stock quotes, price charts, market history, stock-related news, or needs to look up a ticker symbol or company name. Trigger on any request involving stock prices, market data, investment research, or financial news.
license: MIT
---

# Global Stock Price Data

Query real-time and historical stock market data, financial news, and entity search through [StockData.org](https://www.stockdata.org). This skill wraps five endpoints covering live quotes, intraday OHLCV, end-of-day history, market news with sentiment, and entity search.

## Capability Overview

| Endpoint | Method | API ID |
|----------|--------|--------|
| Stock Prices (real-time quotes) | GET | `api-oYA6Z8wDBN1a` |
| Intraday Data (adjusted) | GET | `api-pLVzJ8y7V3KL` |
| End-of-day Historical Data | GET | `api-V9gDze3qV2PL` |
| Finance & Market News | GET | `api-AalZze1qEWML` |
| Entity Search | GET | `api-Xa6JZq205MNa` |

Base host: `app-b0t9jb6nl2pt-api-oYA6Z8wDBN1a.gateway.appmedo.com`

**Authentication:** All endpoints require `api_token` as a query parameter (user-managed key). In Edge Function deployments, the key is retrieved via `Deno.env.get("INTEGRATIONS_API_KEY")` and passed as `X-Gateway-Authorization: Bearer ${apiKey}` header to the upstream gateway.

**Billing:** Each API call is billed. Original price: ¥0.10/call; discounted price: ¥0.02/call. Avoid unnecessary repeated calls.

---

## End-to-End Workflow

Choose the endpoint that matches the user's intent:

1. **Stock Prices** — real-time quote for one or more tickers → `GET /v1/data/quote`
2. **Intraday Data** — minute/hour-level OHLCV for a single ticker → `GET /v1/data/intraday`
3. **End-of-day Historical Data** — daily/weekly/monthly OHLCV history → `GET /v1/data/eod`
4. **Finance & Market News** — latest financial news filtered by symbol, sentiment, industry, etc. → `GET /v1/news/all`
5. **Entity Search** — look up ticker symbols or company names → `GET /v1/entity/search`

For full parameter tables and code samples, read the relevant reference file:

> Read `references/stock-prices-api.md` for Stock Prices spec and code.
> Read `references/intraday-api.md` for Intraday Data spec and code.
> Read `references/eod-api.md` for End-of-day Historical Data spec and code.
> Read `references/news-api.md` for Finance & Market News spec and code.
> Read `references/entity-search-api.md` for Entity Search spec and code.

---

## Generation-Time Usage (Agent Direct Call)

The `api_token` is a user-managed credential. Append it as a query parameter to all requests.

General pattern:

```typescript
const API_TOKEN = "JhDKCuOjkX7RdCP22zqz0QU52DQELlf5Ld5IgRyd"; // user-managed — replace with actual token

async function callStockDataApi(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

All endpoints append `api_token` to the query string. See each `references/<endpoint>-api.md` for the full typed function with all parameters.

---

## Post-Generation Usage (In-App via Edge Function)

Each endpoint requires its own Edge Function to keep the `api_token` off the browser. See each `references/<endpoint>-api.md` for the complete Edge Function boilerplate and frontend fetch helper.

**Security contract:**
- Client sends JSON with query parameters to the Edge Function.
- Edge Function reads `INTEGRATIONS_API_KEY` from Deno env and passes it as `X-Gateway-Authorization: Bearer ${apiKey}` header to the upstream gateway.
- 429 (rate limit) and 402 (insufficient balance) error bodies are forwarded verbatim to the client.
- The raw API token is never exposed to the browser.

---

## Important Notes

- **Key security**: `api_token` is a user-managed credential. In post-generation (Edge Function) scenarios, store it in the Deno environment variable (`INTEGRATIONS_API_KEY`) and never expose it to the frontend.
- **Error handling**: Always handle `429` (rate limit) and `402` (insufficient balance) responses; also handle `401` (invalid token).
- **Billing**: Each API call costs ¥0.02/call (discounted; original ¥0.10/call). Avoid unnecessary repeated calls.
- **Data freshness**: Real-time quotes are sourced from IEX trade reports, not tick-level; historical data is adjusted for splits.
- **Market coverage**: Primarily covers US-listed stocks; the EOD endpoint also supports crypto and forex historical data.
- **Entity Search limit**: Each request returns at most 50 results.
