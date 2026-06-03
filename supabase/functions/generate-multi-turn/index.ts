import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: string;
  content: string;
  reasoning_details?: any;
}

interface RequestBody {
  messages: Message[];
  coverLetterId: string;
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

    const { messages, coverLetterId }: RequestBody = await req.json();

    // Verify user owns this cover letter
    const { data: coverLetter, error: clError } = await supabase
      .from('cover_letters')
      .select('user_id')
      .eq('id', coverLetterId)
      .single();

    if (clError || !coverLetter || coverLetter.user_id !== user.id) {
      throw new Error('Unauthorized access to cover letter');
    }

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Prepare messages for OpenRouter (preserve reasoning_details)
    const formattedMessages = messages.map(msg => {
      const message: any = {
        role: msg.role,
        content: msg.content
      };
      if (msg.reasoning_details) {
        message.reasoning_details = msg.reasoning_details;
      }
      return message;
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: formattedMessages,
        reasoning: { enabled: true }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error('Failed to generate response from AI');
    }

    const result = await response.json();
    const assistantMessage = result.choices?.[0]?.message;

    if (!assistantMessage || !assistantMessage.content) {
      throw new Error('No content received from AI');
    }

    // Save the assistant message to database
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        cover_letter_id: coverLetterId,
        role: 'assistant',
        content: assistantMessage.content,
        reasoning_details: assistantMessage.reasoning_details || null
      });

    if (insertError) {
      console.error('Error saving chat message:', insertError);
    }

    return new Response(
      JSON.stringify({ 
        content: assistantMessage.content,
        reasoning_details: assistantMessage.reasoning_details
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-multi-turn:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
