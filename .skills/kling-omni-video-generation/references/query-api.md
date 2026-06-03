# Query Omni-Video Task

## API Specification

| Property | Value |
|----------|-------|
| Endpoint | `GET https://app-b0t9jb6nl2pt-api-pLVzAEz1ZQOL.gateway.appmedo.com/v1/videos/omni-video/{task_id}` |
| HTTP Method | `GET` |
| Request Header Content-Type | `application/json` |
| Authorization Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Billing | Free (query endpoint is not billed) |

---

## Parameter Reference

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | `string` | Conditionally required | System-generated task ID; use either this or `external_task_id` |
| `external_task_id` | `string` | Conditionally required | User-defined task ID; use either this or `task_id` |

### Response Fields

| Field Path | Type | Description |
|------------|------|-------------|
| `code` | `number` | Status code; `0` indicates success |
| `message` | `string` | Status description |
| `request_id` | `string` | Unique request identifier |
| `data.task_id` | `string` | Task ID |
| `data.task_status` | `string` | Task status: `submitted`, `processing`, `succeed`, `failed` |
| `data.task_status_msg` | `string?` | Supplemental task status message (e.g. failure reason) |
| `data.task_info.external_task_id` | `string?` | User-defined task ID (if provided) |
| `data.task_result.videos` | `array?` | Video list when task succeeded (only present in `succeed` status) |
| `data.task_result.videos[].id` | `string` | Video ID |
| `data.task_result.videos[].url` | `string` | Ephemeral video CDN URL (expires after 30 days) |
| `data.task_result.videos[].watermark_url` | `string?` | Video URL with watermark |
| `data.task_result.videos[].duration` | `string` | Video duration in seconds as a string (e.g. `"5.0"`) |
| `data.watermark_info.enabled` | `boolean?` | Whether watermark is enabled |
| `data.final_unit_deduction` | `string?` | Final deduction unit count |
| `data.created_at` | `number` | Task creation time (Unix timestamp in milliseconds) |
| `data.updated_at` | `number` | Task last-updated time (Unix timestamp in milliseconds) |

### Response Example (Success)

```json
{
  "code": 0,
  "message": "success",
  "request_id": "req_abc123",
  "data": {
    "task_id": "task_xyz789",
    "task_status": "succeed",
    "task_status_msg": "Task completed",
    "task_info": {
      "external_task_id": "my_task_001"
    },
    "task_result": {
      "videos": [
        {
          "id": "video_001",
          "url": "https://cdn.klingai.com/video/example.mp4",
          "watermark_url": "https://cdn.klingai.com/video/example_wm.mp4",
          "duration": "5.0"
        }
      ]
    },
    "watermark_info": {
      "enabled": false
    },
    "final_unit_deduction": "1",
    "created_at": 1722769557708,
    "updated_at": 1722769620000
  }
}
```

---

## Generation-time Usage (Direct Agent Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed — key injected by platform

interface OmniVideoQueryResult {
  task_status: string;
  task_status_msg?: string;
  task_result?: {
    videos: Array<{
      id: string;
      url: string;
      watermark_url?: string;
      duration: string;
    }>;
  };
}

async function queryOmniVideoTask(taskId: string): Promise<OmniVideoQueryResult> {
  const response = await fetch(
    `https://app-b0t9jb6nl2pt-api-pLVzAEz1ZQOL.gateway.appmedo.com/v1/videos/omni-video/${encodeURIComponent(taskId)}`,
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

  return json.data as OmniVideoQueryResult;
}
```

**Generation-time file download (required):**

The video URL returned by the generation API is an ephemeral CDN link. In generation-time scenarios (direct Agent call), once you obtain the URL, **you must immediately use the Bash tool to download the file locally** so the user can view the result.

```bash
curl -L -o /tmp/generated_omni_video.mp4 "<task_result.videos[0].url>"
```

**Complete generation-time workflow (including download step):**

1. Call `submitOmniVideo(options)` to obtain `task_id` (see `references/submit-api.md`)
2. Call `queryOmniVideoTask(taskId)` every 7 seconds until `task_status === "succeed"` or `"failed"`
3. Retrieve the video URL from `task_result.videos[0].url`
4. Use the Bash tool to run `curl -L -o <local-path>.mp4 "<url>"` to download the video locally
5. Inform the user that the file has been saved to the corresponding path

> **Note**: The upstream CDN link expires after 30 days. Download immediately after obtaining the URL — do not delay.

---

## Post-generation Usage (In-app via Edge Function)

The query Edge Function automatically transfers the video URL to Supabase Storage once the task completes (`succeed`), returning a persistent public URL to the frontend.

### Edge Function Code

```typescript
// edge-functions/kling-omni-video-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote video directly into Supabase Storage.
 * Returns a persistent public URL, replacing the ephemeral CDN link.
 */
async function streamVideoToStorage(
  videoUrl: string,
  bucketName = "generated-media"
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.startsWith("video/")
      ? contentType.split("/")[1].split(";")[0]
      : "mp4";
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
    `https://app-b0t9jb6nl2pt-api-pLVzAEz1ZQOL.gateway.appmedo.com/v1/videos/omni-video/${encodeURIComponent(taskId)}`,
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
    return new Response(
      JSON.stringify({ error: `API error ${result.code}: ${result.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const taskData = result.data;

  // If task succeeded, transfer videos to Supabase Storage for persistence
  if (taskData.task_status === "succeed" && taskData.task_result?.videos?.length > 0) {
    const videos = await Promise.all(
      taskData.task_result.videos.map(async (video: {
        id: string;
        url: string;
        watermark_url?: string;
        duration: string;
      }) => {
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

### Frontend Call — Edge Function (Query Task)

**Recommended approach (when supabase client is available):**

```typescript
interface OmniVideoTaskResult {
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: {
    videos: Array<{ id: string; url: string; watermark_url?: string; duration: string }>;
  };
}

async function queryOmniVideoTask(taskId: string): Promise<OmniVideoTaskResult> {
  const { data, error } = await supabase.functions.invoke("kling-omni-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API error ${data.code}: ${data.message}`);
  return data.data as OmniVideoTaskResult;
}
```

**Fallback approach (when supabase client is unavailable):**

```typescript
async function queryOmniVideoTask(taskId: string): Promise<OmniVideoTaskResult> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-omni-video-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
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
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data as OmniVideoTaskResult;
}
```

**Complete frontend polling example:**

```typescript
async function pollOmniVideoUntilComplete(
  taskId: string,
  onProgress?: (status: string) => void
): Promise<OmniVideoTaskResult> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryOmniVideoTask(taskId);
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

- **Key security**: `INTEGRATIONS_API_KEY` must only be read server-side in the Edge Function; never expose it to the frontend.
- **Error handling**: Always handle 429 (quota exceeded) and 402 (insufficient balance); these error bodies must be forwarded verbatim to the frontend.
- **Billing**: This query endpoint is free; however, each submit request costs **¥134.00** (discounted; original price ¥160.80). Avoid improper polling patterns that could lead to duplicate submissions.
- **Video URL expiry**: Upstream CDN video links expire after 30 days. The Edge Function automatically transfers them to the Supabase Storage `generated-media` bucket to ensure the frontend receives a persistent URL.
- **Polling interval**: Recommended 5–10 seconds per poll; 7 seconds is suggested; total timeout should not exceed 10 minutes.
- **Task status flow**: `submitted` (queued) → `processing` (in progress) → `succeed` (completed) / `failed` (failed). `task_result.videos` is only populated in the `succeed` state.
