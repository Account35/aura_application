import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function fail(msg: string, code = 400): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, excludeIds = [] } = await req.json();

    if (!query) return fail('Missing query parameter');

    const serpApiKey = Deno.env.get('SERPAPI_KEY');
    if (!serpApiKey) return fail('SERPAPI_KEY not configured', 500);

    // Fetch up to 20 results so we can exclude already-shown ones
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'youtube');
    url.searchParams.set('search_query', query);
    url.searchParams.set('api_key', serpApiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      console.error('SerpApi error:', text);
      return fail('Failed to fetch from SerpApi', 502);
    }

    const serpData = await response.json();
    const rawVideos: any[] = serpData?.video_results ?? [];

    // Normalize and filter out excluded video IDs
    const excludeSet = new Set<string>(excludeIds);
    const videos = rawVideos
      .filter((v: any) => {
        const id = v?.link?.match(/[?&]v=([^&]+)/)?.[1] || v?.video_id || v?.id;
        return id && !excludeSet.has(id);
      })
      .slice(0, 10)
      .map((v: any) => {
        const videoId =
          v?.link?.match(/[?&]v=([^&]+)/)?.[1] ||
          v?.video_id ||
          v?.id ||
          '';
        return {
          video_id: videoId,
          title: v?.title ?? 'Untitled',
          thumbnail_url:
            v?.thumbnail?.static ??
            v?.thumbnail?.rich ??
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          channel_name: v?.channel?.name ?? v?.channel ?? 'Unknown Channel',
          embed_url: `https://www.youtube.com/embed/${videoId}`,
        };
      })
      .filter((v) => v.video_id);

    return ok({ videos });
  } catch (err) {
    console.error('fetch-youtube-videos error:', err);
    return fail('Internal server error', 500);
  }
});
