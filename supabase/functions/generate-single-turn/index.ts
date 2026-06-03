import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  prompt: string;
  type: 'cover_letter' | 'ats_score' | 'cv_summary';
  cvContent?: string;
  jobDescription?: string;
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

    const { prompt, type, cvContent, jobDescription }: RequestBody = await req.json();

    let systemPrompt = '';
    if (type === 'cover_letter') {
      systemPrompt = `You are a professional cover letter writer. Generate a tailored, professional cover letter based on the provided CV and job description. The cover letter should:
- Be concise and professional (250-400 words)
- Highlight relevant skills and experience from the CV
- Address the specific requirements in the job description
- Use a confident and engaging tone
- Include a strong opening and closing
- Be formatted with proper paragraphs

Do not include placeholder text like [Your Name] or [Company Name]. Write a complete, ready-to-use cover letter.`;
    } else if (type === 'ats_score') {
      systemPrompt = `You are an ATS (Applicant Tracking System) expert. Analyze the provided CV against the job description and provide:
1. A compatibility score out of 100
2. 3-5 specific reasons for the score (what matches well and what's missing)

Format your response as JSON:
{
  "score": <number>,
  "reasons": ["reason 1", "reason 2", "reason 3"]
}`;
    } else if (type === 'cv_summary') {
      systemPrompt = `You are a career advisor. Provide a brief, professional summary of the CV in 2-3 sentences. Highlight:
- Key skills and expertise
- Years of experience (if mentioned)
- Notable achievements or strengths

Keep it concise and professional.`;
    }

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        reasoning: { enabled: true }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error('Failed to generate response from AI');
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from AI');
    }

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-single-turn:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
