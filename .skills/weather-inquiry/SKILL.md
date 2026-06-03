---
name: weather-inquiry
description: Query real-time weather, forecasts, historical data, and AI weather summaries via the OpenWeatherMap One Call 3.0 API. Use this skill whenever the user needs current conditions, hourly/daily forecasts, historical weather for a timestamp, daily aggregated statistics, a human-readable weather overview, or wants to start/continue an AI weather assistant conversation.
license: MIT
---

# Weather Inquiry — OpenWeatherMap One Call 3.0

## Capabilities

Access weather data for any coordinate worldwide via the OpenWeatherMap One Call 3.0 API. Six capabilities are supported:

| Capability | Endpoint | API ID |
|------------|----------|--------|
| Current weather + forecast (minutely 1 h / hourly 48 h / daily 8 d) + alerts | `GET https://app-b0t9jb6nl2pt-api-wL1zlmgJGAlY.gateway.appmedo.com/data/3.0/onecall` | `api-wL1zlmgJGAlY` |
| Historical weather for a timestamp (1979-01-01 to +4 days) | `GET https://app-b0t9jb6nl2pt-api-Aa2PZmgJq5OL.gateway.appmedo.com/data/3.0/onecall/timemachine` | `api-Aa2PZmgJq5OL` |
| Daily aggregated weather statistics (1979-01-02 to +1.5 years) | `GET https://app-b0t9jb6nl2pt-api-2Y00zmgJ8lBY.gateway.appmedo.com/data/3.0/onecall/day_summary` | `api-2Y00zmgJ8lBY` |
| AI-generated weather overview (today / tomorrow natural-language summary) | `GET https://app-b0t9jb6nl2pt-api-oYA6ZxVqenDa.gateway.appmedo.com/data/3.0/onecall/overview` | `api-oYA6ZxVqenDa` |
| AI Weather Assistant — start new session | `POST https://app-b0t9jb6nl2pt-api-79jKPlpvAJ0L.gateway.appmedo.com/assistant/session` | `api-79jKPlpvAJ0L` |
| AI Weather Assistant — resume existing session | `POST https://app-b0t9jb6nl2pt-api-oYA6ZxVqyK8a.gateway.appmedo.com/assistant/session/{session_id}` | `api-oYA6ZxVqyK8a` |

- **Authentication**: `platform_managed` — API key is injected by the platform gateway; use `X-Gateway-Authorization: Bearer ${apiKey}` where `apiKey` comes from `process.env["INTEGRATIONS_API_KEY"]`
- **Data refresh**: Updated every 10 minutes (based on OpenWeather proprietary models)
- **Supported languages**: 50+ (specify via the `lang` parameter)
- **Billing**: Standard ¥0.30 / call, discounted ¥0.17 / call (AI Assistant resume-session endpoint is free)

**Response example (current weather + forecast):**

```json
{
  "lat": 33.44,
  "lon": -94.04,
  "timezone": "America/Chicago",
  "current": {
    "dt": 1684929490,
    "temp": 292.55,
    "feels_like": 292.87,
    "pressure": 1014,
    "humidity": 89,
    "weather": [{"id": 803, "main": "Clouds", "description": "broken clouds"}]
  },
  "hourly": [...],
  "daily": [...]
}
```

> For full parameter documentation and code examples, see `references/onecall-api.md` (weather data endpoints) and `references/assistant-api.md` (AI assistant endpoints).

---

## Generation-time usage (Agent calls directly)

All endpoints use platform-managed authentication. Read the API key from the environment:

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;
const AUTH_VALUE = `Bearer ${apiKey}`;
```

Choose the appropriate function based on the user's request:

- **Current weather + forecast** → call `getCurrentAndForecast(lat, lon)`, see `references/onecall-api.md`
- **Historical weather for a timestamp** → call `getWeatherByTimestamp(lat, lon, dt)`, see `references/onecall-api.md`
- **Daily aggregated statistics** → call `getDailyAggregation(lat, lon, date)`, see `references/onecall-api.md`
- **AI weather overview** → call `getWeatherOverview(lat, lon)`, see `references/onecall-api.md`
- **AI assistant — start session** → call `startAssistantSession(prompt)`, see `references/assistant-api.md`
- **AI assistant — resume session** → call `resumeAssistantSession(sessionId, prompt)`, see `references/assistant-api.md`

---

## Post-generation usage (in-app via Edge Function)

Deploy a separate Edge Function for each endpoint. The Edge Function injects `INTEGRATIONS_API_KEY` server-side, keeping the API key out of the client browser.

> For complete Edge Function code and frontend invocation examples, see the "Post-generation usage" sections in `references/onecall-api.md` and `references/assistant-api.md`.

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side (Edge Function or generation-time agent). Never expose it to the frontend browser.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance).
- **Billing reminder**: Current weather+forecast, historical timestamp, daily aggregation, AI overview, and AI assistant start-session all incur a charge (¥0.17/call discounted); AI assistant resume-session is free and suitable for follow-up questions at no extra cost.
- **Coordinate precision**: `lat` range −90 to 90, `lon` range −180 to 180, in decimal degrees.
- **Timestamps**: The `timemachine` endpoint's `dt` parameter is a UTC Unix timestamp; only 1979-01-01 to +4 days ahead is supported.
- **Units**: The `units` parameter defaults to `standard` (Kelvin). Use `metric` (Celsius) or `imperial` (Fahrenheit) for most user-facing applications.
