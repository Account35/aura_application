# Assistant API — AI Weather Assistant Endpoints

This file covers the following two POST endpoints:
1. **Start new session** (`POST /assistant/session`) — `api-79jKPlpvAJ0L` (billed)
2. **Resume existing session** (`POST /assistant/session/{session_id}`) — `api-oYA6ZxVqyK8a` (not billed)

The AI weather assistant supports 50+ languages and retains location context within a session, allowing follow-up questions without incurring additional charges (resume-session endpoint is free).

---

## Endpoint 1 — Start New Session

**Endpoint**: `POST https://app-b0t9jb6nl2pt-api-79jKPlpvAJ0L.gateway.appmedo.com/assistant/session`

Initiates a new AI weather assistant conversation to obtain weather information, activity recommendations, or weather-related advice.

### Request parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | Weather query or activity question, e.g. "What is the weather like in London today?" |

**Request Content-Type**: `application/json`

### Response fields

| Field path | Type | Description |
|------------|------|-------------|
| `answer` | `string` | AI-generated natural-language response |
| `data` | `object` | Weather data used to generate the response (contains current, minutely, hourly, daily, alerts) |
| `session_id` | `string` | Session identifier for subsequent resume calls |

---

## Endpoint 2 — Resume Existing Session

**Endpoint**: `POST https://app-b0t9jb6nl2pt-api-oYA6ZxVqyK8a.gateway.appmedo.com/assistant/session/{session_id}`

Continues an existing conversation; the assistant retains previous messages and location context. This endpoint is not billed and is suitable for multi-turn follow-up scenarios.

### Request parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | `string` (path parameter) | Yes | The `session_id` returned when the session was started |
| `prompt` | `string` (request body) | Yes | Follow-up question, e.g. "Do I need to bring an umbrella?" |

**Request Content-Type**: `application/json`

### Response fields

| Field path | Type | Description |
|------------|------|-------------|
| `answer` | `string` | AI-generated context-aware response |
| `data` | `object` | Updated weather data if the location has changed |
| `session_id` | `string` | Current session identifier |

---

## Generation-time usage (Agent calls directly)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;
const AUTH_VALUE = `Bearer ${apiKey}`;

// --- Endpoint 1: Start new session ---
interface AssistantResponse {
  answer: string;
  data: object;
  session_id: string;
}

async function startAssistantSession(prompt: string): Promise<AssistantResponse> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-79jKPlpvAJ0L.gateway.appmedo.com/assistant/session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": AUTH_VALUE,
      },
      body: JSON.stringify({ prompt }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}

// --- Endpoint 2: Resume existing session ---
async function resumeAssistantSession(
  sessionId: string,
  prompt: string
): Promise<AssistantResponse> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-oYA6ZxVqyK8a.gateway.appmedo.com/assistant/session/${sessionId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": AUTH_VALUE,
      },
      body: JSON.stringify({ prompt }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}

// --- Multi-turn conversation example ---
// Step 1: Start a new session
const session = await startAssistantSession("What is the weather like in London?");
console.log(session.answer);
// → "Currently in London, it's partly cloudy with a temperature of 15°C..."
const sessionId = session.session_id;

// Step 2: Follow up (not billed)
const followUp = await resumeAssistantSession(sessionId, "Do I need a hat?");
console.log(followUp.answer);
// → "With the current wind speeds of 20 km/h, a hat would be advisable..."
```

---

## Post-generation usage (in-app via Edge Function)

### Edge Function — weather-assistant-start.ts

```typescript
// edge-functions/weather-assistant-start.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let prompt: string;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
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

  const upstream = await fetch(
    "https://app-b0t9jb6nl2pt-api-79jKPlpvAJ0L.gateway.appmedo.com/assistant/session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt }),
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

### Edge Function — weather-assistant-resume.ts

```typescript
// edge-functions/weather-assistant-resume.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let sessionId: string, prompt: string;
  try {
    const body = await req.json();
    sessionId = body.session_id;
    prompt = body.prompt;
    if (!sessionId) throw new Error("Missing session_id");
    if (!prompt) throw new Error("Missing prompt");
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

  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-oYA6ZxVqyK8a.gateway.appmedo.com/assistant/session/${sessionId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt }),
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

### Frontend invocation examples

**Preferred (when supabase client is available):**

```typescript
// Start a new session
async function startWeatherChat(prompt: string) {
  const { data, error } = await supabase.functions.invoke("weather-assistant-start", {
    body: { prompt },
  });
  if (error) throw error;
  return data; // { answer, data, session_id }
}

// Resume session (not billed)
async function continueWeatherChat(sessionId: string, prompt: string) {
  const { data, error } = await supabase.functions.invoke("weather-assistant-resume", {
    body: { session_id: sessionId, prompt },
  });
  if (error) throw error;
  return data; // { answer, data, session_id }
}
```

**Fallback (when supabase client is not available):**

```typescript
const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function weatherApiPost(endpoint: string, body: object) {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// Start a new session
const session = await weatherApiPost("weather-assistant-start", { prompt: "London weather today?" });
const sessionId = session.session_id;

// Follow up (not billed)
const reply = await weatherApiPost("weather-assistant-resume", {
  session_id: sessionId,
  prompt: "Should I bring an umbrella?",
});
```

---

## Notes

- **Session lifecycle**: The validity period of `session_id` is determined by the OpenWeatherMap platform. Use it within the same user conversation flow; do not persist it across separate sessions.
- **Billing difference**: Starting a new session (`api-79jKPlpvAJ0L`) incurs a charge of ¥0.17 per call; resuming a session (`api-oYA6ZxVqyK8a`) is free and can be called any number of times.
- **Multi-turn design guidance**: Store `session_id` in React state or a Zustand store. For each new user message, determine whether it is a first query or a follow-up and call the corresponding Edge Function accordingly.
