import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: string;
  content: string;
  reasoning_details?: unknown;
}

interface RequestBody {
  messages: Message[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { messages }: RequestBody = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages provided');
    }

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Truncate any CV/cover letter content in system messages to prevent timeouts
    const MAX_CONTEXT_CHARS = 3000;
    const prepared = messages.map((msg) => {
      const m: Record<string, unknown> = { role: msg.role, content: msg.content };
      if (msg.reasoning_details) {
        m.reasoning_details = msg.reasoning_details;
      }
      return m;
    });

    // Truncate system message content if it is very long
    if (prepared[0]?.role === 'system' && typeof prepared[0].content === 'string') {
      if ((prepared[0].content as string).length > MAX_CONTEXT_CHARS * 3) {
        prepared[0] = {
          ...prepared[0],
          content: (prepared[0].content as string).slice(0, MAX_CONTEXT_CHARS * 3) + '\n[Content truncated]',
        };
      }
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: prepared,
        reasoning: { enabled: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error('Failed to generate response from AI');
    }

    const result = await response.json();
    const assistantMessage = result.choices?.[0]?.message;

    if (!assistantMessage?.content) {
      throw new Error('No content received from AI');
    }

    return new Response(
      JSON.stringify({
        content: assistantMessage.content,
        reasoning_details: assistantMessage.reasoning_details ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in global-chat:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
