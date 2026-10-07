import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PendingReminder {
  notification_id: string;
  user_id: string;
  cover_letter_id: string;
  role_name: string;
  application_status: string;
  user_email: string;
  notification_created_at: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const reminderSecret = Deno.env.get('REMINDER_FUNCTION_SECRET');
  if (!reminderSecret || request.headers.get('x-reminder-secret') !== reminderSecret) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const serviceId = Deno.env.get('EMAILJS_SERVICE_ID');
  const templateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
  const publicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
  const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '');

  if (!supabaseUrl || !serviceRoleKey || !serviceId || !templateId || !publicKey || !appUrl) {
    return new Response('Missing reminder or EmailJS configuration', { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: claimError } = await supabase.rpc('claim_due_application_reminders');
  if (claimError) {
    console.error('Could not claim due application reminders:', claimError.message);
    return new Response('Could not claim due reminders', { status: 500, headers: corsHeaders });
  }

  const { data: pending, error: pendingError } = await supabase.rpc('claim_pending_reminder_emails');
  if (pendingError) {
    console.error('Could not claim pending reminder emails:', pendingError.message);
    return new Response('Could not claim pending reminder emails', { status: 500, headers: corsHeaders });
  }

  let sent = 0;
  let failed = 0;
  for (const reminder of (pending ?? []) as PendingReminder[]) {
    const updateUrl = `${appUrl}/history/${reminder.cover_letter_id}`;
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: reminder.user_email,
            role_name: reminder.role_name,
            application_status: reminder.application_status,
            update_url: updateUrl,
            login_url: `${appUrl}/login`,
            call_to_action: 'Log in to Aur.a and update your application status.',
          },
        }),
      });

      if (!response.ok) {
        failed++;
        console.error('EmailJS reminder failed:', response.status, await response.text());
        continue;
      }

      const { error: sentError } = await supabase
        .from('application_notifications')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', reminder.notification_id);
      if (sentError) {
        failed++;
        console.error('Could not mark reminder email as sent:', sentError.message);
        continue;
      }
      sent++;
    } catch (error) {
      failed++;
      console.error('Error sending application reminder:', error);
    }
  }

  return new Response(JSON.stringify({ remindersProcessed: pending?.length ?? 0, emailsSent: sent, emailFailures: failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
