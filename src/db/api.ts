import { supabase } from './supabase';
import type { Profile, CoverLetter, ChatMessage, CVBuilderData, CVBuilderProfile, ApplicationNotification, ApplicationReminderInterval, MockInterviewSession, MockInterviewUsage } from '@/types/types';

// Profile operations
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; email?: string; cv_content?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Error updating profile:', error);
    return false;
  }

  return true;
}

export async function updateProfileCV(cvContent: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('No user found');
    return false;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ cv_content: cvContent })
    .eq('id', user.id);

  if (error) {
    console.error('Error updating CV:', error);
    return false;
  }

  return true;
}

export async function decrementGenerationCount(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('decrement_generation_count', {
    user_id: userId,
  });

  if (error) {
    console.error('Error decrementing generation count:', error);
    return false;
  }

  return true;
}

// Cover letter operations
export async function createCoverLetter(
  userId: string,
  data: {
    content: string;
    job_title?: string;
    job_description: string;
    cv_content: string;
    ats_score?: number;
    ats_reasons?: string;
    cv_summary?: string;
  }
): Promise<string | null> {
  const { data: result, error } = await supabase
    .from('cover_letters')
    .insert({
      user_id: userId,
      content: data.content,
      job_title: data.job_title || null,
      job_description: data.job_description,
      cv_content: data.cv_content,
      ats_score: data.ats_score || null,
      ats_reasons: data.ats_reasons || null,
      cv_summary: data.cv_summary || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating cover letter:', error);
    return null;
  }

  return result?.id || null;
}

export async function getCoverLetters(userId: string): Promise<CoverLetter[]> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cover letters:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function updateCoverLetterStatus(
  id: string,
  status: CoverLetter['application_status'],
  reminderInterval: ApplicationReminderInterval
): Promise<boolean> {
  const days = reminderInterval === 'daily' ? 1 : reminderInterval === 'every_2_days' ? 2 : reminderInterval === 'every_3_days' ? 3 : null;
  const { error } = await supabase
    .from('cover_letters')
    .update({
      application_status: status,
      next_reminder_at: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating application status:', error);
    return false;
  }
  return true;
}

export async function updateApplicationReminder(
  id: string,
  interval: ApplicationReminderInterval
): Promise<boolean> {
  const days = interval === 'daily' ? 1 : interval === 'every_2_days' ? 2 : interval === 'every_3_days' ? 3 : null;
  const { error } = await supabase
    .from('cover_letters')
    .update({
      reminder_interval: interval,
      next_reminder_at: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating application reminder:', error);
    return false;
  }
  return true;
}

export async function getApplicationNotifications(userId: string): Promise<ApplicationNotification[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('application_notifications')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching application notifications:', error);
    return [];
  }
  return (data ?? []) as ApplicationNotification[];
}

export async function markApplicationNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('application_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('Error marking application notification read:', error);
    return false;
  }
  return true;
}

export async function getMockInterviewUsage(): Promise<MockInterviewUsage | null> {
  const { data, error } = await supabase.rpc('get_mock_interview_usage');
  if (error) {
    console.error('Error fetching mock interview usage:', error);
    return null;
  }
  return data as MockInterviewUsage | null;
}

export async function getMockInterviewSessions(userId: string): Promise<MockInterviewSession[]> {
  const { data, error } = await supabase
    .from('mock_interview_sessions')
    .select('id,user_id,cover_letter_id,role_name,company_name,interviewer_name,tavus_conversation_id,tavus_conversation_url,status,started_at,ended_at,duration_seconds,feedback_report,created_at')
    .eq('user_id', userId)
    .in('status', ['active', 'ended'])
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching mock interview sessions:', error);
    return [];
  }
  return (data ?? []) as MockInterviewSession[];
}

export async function getMockInterviewSession(id: string): Promise<MockInterviewSession | null> {
  const { data, error } = await supabase
    .from('mock_interview_sessions')
    .select('id,user_id,cover_letter_id,role_name,company_name,interviewer_name,tavus_conversation_id,tavus_conversation_url,status,started_at,ended_at,duration_seconds,feedback_report,created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('Error fetching mock interview session:', error);
    return null;
  }
  return data as MockInterviewSession | null;
}

export interface MockInterviewActionResult {
  success?: boolean;
  error?: string;
  reportError?: string;
  locked?: boolean;
  reason?: 'plan_required' | 'limit_reached';
  usage?: MockInterviewUsage;
  session?: MockInterviewSession;
}

const mockInterviewServiceError = 'The mock interview service is temporarily unavailable. Please try again.';

function getMockInterviewErrorMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const message = value.trim();
    if (!message) return null;

    try {
      const parsed: unknown = JSON.parse(message);
      if (parsed !== value) return getMockInterviewErrorMessage(parsed);
    } catch {
      // Non-JSON error text is handled below.
    }

    if (/<!doctype|<html\b|<body\b|<title\b/i.test(message)) return null;
    return message;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return getMockInterviewErrorMessage(record.error)
      ?? getMockInterviewErrorMessage(record.message)
      ?? getMockInterviewErrorMessage(record.details);
  }

  return null;
}

export async function runMockInterviewAction(
  action: 'start' | 'end' | 'status',
  payload: Record<string, unknown> = {}
): Promise<MockInterviewActionResult | null> {
  const { data, error } = await supabase.functions.invoke('mock-interview', {
    body: { action, ...payload },
  });
  if (error) {
    let responseBody: unknown;
    if (error.context instanceof Response) {
      const body = await error.context.clone().text().catch(() => '');
      if (body) {
        try {
          responseBody = JSON.parse(body) as unknown;
        } catch {
          responseBody = body;
        }
      }
    }
    console.error(`Mock interview ${action} error:`, { message: error.message, responseBody });
    return {
      error: getMockInterviewErrorMessage(responseBody)
        ?? getMockInterviewErrorMessage(error.message)
        ?? mockInterviewServiceError,
    };
  }

  if (data && typeof data === 'object' && ('error' in data || 'reportError' in data)) {
    const result = data as MockInterviewActionResult;
    return {
      ...result,
      ...(result.error !== undefined && {
        error: getMockInterviewErrorMessage(result.error) ?? mockInterviewServiceError,
      }),
      ...(result.reportError !== undefined && {
        reportError: getMockInterviewErrorMessage(result.reportError) ?? mockInterviewServiceError,
      }),
    };
  }

  return data as MockInterviewActionResult;
}

export async function getCoverLetterById(id: string): Promise<CoverLetter | null> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching cover letter:', error);
    return null;
  }

  return data;
}

export async function deleteCoverLetter(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('cover_letters')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cover letter:', error);
    return false;
  }

  return true;
}

// Chat message operations
export async function createChatMessage(
  coverLetterId: string,
  role: 'user' | 'assistant',
  content: string,
  reasoningDetails?: any
): Promise<boolean> {
  const { error } = await supabase.from('chat_messages').insert({
    cover_letter_id: coverLetterId,
    role,
    content,
    reasoning_details: reasoningDetails || null,
  });

  if (error) {
    console.error('Error creating chat message:', error);
    return false;
  }

  return true;
}

export async function getChatMessages(coverLetterId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('cover_letter_id', coverLetterId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

export async function countChatMessages(
  coverLetterId: string,
  role: 'user' | 'assistant'
): Promise<number> {
  const { count, error } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('cover_letter_id', coverLetterId)
    .eq('role', role);

  if (error) {
    console.error('Error counting chat messages:', error);
    return 0;
  }

  return count || 0;
}

// Edge Function calls
export async function generateSingleTurn(
  type: 'cover_letter' | 'ats_score' | 'cv_summary' | 'personalised_cv' | 'cv_builder',
  prompt: string
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('generate-single-turn', {
    body: { type, prompt },
  });

  if (error) {
    const errorMsg = await error?.context?.text?.();
    console.error('Edge function error in generate-single-turn:', errorMsg || error?.message);
    return null;
  }

  return data?.content || null;
}

export async function generateMultiTurn(
  messages: Array<{ role: string; content: string; reasoning_details?: any }>,
  coverLetterId: string
): Promise<{ content: string; reasoning_details?: any } | null> {
  const { data, error } = await supabase.functions.invoke('generate-multi-turn', {
    body: { messages, coverLetterId },
  });

  if (error) {
    const errorMsg = await error?.context?.text?.();
    console.error('Edge function error in generate-multi-turn:', errorMsg || error?.message);
    return null;
  }

  return data || null;
}

export async function generateGlobalChat(
  messages: Array<{ role: string; content: string; reasoning_details?: any }>
): Promise<{ content: string; reasoning_details?: any } | null> {
  const { data, error } = await supabase.functions.invoke('global-chat', {
    body: { messages },
  });

  if (error) {
    const errorMsg = await error?.context?.text?.();
    console.error('Edge function error in global-chat:', errorMsg || error?.message);
    return null;
  }

  return data || null;
}

export async function extractPdfText(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
      body: formData,
    });

    if (error) {
      // Try to get detailed error message from context
      let errorMsg = error?.message || 'Failed to extract text from PDF';
      
      try {
        const errorText = await error?.context?.text?.();
        if (errorText) {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMsg = errorJson.error;
          }
          if (errorJson.code) {
            throw new Error(`${errorJson.code}: ${errorMsg}`);
          }
        }
      } catch (parseError) {
        // If we can't parse the error, use the original message
      }
      
      console.error('Edge function error in extract-pdf-text:', errorMsg);
      throw new Error(errorMsg);
    }

    return data?.text || null;
  } catch (error: any) {
    console.error('Error calling extract-pdf-text:', error);
    throw error;
  }
}

// ─── Learning Hub API ─────────────────────────────────────────────────────────

import type { VideoWatchProgress, LearningHubCategory } from '@/types/types';

export async function getVideoProgress(
  userId: string,
  category: LearningHubCategory
): Promise<VideoWatchProgress[]> {
  const { data, error } = await supabase
    .from('video_watch_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching video progress:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function saveVideosToProgress(
  userId: string,
  category: LearningHubCategory,
  videos: Array<{ video_id: string; video_title: string; thumbnail_url: string; channel_name: string }>,
  startOrder: number
): Promise<boolean> {
  const rows = videos.map((v, i) => ({
    user_id: userId,
    category,
    video_id: v.video_id,
    video_title: v.video_title,
    thumbnail_url: v.thumbnail_url,
    channel_name: v.channel_name,
    watched: false,
    display_order: startOrder + i,
  }));

  const { error } = await supabase
    .from('video_watch_progress')
    .upsert(rows, { onConflict: 'user_id,video_id', ignoreDuplicates: true });

  if (error) {
    console.error('Error saving video progress:', error);
    return false;
  }
  return true;
}

export async function markVideoWatched(
  userId: string,
  videoId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('video_watch_progress')
    .update({ watched: true, watched_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('video_id', videoId);

  if (error) {
    console.error('Error marking video watched:', error);
    return false;
  }
  return true;
}

export async function fetchYouTubeVideos(
  query: string,
  excludeIds: string[]
): Promise<Array<{ video_id: string; title: string; thumbnail_url: string; channel_name: string; embed_url: string }>> {
  const { data, error } = await supabase.functions.invoke('fetch-youtube-videos', {
    body: { query, excludeIds },
  });

  if (error) {
    const msg = await error?.context?.text?.();
    console.error('Edge function error in fetch-youtube-videos:', msg || error?.message);
    return [];
  }

  return Array.isArray(data?.videos) ? data.videos : [];
}

export async function initializePaystackPayment(
  amount: number,
  billingPeriod: 'two_months' | 'annual',
  callbackUrl: string
): Promise<{ authorization_url: string; reference: string } | null> {
  const { data, error } = await supabase.functions.invoke('paystack-initialize', {
    body: { amount, billingPeriod, callbackUrl },
  });

  if (error) {
    const msg = await error?.context?.text?.();
    console.error('Edge function error in paystack-initialize:', msg || error?.message);
    return null;
  }

  return data || null;
}

export async function verifyPaystackPayment(
  reference: string
): Promise<{ success: boolean; message?: string } | null> {
  const { data, error } = await supabase.functions.invoke('paystack-verify', {
    body: { reference },
  });

  if (error) {
    const msg = await error?.context?.text?.();
    console.error('Edge function error in paystack-verify:', msg || error?.message);
    return null;
  }

  return data || null;
}

export async function upgradePlan(
  reference: string,
  planType: string,
  billingPeriod: string
): Promise<{ success: boolean; message?: string; plan?: string; renewal_date?: string } | null> {
  const { data, error } = await supabase.functions.invoke('paystack-plan-upgrade', {
    body: { reference, planType, billingPeriod },
  });

  if (error) {
    const msg = await error?.context?.text?.();
    console.error('Edge function error in paystack-plan-upgrade:', msg || error?.message);
    return null;
  }

  return data || null;
}

export async function initializePlanUpgrade(
  planType: string,
  billingPeriod: string
): Promise<{ authorization_url: string; reference: string } | null> {
  const { data, error } = await supabase.functions.invoke('paystack-plan-initialize', {
    body: { planType, billingPeriod },
  });

  if (error) {
    const msg = await error?.context?.text?.();
    console.error('Edge function error in paystack-plan-initialize:', msg || error?.message);
    return null;
  }

  return (data as { authorization_url: string; reference: string }) || null;
}

export async function getPaystackPublicKey(): Promise<{ publicKey: string } | { error: string } | null> {
  const { data, error } = await supabase.functions.invoke('paystack-config');

  if (error) {
    const msg = await error?.context?.text?.();
    console.error('Edge function error in paystack-config:', msg || error?.message);
    return null;
  }

  return data as { publicKey: string } | { error: string } | null;
}

// ─── Personalised CV ──────────────────────────────────────────────────────────

export async function createPersonalisedCV(
  userId: string,
  payload: {
    content: string;
    job_title: string;
    job_description: string;
    cv_content: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('personalised_cvs')
    .insert({ user_id: userId, ...payload });

  if (error) {
    console.error('Failed to save personalised CV:', error.message);
    return null;
  }

  // Return ID via a secondary query to stay consistent with insert-without-select pattern
  const { data: row } = await supabase
    .from('personalised_cvs')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return row?.id ?? null;
}

// ─── CV Builder ──────────────────────────────────────────────────────────────

export async function getCVBuilderProfile(userId: string): Promise<{ data: any; generated_cv: string | null } | null> {
  const { data, error } = await supabase
    .from('cv_builder_profiles')
    .select('data, generated_cv')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching CV builder profile:', error);
    return null;
  }
  return data;
}

export async function upsertCVBuilderProfile(
  userId: string,
  cvData: any,
  generatedCV?: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('cv_builder_profiles')
    .upsert(
      {
        user_id: userId,
        data: cvData,
        ...(generatedCV !== undefined ? { generated_cv: generatedCV } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Error saving CV builder profile:', error);
    return false;
  }
  return true;
}

// ─── Subscription Cancellation / Reinstatement ────────────────────────────────
// Implemented via Supabase RPC (SECURITY DEFINER) — no edge function needed.
// The Paystack subscription code is not stored for current users, so the DB
// status update is all that's required for cancel/reinstate to work correctly.

export async function cancelSubscription(
  target: 'plan' | 'learning_hub'
): Promise<{ success: boolean; message?: string; access_until?: string } | null> {
  const { data, error } = await supabase.rpc('cancel_subscription', { target_type: target });

  if (error) {
    console.error('RPC error in cancel_subscription:', error.message);
    return null;
  }

  // RPC returns JSON — handle both success and business-logic errors
  if (data && !data.success) {
    return { success: false, message: data.error };
  }

  return data ? { success: true, access_until: data.access_until } : null;
}

export async function reinstateSubscription(
  target: 'plan' | 'learning_hub'
): Promise<{ success: boolean; message?: string; next_billing_date?: string } | null> {
  const { data, error } = await supabase.rpc('reinstate_subscription', { target_type: target });

  if (error) {
    console.error('RPC error in reinstate_subscription:', error.message);
    return null;
  }

  if (data && !data.success) {
    return { success: false, message: data.error };
  }

  return data ? { success: true, next_billing_date: data.next_billing_date } : null;
}
