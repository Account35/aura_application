# Query Video Status API — Sora 2

## Overview

Poll the status of a Sora 2 video generation job. Call this repeatedly after submitting a job until `status === "completed"` or a terminal error state.

| Item | Details |
|------|---------|
| Endpoint | `POST https://api-DYJwnoM46d6a@app-b0t9jb6nl2pt-api-DYJwnoM46d6a.gateway.appmedo.com` |
| Content-Type | `application/json` |
| Auth | Platform-managed (`INTEGRATIONS_API_KEY`) |
| Billing | Not billed |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_id` | `string` | **Yes** | Video job ID, format `video_<hash>`, returned by the create endpoint |

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Video job ID |
| `object` | `string` | Fixed value `"video"` |
| `created_at` | `number` | Job creation time (Unix seconds) |
| `status` | `string` | `queued` / `in_progress` / `completed` / `failed` / `cancelled` |
| `completed_at` | `number?` | Completion time (Unix seconds); `null` when not yet complete |
| `expires_at` | `number?` | CDN URL expiry time (Unix seconds) |
| `error` | `object?` | Failure reason; only present when `status === "failed"` |
| `model` | `string` | Model used |
| `progress` | `number` | Progress 0–100 |
| `prompt` | `string` | Original prompt text |
| `remixed_from_video_id` | `string?` | ID of the source video if this job was created via remix; otherwise `null` |
| `seconds` | `string` | Video duration |
| `size` | `string` | Output resolution |
| `video_url` | `string?` | **Only present when `status === "completed"`**; ephemeral CDN download link |

### Response Example (in_progress)

```json
{
  "id": "video_698c8e48cd108190ba08e5946d35d686",
  "object": "video",
  "created_at": 1770819144,
  "status": "in_progress",
  "completed_at": null,
  "error": null,
  "expires_at": null,
  "model": "sora-2",
  "progress": 0,
  "prompt": "A kitten chasing a butterfly",
  "remixed_from_video_id": null,
  "seconds": "8",
  "size": "1280x720"
}
```

### Response Example (completed)

```json
{
  "id": "video_698c8e48cd108190ba08e5946d35d686",
  "object": "video",
  "created_at": 1770819144,
  "status": "completed",
  "completed_at": 1770819251,
  "error": null,
  "expires_at": 1770905544,
  "model": "sora-2",
  "progress": 100,
  "prompt": "A kitten chasing a butterfly",
  "remixed_from_video_id": null,
  "seconds": "8",
  "size": "1280x720",
  "video_url": "https://plugin-static-res.cdn.bcebos.com/videos/video_698c8e48cd108190ba08e5946d35d686.mp4"
}
```

---

## Generation-Time Usage (Agent Direct Call)

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed: key is injected by the platform

interface VideoStatusResponse {
  id: string;
  object: string;
  created_at: number;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  completed_at: number | null;
  expires_at: number | null;
  error: unknown | null;
  model: string;
  progress: number;
  prompt: string;
  remixed_from_video_id: string | null; // ID of source video if created via remix, otherwise null
  seconds: string;
  size: string;
  video_url?: string; // only when status === "completed"
}

async function queryVideoStatus(videoId: string): Promise<VideoStatusResponse> {
  const response = await fetch(
    "https://api-DYJwnoM46d6a@app-b0t9jb6nl2pt-api-DYJwnoM46d6a.gateway.appmedo.com",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ video_id: videoId }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  return response.json();
}
```

**Complete generation-time polling workflow:**

See the polling pattern in `SKILL.md`. After getting `video_url`:

```bash
curl -L -o ./output_video.mp4 "<video_url>"
```

> `video_url` is only present when `status === "completed"`; CDN links are time-limited — download immediately.

---

## Post-Generation Usage (In-App via Edge Function)

### Edge Function (`edge-functions/query-video.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function streamVideoToStorage(
  videoUrl: string,
  bucketName = "generated-media"
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp4";
    const filePath = `videos/${crypto.randomUUID()}.${ext}`;

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

  let video_id: string;
  try {
    const body = await req.json();
    video_id = body.video_id;
    if (!video_id) throw new Error("Missing video_id");
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
    "https://api-DYJwnoM46d6a@app-b0t9jb6nl2pt-api-DYJwnoM46d6a.gateway.appmedo.com",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ video_id }),
    }
  );

  if (upstream.status === 429 || upstream.status === 402) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await upstream.json();

  // When completed, transfer ephemeral CDN video to Supabase Storage
  if (data.status === "completed" && data.video_url) {
    const transfer = await streamVideoToStorage(data.video_url);
    if (transfer.success) {
      data.video_url = transfer.publicUrl;
    }
    // If transfer fails, still return data with original CDN URL (best-effort)
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Frontend → Edge Function

**Recommended (when supabase client is available):**

```typescript
interface VideoStatusResponse {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  progress: number;
  video_url?: string; // Supabase Storage URL when completed
}

async function queryVideoStatus(videoId: string): Promise<VideoStatusResponse> {
  const { data, error } = await supabase.functions.invoke("query-video", {
    body: { video_id: videoId },
  });
  if (error) throw error;
  return data as VideoStatusResponse;
}
```

**Fallback (when supabase client is unavailable):**

```typescript
async function queryVideoStatus(videoId: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId }),
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
```

### Full frontend polling loop (app-side)

```typescript
async function pollUntilDone(videoId: string, onProgress?: (p: number) => void) {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoStatus(videoId);
    onProgress?.(result.progress ?? 0);
    if (result.status === "completed") return result;
    if (result.status === "failed")    throw new Error("Video generation failed");
    if (result.status === "cancelled") throw new Error("Video generation cancelled");
  }
  throw new Error("Video generation timed out");
}
```
