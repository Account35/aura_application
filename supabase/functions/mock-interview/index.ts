import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JsonRecord = Record<string, unknown>;

const feedbackUnavailableMessage = 'Your interview ended, but feedback is temporarily unavailable. Please try again.';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function tavusRequest(url: string, init: RequestInit, operation: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    console.error(`Tavus ${operation} request failed before receiving a response:`, error);
    throw new Error('Could not connect to the interview video service. Please try again.');
  }

  if (!response.ok) {
    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (error) {
      console.error(`Could not read Tavus ${operation} error response:`, error);
    }
    console.error(`Tavus ${operation} request failed (${response.status} ${response.statusText}):`, responseBody);
    throw new Error(`The interview video service could not ${operation} (HTTP ${response.status}). Please try again later.`);
  }

  return response;
}

function findCompanyName(description: string): string | null {
  const match = description.match(/(?:company|employer|organisation|organization)\s*[:\-]\s*([^\r\n]+)/i);
  return match?.[1]?.trim() || null;
}

function getTranscript(conversation: JsonRecord): unknown[] | null {
  const props = conversation.properties as JsonRecord | undefined;
  if (Array.isArray(props?.transcript)) return props.transcript;
  if (Array.isArray(conversation.transcript)) return conversation.transcript;
  const events = Array.isArray(conversation.events) ? conversation.events as JsonRecord[] : [];
  const transcriptionEvent = events.find((event) => event.event_type === 'application.transcription_ready');
  const eventProperties = transcriptionEvent?.properties as JsonRecord | undefined;
  return Array.isArray(eventProperties?.transcript) ? eventProperties.transcript : null;
}

function formatTranscript(transcript: unknown[] | null): string {
  if (!transcript) return '';
  return transcript.map((entry) => {
    if (!entry || typeof entry !== 'object') return '';
    const row = entry as JsonRecord;
    const speaker = typeof row.role === 'string' ? row.role : 'speaker';
    const content = typeof row.content === 'string' ? row.content : typeof row.text === 'string' ? row.text : '';
    return content.trim() ? `${speaker}: ${content.trim()}` : '';
  }).filter(Boolean).join('\n').slice(0, 18000);
}

async function openRouterCompletion(key: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openrouter/free', messages, reasoning: { enabled: true } }),
  });
  if (!response.ok) {
    console.error('OpenRouter interview request failed:', response.status, await response.text());
    throw new Error('The AI service could not generate interview content. Please try again.');
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('The AI service returned an empty response.');
  return content.trim();
}

async function summarizeCV(openRouterKey: string, cvContent: string): Promise<string> {
  if (!cvContent.trim()) return 'The candidate has not saved CV details yet. Ask about their relevant experience and skills.';
  try {
    return await openRouterCompletion(openRouterKey, [
      { role: 'system', content: 'Summarize the candidate CV for a job interviewer. Extract only supported skills, experience, achievements, and career themes. Use 4 to 6 concise sentences; do not invent details.' },
      { role: 'user', content: cvContent.slice(0, 12000) },
    ]);
  } catch {
    return cvContent.slice(0, 3500);
  }
}

function parseFeedbackReport(content: string): JsonRecord {
  const normalized = content
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const jsonStart = normalized.indexOf('{');
  const jsonEnd = normalized.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    console.error('Interview feedback response did not contain a JSON object.');
    throw new Error('The feedback service returned an unreadable report.');
  }

  try {
    return JSON.parse(normalized.slice(jsonStart, jsonEnd + 1)) as JsonRecord;
  } catch (error) {
    console.error('Could not parse interview feedback JSON:', error);
    throw new Error('The feedback service returned an unreadable report.');
  }
}

async function generateFeedbackReport(
  openRouterKey: string,
  session: JsonRecord,
  transcript: unknown[] | null
): Promise<JsonRecord> {
  const transcriptText = formatTranscript(transcript);
  const hasTranscript = transcriptText.length > 0;
  const system = `You are an encouraging, candid professional interview coach. Return one JSON object only, with exactly these keys: overall_summary (string), strengths (array of 2 or 3 specific strings), areas_to_improve (array of 2 or 3 specific strings), recommended_next_steps (array of 3 or 4 actionable strings). The last recommended_next_steps item must recommend the Aur.a Learning Hub interview preparation videos and career tips and include this exact app path: /learning-hub. ${hasTranscript ? 'Base the assessment on the provided interview transcript and candidate background.' : 'No transcript is available. Do not claim you heard or observed the candidate. Give clearly generalized, role-relevant guidance based on the role, job description, and CV context.'}`;
  const user = `Role: ${session.role_name}\nCompany: ${session.company_name || 'Not specified'}\nCV summary: ${session.cv_summary || 'Not provided'}\nJob description: ${String(session.job_description || '').slice(0, 7000)}\nInterview transcript: ${hasTranscript ? transcriptText : 'No Tavus transcript was returned.'}`;
  const content = await openRouterCompletion(openRouterKey, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  const report = parseFeedbackReport(content);
  if (typeof report.overall_summary !== 'string'
    || !Array.isArray(report.strengths)
    || !Array.isArray(report.areas_to_improve)
    || !Array.isArray(report.recommended_next_steps)) {
    throw new Error('The AI service returned an invalid feedback report. Please retry.');
  }
  report.strengths = report.strengths.slice(0, 3).map(String);
  report.areas_to_improve = report.areas_to_improve.slice(0, 3).map(String);
  const nextSteps = report.recommended_next_steps.slice(0, 4).map(String);
  if (nextSteps.length < 3) throw new Error('The AI service returned an incomplete feedback report. Please retry.');
  nextSteps[nextSteps.length - 1] = 'Visit the Aur.a Learning Hub for interview preparation videos and career tips (/learning-hub).';
  report.recommended_next_steps = nextSteps;
  return report;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in to use mock interviews.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase server configuration is incomplete.');

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Your session has expired. Please sign in again.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await request.json() as JsonRecord;
    const action = body.action;
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');

    if (action === 'start') {
      const tavusKey = Deno.env.get('TAVUS_API_KEY');
      const tavusFaceId = Deno.env.get('TAVUS_FACE_ID');
      if (!tavusKey?.trim() || !tavusFaceId?.trim()) return json({ error: 'Mock interview video is not configured. Set TAVUS_API_KEY and TAVUS_FACE_ID in Supabase Edge Function secrets.' }, 503);
      if (!openRouterKey) return json({ error: 'OPENROUTER_API_KEY is not configured for interview preparation.' }, 503);

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id, plan, plan_status, plan_renewal_date, trial_ends_at, cv_content, name')
        .eq('id', user.id)
        .single();
      if (profileError || !profile) return json({ error: 'Could not load your Aur.a profile.' }, 404);

      const coverLetterId = typeof body.coverLetterId === 'string' ? body.coverLetterId : null;
      let coverLetter: JsonRecord | null = null;
      if (coverLetterId) {
        const { data, error } = await admin.from('cover_letters').select('*').eq('id', coverLetterId).eq('user_id', user.id).maybeSingle();
        if (error || !data) return json({ error: 'The selected application could not be found.' }, 404);
        coverLetter = data as JsonRecord;
      }

      const jobDescription = typeof coverLetter?.job_description === 'string' ? coverLetter.job_description : '';
      const roleName = (typeof coverLetter?.job_title === 'string' && coverLetter.job_title.trim())
        || (jobDescription.match(/(?:job\s*title|position|role)\s*[:\-]\s*([^\r\n]+)/i)?.[1]?.trim())
        || 'General professional interview';
      const companyName = findCompanyName(`${jobDescription}\n${typeof coverLetter?.content === 'string' ? coverLetter.content : ''}`);

      const { data: reservation, error: reservationError } = await admin.rpc('reserve_mock_interview_session', {
        p_user_id: user.id,
        p_role_name: roleName,
        p_company_name: companyName,
        p_cover_letter_id: coverLetterId,
      });
      if (reservationError || !reservation) {
        console.error('Mock interview quota reservation failed:', reservationError?.message);
        return json({ error: 'Could not check your mock interview access. Please try again.' }, 500);
      }
      if (!reservation.allowed) {
        return json({ locked: true, reason: reservation.reason, usage: reservation });
      }

      const sessionId = reservation.session_id as string;
      const cvContent = (typeof profile.cv_content === 'string' && profile.cv_content.trim())
        || (typeof coverLetter?.cv_content === 'string' ? coverLetter.cv_content : '');
      const cvSummary = await summarizeCV(openRouterKey, cvContent);
      const interviewerName = 'Aur.a AI Interviewer';
      const jobContext = coverLetterId
        ? `Target role: ${roleName}\nCompany: ${companyName || 'Not identified'}\nJob description:\n${jobDescription.slice(0, 9000)}\nCandidate CV summary:\n${cvSummary}`
        : `This is a general professional interview. Ask common behavioral and competency-based questions that suit a broad range of professional roles. Candidate CV summary:\n${cvSummary}`;
      const systemPrompt = `You are ${interviewerName}, a professional, warm, realistic job interviewer. Conduct a spoken mock job interview lasting approximately 15 to 20 minutes. Ask one clear question at a time, listen carefully to spoken answers, and respond naturally before asking relevant follow-up questions. Maintain a professional tone and realistic pacing. Do not provide coaching or reveal evaluation during the interview. Keep the exchange voice-first and do not ask the participant to type. For role-specific practice, ask questions based on the role, company, job description, and candidate skills and experience below.\n\n${jobContext}`;

      const tavusHeaders = {
        'Content-Type': 'application/json',
        'x-api-key': tavusKey.trim(),
      };
      try {
        const palResponse = await tavusRequest(
          'https://tavusapi.com/v2/pals',
          {
            method: 'POST',
            headers: tavusHeaders,
            body: JSON.stringify({
              pal_name: `Aur.a Mock Interview ${sessionId.slice(0, 8)}`,
              system_prompt: systemPrompt,
              default_face_id: tavusFaceId,
              pipeline_mode: 'full',
              greeting: `Hello ${profile.name || 'there'}. I’m ${interviewerName}. Let’s begin your ${roleName === 'General professional interview' ? 'professional' : roleName} interview. Could you start by telling me about yourself?`,
            }),
          },
          'create interviewer',
        );
        const pal = await palResponse.json();
        if (typeof pal.pal_id !== 'string') throw new Error('Tavus did not return an interviewer identifier.');

        const conversationResponse = await tavusRequest(
          'https://tavusapi.com/v2/conversations',
          {
            method: 'POST',
            headers: tavusHeaders,
            body: JSON.stringify({
              pal_id: pal.pal_id,
              face_id: tavusFaceId,
              conversation_name: `${roleName} Mock Interview`,
              conversational_context: 'Run a natural spoken job interview using the candidate and role context in your system prompt. Keep the interview within 15 to 20 minutes.',
              properties: { max_call_duration: 1200, participant_left_timeout: 60 },
            }),
          },
          'start conversation',
        );
        const conversation = await conversationResponse.json();
        if (typeof conversation.conversation_id !== 'string' || typeof conversation.conversation_url !== 'string') {
          throw new Error('Tavus did not return a video conversation URL.');
        }

        const { data: session, error: saveError } = await admin
          .from('mock_interview_sessions')
          .update({
            role_name: roleName,
            company_name: companyName,
            interviewer_name: interviewerName,
            job_description: jobDescription,
            cv_summary: cvSummary,
            tavus_pal_id: pal.pal_id,
            tavus_conversation_id: conversation.conversation_id,
            tavus_conversation_url: conversation.conversation_url,
            tavus_meeting_token: conversation.meeting_token ?? null,
            status: 'active',
          })
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .select('*')
          .single();
        if (saveError || !session) throw new Error('The interview was created but could not be saved. Please contact support.');
        return json({ success: true, session, usage: reservation });
      } catch (error) {
        await admin.from('mock_interview_sessions').update({ status: 'failed', ended_at: new Date().toISOString() }).eq('id', sessionId);
        console.error('Tavus session creation failed:', error);
        return json({ error: (error as Error).message || 'Could not create the Tavus interview.' }, 502);
      }
    }

    if (action === 'status' || action === 'end') {
      if (!openRouterKey) return json({ error: 'OPENROUTER_API_KEY is not configured.' }, 503);
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
      const { data: session, error: sessionError } = await admin
        .from('mock_interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (sessionError || !session) return json({ error: 'Mock interview session not found.' }, 404);

      if (session.status !== 'ended' && session.tavus_conversation_id) {
        const tavusKey = Deno.env.get('TAVUS_API_KEY');
        if (!tavusKey?.trim()) return json({ error: 'TAVUS_API_KEY is not configured.' }, 503);
        const headers = { 'x-api-key': tavusKey.trim() };
        let endRequestSucceeded = false;
        if (action === 'end') {
          const endResponse = await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(session.tavus_conversation_id)}/end`, { method: 'POST', headers });
          endRequestSucceeded = endResponse.ok;
          if (!endResponse.ok && endResponse.status !== 400) {
            console.error('Tavus end request failed:', endResponse.status, await endResponse.text());
          }
        }

        const conversationResponse = await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(session.tavus_conversation_id)}?verbose=true`, { headers });
        if (!conversationResponse.ok) {
          console.error('Tavus conversation status failed:', conversationResponse.status, await conversationResponse.text());
          if (action === 'status') return json({ success: true, session });
        } else {
          const conversation = await conversationResponse.json() as JsonRecord;
          const transcript = getTranscript(conversation);
          const hasEnded = conversation.status === 'ended' || (action === 'end' && endRequestSucceeded);
          if (action === 'end' && !hasEnded) {
            return json({ error: 'The interview room has not ended yet. Please try again.' }, 502);
          }
          if (hasEnded) {
            const endedAt = new Date().toISOString();
            const startedAt = new Date(session.started_at as string).getTime();
            const { data: endedSession, error: endSaveError } = await admin
              .from('mock_interview_sessions')
              .update({
                status: 'ended',
                ended_at: endedAt,
                duration_seconds: Math.max(0, Math.floor((Date.parse(endedAt) - startedAt) / 1000)),
                conversation_transcript: transcript,
              })
              .eq('id', sessionId)
              .eq('user_id', user.id)
              .select('*')
              .single();
            if (endSaveError || !endedSession) throw new Error('The interview ended but its session record could not be saved.');

            let report = endedSession.feedback_report as JsonRecord | null;
            if (!report) {
              try {
                report = await generateFeedbackReport(openRouterKey, endedSession, transcript);
                await admin.from('mock_interview_sessions')
                  .update({ feedback_report: report, feedback_generated_at: new Date().toISOString() })
                  .eq('id', sessionId)
                  .eq('user_id', user.id);
              } catch (error) {
                console.error('Interview feedback generation failed:', error);
              }
            }
            return json({
              success: true,
              session: { ...endedSession, feedback_report: report },
              ...(!report && { reportError: feedbackUnavailableMessage }),
            });
          }
        }
      }

      if (session.status === 'ended' && !session.feedback_report) {
        try {
          const transcript = Array.isArray(session.conversation_transcript) ? session.conversation_transcript : null;
          const report = await generateFeedbackReport(openRouterKey, session, transcript);
          await admin.from('mock_interview_sessions').update({ feedback_report: report, feedback_generated_at: new Date().toISOString() }).eq('id', session.id);
          return json({ success: true, session: { ...session, feedback_report: report } });
        } catch (error) {
          console.error('Interview feedback retry failed:', error);
          return json({ success: true, session, reportError: feedbackUnavailableMessage });
        }
      }
      return json({ success: true, session });
    }

    return json({ error: 'Unsupported mock interview action.' }, 400);
  } catch (error) {
    console.error('Mock interview function error:', error);
    return json({ error: (error as Error).message || 'Mock interview request failed.' }, 500);
  }
});
