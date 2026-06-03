# Query Text-to-Video Task

## API Specification

| Property | Value |
|----------|-------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-oLpZ7eD5j2Pa.gateway.appmedo.com/v1/videos/text2video/{id}` |
| HTTP Method | `GET` |
| Request Header Content-Type | `application/json` |
| Auth Header | `X-Gateway-Authorization: Bearer <AUTH_VALUE>` |
| Billing | Free (query endpoint is not billed) |

---

## Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Task ID (`task_id`) or user-defined task ID (`external_task_id`) |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; `0` means success |
| `message` | `string` | Status description |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID |
| `data.task_status` | `string` | Task status: `submitted`, `processing`, `succeed`, `failed` |
| `data.task_status_msg` | `string?` | Supplementary task status message (e.g. failure reason) |
| `data.task_info.external_task_id` | `string?` | User-defined task ID (if provided) |
| `data.created_at` | `number` | Task creation time (Unix timestamp, seconds) |
| `data.updated_at` | `number` | Task last updated time (Unix timestamp, seconds) |
| `data.task_result.videos` | `array?` | List of videos when task succeeds (`succeed` status only) |
| `data.task_result.videos[].id` | `string` | Video ID |
| `data.task_result.videos[].url` | `string` | Video CDN temporary URL |
| `data.task_result.videos[].duration` | `string` | Video duration in seconds (string format, e.g. `"5.0"`) |

### Response Example (Success)

```json
{
  "code": 0,
  "message": "success",
  "request_id": "req_123456",
  "data": {
    "task_id": "task_123",
    "task_status": "succeed",
    "task_status_msg": "Task completed",
    "task_info": {
      "external_task_id": "external_123"
    },
    "created_at": 1704067200,
    "updated_at": 1704070800,
    "task_result": {
      "videos": [
        {
          "id": "video_123",
          "url": "https://example.com/video.mp4",
          "duration": "5.0"
        }
      ]
    }
  }
}
```

---

## Generation-Time Usage (Direct Agent Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — key injected by platform

interface QueryTaskResult {
  task_status: string;
  task_status_msg?: string;
  task_result?: {
    videos: Array<{ id: string; url: string; duration: string }>;
  };
}

async function queryTask(taskId: string): Promise<QueryTaskResult> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-oLpZ7eD5j2Pa.gateway.appmedo.com/v1/videos/text2video/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data as QueryTaskResult;
}
```

**Generation-time file download (required):**

The video URL returned by the generation endpoint is a CDN temporary link. In generation-time (direct Agent call) scenarios, after obtaining the URL you **must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o /tmp/generated_video.mp4 "<task_result.videos[0].url>"
```

**Complete generation-time workflow (including download step):**

1. Call `submitTextToVideo` to obtain `task_id` (see `references/submit-api.md`)
2. Call `queryTask(taskId)` every 7 seconds until `task_status === "succeed"` or `"failed"`
3. Retrieve the video URL from `task_result.videos[0].url`
4. Use the Bash tool to run `curl -L -o <local-path>.mp4 "<url>"` to download the video locally
5. Inform the user of the path where the file has been saved

> **Note**: Upstream CDN links are time-limited. Download immediately after obtaining the URL; do not delay.

---

## Post-Generation Usage (In-App via Edge Function)

The query Edge Function automatically transfers the video URL to Supabase Storage when the task completes (`succeed`) and returns a persistent public URL to the frontend.

### Edge Function Code

```typescript
// edge-functions/kling-query-text2video.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote video directly into Supabase Storage.
 * Returns a persistent public URL for the video.
 */
async function streamVideoToStorage(
  videoUrl: string,
  bucketName = "generated-media"
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.startsWith("video/") ? contentType.split("/")[1].split(";")[0] : "mp4";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
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
    `https://app-b0t9jb6nl2pt-api-oLpZ7eD5j2Pa.gateway.appmedo.com/v1/videos/text2video/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
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

  const result = await upstream.json();
  if (result.code !== 0) {
    return new Response(JSON.stringify({ error: `API error ${result.code}: ${result.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const taskData = result.data;

  // If task succeeded, transfer video to Supabase Storage for persistence
  if (taskData.task_status === "succeed" && taskData.task_result?.videos?.length > 0) {
    const videos = await Promise.all(
      taskData.task_result.videos.map(async (video: { id: string; url: string; duration: string }) => {
        const transfer = await streamVideoToStorage(video.url);
        return {
          ...video,
          // Replace ephemeral CDN URL with persistent Supabase URL
          url: transfer.success ? transfer.publicUrl : video.url,
          storage_transfer_error: transfer.success ? undefined : transfer.error,
        };
      })
    );
    taskData.task_result.videos = videos;
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend Call to Edge Function (Query Task)

**Recommended (when supabase client is available):**

```typescript
async function queryTextToVideoTask(taskId: string) {
  const { data, error } = await supabase.functions.invoke("kling-query-text2video", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data as {
    task_id: string;
    task_status: string;
    task_status_msg?: string;
    task_result?: {
      videos: Array<{ id: string; url: string; duration: string }>;
    };
  };
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function queryTextToVideoTask(taskId: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-query-text2video`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`Quota exhausted: ${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`Insufficient balance: ${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const json = await res.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data;
}
```

**Complete frontend polling example:**

```typescript
async function pollUntilComplete(taskId: string, onProgress?: (status: string) => void) {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTextToVideoTask(taskId);
    onProgress?.(result.task_status);

    if (result.task_status === "succeed") return result;
    if (result.task_status === "failed") {
      throw new Error(`Video generation failed: ${result.task_status_msg ?? "unknown reason"}`);
    }
    // submitted / processing → continue polling
  }
  throw new Error(`Task ${taskId} timed out (exceeded 10 minutes)`);
}
```

---

## Notes

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in Edge Functions; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance); forward these error bodies verbatim to the frontend.
- **Billing**: This query endpoint is free, but each submit costs **¥35.00** discounted (¥45.50 original price). Avoid duplicate submissions due to improper polling.
- **Video URL expiry**: Upstream CDN video links are temporary. The Edge Function automatically transfers them to Supabase Storage `generated-media` bucket to ensure the frontend receives a persistent URL.
- **Polling interval**: Recommended every 5–10 seconds; 7 seconds is suggested. Total timeout should not exceed 10 minutes.
- **Task status**: `submitted` (queued) → `processing` (in progress) → `succeed` (completed) / `failed` (failed). `task_result.videos` is only populated when status is `succeed`.
