# Query Task Status — API Reference

## Endpoint

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `https://app-b0t9jb6nl2pt-api-GYX1lzGw0DQa.gateway.appmedo.com/image-generation/task` |
| Content-Type | `application/json` |
| Auth | `X-Gateway-Authorization: Bearer <key>` |

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | `string` | ✅ | Task ID returned by the submit endpoint |

## Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `status` | `number` | `0` = success; any other value = failure |
| `data.taskId` | `string` | Task ID |
| `data.status` | `string` | `PENDING` (processing), `SUCCESS` (succeeded), `FAILED` (failed), `TIMEOUT` (timed out) |
| `data.result` | `object?` | Present only on `SUCCESS` |
| `data.result.candidates` | `array` | List of candidate results |
| `data.result.candidates[0].content.role` | `string` | Role identifier, always `"model"` |
| `data.result.candidates[0].content.parts[0].text` | `string` | Markdown image with embedded Base64: `![image](data:image/jpeg;base64,...)` |
| `data.result.candidates[0].finishReason` | `string` | Finish reason, e.g. `"STOP"` |
| `data.result.candidates[0].index` | `number` | Candidate index, e.g. `0` |
| `data.result.candidates[0].safetyRatings` | `array` | Safety rating list, e.g. `[]` |
| `data.error` | `object?` | Present only on `FAILED` |
| `data.error.code` | `string` | Error code, e.g. `"NO_IMAGE"` |
| `data.error.message` | `string` | Error description |

## Example Responses

**Success:**
```json
{
  "status": 0,
  "data": {
    "taskId": "task-20251223-1766469456004-4c322953",
    "status": "SUCCESS",
    "result": {
      "candidates": [
        {
          "content": {
            "role": "model",
            "parts": [
              { "text": "![image](data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/...)" }
            ]
          },
          "finishReason": "STOP",
          "index": 0,
          "safetyRatings": []
        }
      ]
    },
    "error": null
  }
}
```

**Processing:**
```json
{ "status": 0, "data": { "taskId": "...", "status": "PENDING" } }
```

**Failed:**
```json
{ "status": 0, "data": { "taskId": "...", "status": "FAILED", "error": { "code": "NO_IMAGE", "message": "NO_IMAGE" } } }
```

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface TaskResult {
  taskId: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT";
  result?: {
    candidates: Array<{
      content: { role: string; parts: Array<{ text: string }> };
      finishReason: string;
      index: number;
      safetyRatings: unknown[];
    }>;
  };
  error?: { code: string; message: string };
}

async function queryTask(taskId: string): Promise<TaskResult> {
  const response = await fetch(
    "https://app-b0t9jb6nl2pt-api-GYX1lzGw0DQa.gateway.appmedo.com/image-generation/task",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error: ${JSON.stringify(json)}`);

  return json.data;
}

// ── Extract Base64 image from a SUCCESS result ─────────────────
function extractBase64(taskResult: TaskResult): string {
  const markdownText = taskResult.result!.candidates[0].content.parts[0].text;
  // Format: ![image](data:image/jpeg;base64,<BASE64_DATA>)
  const match = markdownText.match(/data:[^;]+;base64,([^)]+)/);
  if (!match) throw new Error("Could not extract Base64 from response");
  return match[1];
}

// ── Save to disk (use Bash tool in generation-time context) ─────
// After extracting base64:
//   echo "<base64>" | base64 -d > ~/generated-image.jpg
```

---

## Post-Generation Usage (In-App via Edge Function)

The query Edge Function also handles the **Base64 → Supabase Storage** transfer so the client always receives a persistent public URL instead of raw Base64.

### Edge Function (`edge-functions/image-generation-query.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** Decode Base64 embedded in the Markdown image string and upload to Supabase Storage. */
async function saveBase64ToStorage(markdownText: string): Promise<string> {
  const match = markdownText.match(/data:([^;]+);base64,([^)]+)/);
  if (!match) throw new Error("Could not parse Base64 image from response");

  const [, mimeType, base64Data] = match;
  const ext = mimeType.split("/")[1] ?? "jpg";
  const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

  // Decode Base64 → Uint8Array
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const { error } = await supabase.storage
    .from("generated-media")
    .upload(filePath, bytes, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from("generated-media").getPublicUrl(filePath);
  return urlData.publicUrl;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.taskId;
    if (!taskId) throw new Error("Missing taskId");
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
    "https://app-b0t9jb6nl2pt-api-GYX1lzGw0DQa.gateway.appmedo.com/image-generation/task",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
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

  const result = await upstream.json();

  // If task succeeded, transfer the Base64 image to Supabase Storage and replace it with a public URL
  if (result?.data?.status === "SUCCESS") {
    try {
      const markdownText = result.data.result.candidates[0].content.parts[0].text;
      const publicUrl = await saveBase64ToStorage(markdownText);
      // Replace inline Base64 with the persistent URL
      result.data.imageUrl = publicUrl;
      // Optionally strip the raw Base64 from the response to keep payload small:
      result.data.result.candidates[0].content.parts[0].text = `![image](${publicUrl})`;
    } catch (storageErr) {
      // Non-fatal: fall back to returning the raw Base64 if storage fails
      console.error("Storage transfer failed:", storageErr);
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend → Edge Function (polling loop)

**Recommended (when supabase client is available):**

```typescript
async function pollTaskResult(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const { data, error } = await supabase.functions.invoke("image-generation-query", {
      body: { taskId },
    });
    if (error) throw error;

    if (data.data?.status === "SUCCESS") {
      return data.data.imageUrl; // persistent Supabase Storage URL
    }
    if (data.data?.status === "FAILED") {
      throw new Error(`Task failed: ${JSON.stringify(data.data.error)}`);
    }
    if (data.data?.status === "TIMEOUT") {
      throw new Error(`Task ${taskId} timed out on the server side`);
    }
    // PENDING → continue polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function pollTaskResult(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-generation-query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
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
    if (json.data?.status === "SUCCESS") return json.data.imageUrl;
    if (json.data?.status === "FAILED") {
      throw new Error(`Task failed: ${JSON.stringify(json.data.error)}`);
    }
    if (json.data?.status === "TIMEOUT") {
      throw new Error(`Task ${taskId} timed out on the server side`);
    }
    // PENDING → continue polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```
