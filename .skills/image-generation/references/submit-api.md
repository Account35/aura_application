# Submit Image Generation Task — API Reference

## Endpoint

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `https://app-b0t9jb6nl2pt-api-zYkZzKQJrBdL.gateway.appmedo.com/image-generation/submit` |
| Content-Type | `application/json` |
| Auth | `X-Gateway-Authorization: Bearer <key>` |

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contents` | `Array` | ✅ | Input content collection; each element represents one round of input |
| `contents[].parts` | `Array` | ✅ | Content parts for this round; may contain both text and images |
| `contents[].parts[].text` | `String` | ❌ | Prompt text description |
| `contents[].parts[].inline_data` | `Object` | ❌ | Image input object (required for image-to-image) |
| `contents[].parts[].inline_data.mime_type` | `String` | ✅* | Image MIME type: `image/png`, `image/jpeg`, or `image/webp` |
| `contents[].parts[].inline_data.data` | `String` | ✅* | Pure Base64 string (without the `data:image/...;base64,` prefix) |

*Required when `inline_data` is present.

**Request Limits**
- Total request size < 20 MB
- Supported formats: PNG, JPEG, WEBP

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `status` | `number` | `0` = success, `1` = failure |
| `data.taskId` | `string` | Task ID for subsequent status queries |
| `data.status` | `string` | Initial status, always `"PENDING"` |
| `data.estimatedTime` | `number` | Estimated completion time in seconds |
| `message` | `string?` | Present only when `status=1`; error description |

## Example Response

```json
{
  "status": 0,
  "data": {
    "taskId": "task-1734567890123-abc12345",
    "status": "PENDING",
    "estimatedTime": 600
  }
}
```

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string }; // data: pure Base64, no prefix
}

interface SubmitResponse {
  taskId: string;
  status: string;
  estimatedTime?: number;
}

async function submitTask(parts: Part[]): Promise<SubmitResponse> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-zYkZzKQJrBdL.gateway.appmedo.com/image-generation/submit",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error: ${json.message}`);

  return json.data;
}

// ── Usage examples ──────────────────────────────────────────────

// Text-to-Image
const { taskId } = await submitTask([
  { text: "A cute orange kitten in a sunny garden, cartoon style, high definition" }
]);

// Image-to-Image (style transfer)
// Convert image file to pure Base64 first (Node.js):
// const base64 = fs.readFileSync("photo.png").toString("base64");
const { taskId: taskId2 } = await submitTask([
  { inline_data: { mime_type: "image/png", data: "<pure-base64-string>" } },
  { text: "Convert to cartoon illustration style" }
]);

// Multi-Image composition
const { taskId: taskId3 } = await submitTask([
  { inline_data: { mime_type: "image/png",  data: "<base64-image-1>" } },
  { inline_data: { mime_type: "image/jpeg", data: "<base64-image-2>" } },
  { text: "Compose the person from image 1 into the scenery of image 2, natural and harmonious" }
]);
```

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/image-generation-submit.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let contents: unknown;
  try {
    const body = await req.json();
    contents = body.contents;
    if (!contents) throw new Error("Missing contents");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const upstream = await fetch(
    "https://app-b0t9jb6nl2pt-api-zYkZzKQJrBdL.gateway.appmedo.com/image-generation/submit",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ contents }),
    }
  );

  // Forward quota/balance errors verbatim
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
async function submitImageTask(contents: unknown[]) {
  const { data, error } = await supabase.functions.invoke("image-generation-submit", {
    body: { contents },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API error: ${data.message}`);
  return data.data; // { taskId, status, estimatedTime }
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function submitImageTask(contents: unknown[]) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-generation-submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exceeded: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const json = await res.json();
  if (json.status !== 0) throw new Error(`API error: ${json.message}`);
  return json.data;
}
```
