import { createClient } from 'jsr:@supabase/supabase-js@2';

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin');

  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

interface RequestBody {
  prompt: string;
  type: 'cover_letter' | 'ats_score' | 'cv_summary' | 'personalised_cv';
  cvContent?: string;
  jobDescription?: string;
}

// Max CV characters included in any prompt — keeps requests well under the
// 150 s idle timeout even for very long uploaded CVs.
const MAX_CV_CHARS = 4000;

/** Trim the CV portion of an already-built prompt to MAX_CV_CHARS. */
function truncateCV(prompt: string): string {
  const marker = 'CV:\n';
  const cvStart = prompt.indexOf(marker);
  if (cvStart === -1) return prompt;

  const cvBodyStart = cvStart + marker.length;
  // Find next section separator after CV block
  const nextSection = prompt.indexOf('\n\n', cvBodyStart);
  const cvBody = nextSection === -1
    ? prompt.slice(cvBodyStart)
    : prompt.slice(cvBodyStart, nextSection);

  if (cvBody.length <= MAX_CV_CHARS) return prompt;

  const truncated = cvBody.slice(0, MAX_CV_CHARS) + '\n[CV truncated for length]';
  return nextSection === -1
    ? prompt.slice(0, cvBodyStart) + truncated
    : prompt.slice(0, cvBodyStart) + truncated + prompt.slice(nextSection);
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    );

    if (authHeader) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.warn('User auth check failed for generate-single-turn:', userError?.message || 'Unknown auth error');
      }
    }

    const { prompt: rawPrompt, type }: RequestBody = await req.json();

    // Truncate CV content inside the prompt before sending to the model
    const prompt = truncateCV(rawPrompt);

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
    } else if (type === 'personalised_cv') {
      systemPrompt = `You are an expert CV writer specialising in ATS-optimised resumes. Your task is to rewrite and restructure the candidate's existing CV to be perfectly tailored to the provided job description and title.

CRITICAL LANGUAGE RULE: You MUST write the entire CV in English, regardless of the language the input CV or job description is written in. Never output any text in another language.

CRITICAL FORMAT RULES:
- Output plain text ONLY — absolutely no markdown, no asterisks (*), no pound signs (#), no dashes as bullets, no special characters
- Use ALL CAPS for section headings (e.g. PROFESSIONAL SUMMARY, CORE SKILLS, WORK EXPERIENCE, EDUCATION)
- Separate each section with exactly one blank line
- Use a simple hyphen (-) at the start of bullet points under Work Experience
- Do NOT include any intro text, preamble, or commentary — start directly with the first section heading

STRUCTURE (use exactly these headings in this order):
PROFESSIONAL SUMMARY
(3-4 sentences tailored to the specific job)

CORE SKILLS
(8-12 relevant skills, one per line)

WORK EXPERIENCE
(reverse chronological, each role: Job Title, Company, Dates on one line; then bullet points with achievements)

EDUCATION
(degree, institution, graduation year — clean and concise)

ADDITIONAL RULES:
- Weave keywords from the job description naturally into the content
- Quantify achievements wherever the original CV provides enough detail
- Keep tone professional, confident, and results-oriented
- Remove irrelevant experience; emphasise what is most relevant to this role
- Do NOT include personal details like ID number, marital status, or religion`;
    }

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Only enable reasoning for cover_letter and personalised_cv (complex, benefits
    // from deeper thinking). ATS and cv_summary are faster without it and stay
    // well within the 150 s edge-function idle timeout.
    const useReasoning = type === 'cover_letter' || type === 'personalised_cv';

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
        ...(useReasoning ? { reasoning: { enabled: true } } : {}),
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
