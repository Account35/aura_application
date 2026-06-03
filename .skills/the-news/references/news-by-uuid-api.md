# News by UUID API

**Endpoint:** `GET https://app-b0t9jb6nl2pt-api-qYGWo8XA7M7Y.gateway.appmedo.com/v1/news/uuid/{uuid}`

Retrieve detailed information for a specific article using its unique UUID identifier. Ideal for fetching previously stored articles or accessing specific content directly.

---

## Request Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uuid` | `string` | Yes | Unique article identifier (inserted in the URL path) |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No additional query parameters for this endpoint |

---

## Response Fields

Single article object (not an array):

| Field path | Type | Description |
|------------|------|-------------|
| `uuid` | `string` | Unique article identifier |
| `title` | `string` | Article title |
| `description` | `string` | Meta description |
| `keywords` | `string` | Meta keywords |
| `snippet` | `string` | First 60 characters of body text |
| `url` | `string` | Article original URL |
| `image_url` | `string?` | Image URL (nullable) |
| `language` | `string` | Source language code |
| `published_at` | `string` | Publication datetime (UTC) |
| `source` | `string` | Source domain |
| `categories` | `array` | Category tag array |

#### Error Responses

| Status | Description |
|--------|-------------|
| `404` | Article not found for the given UUID |

---

## Generation-time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"] ?? "";

interface NewsArticle {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string | null;
  language: string;
  published_at: string;
  source: string;
  categories: string[];
}

async function getNewsByUuid(uuid: string): Promise<NewsArticle> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-qYGWo8XA7M7Y.gateway.appmedo.com/v1/news/uuid/${encodeURIComponent(uuid)}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (response.status === 404) throw new Error(`Article not found: ${uuid}`);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Example usage:**
```typescript
const article = await getNewsByUuid("147013d8-6c2c-4d50-8bad-eb3c8b7f5740");
console.log(article.title, article.published_at, article.url);
```

---

## Post-generation Usage (Edge Function Call from Application)

### Edge Function (`edge-functions/news-by-uuid.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let uuid: string;
  try {
    const body = await req.json();
    uuid = body.uuid;
    if (!uuid) throw new Error("Missing uuid");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";

  const upstream = await fetch(
    `https://app-b0t9jb6nl2pt-api-qYGWo8XA7M7Y.gateway.appmedo.com/v1/news/uuid/${encodeURIComponent(uuid)}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (upstream.status === 404) {
    return new Response(JSON.stringify({ error: "Article not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

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
async function fetchNewsByUuid(uuid: string) {
  const { data, error } = await supabase.functions.invoke("news-by-uuid", {
    body: { uuid },
  });
  if (error) throw error;
  return data as NewsArticle;
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function fetchNewsByUuid(uuid: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-by-uuid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid }),
  });

  if (res.status === 404) throw new Error("Article not found");
  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Rate limit exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  return res.json() as Promise<NewsArticle>;
}
```
