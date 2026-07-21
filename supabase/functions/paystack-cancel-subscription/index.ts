// paystack-cancel-subscription edge function
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
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
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackKey) return fail('PAYSTACK_SECRET_KEY not configured', 500);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let userId = '';
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }
    if (!userId) return fail('Unauthorized', 401);

    const body = await req.json();
    const target: 'plan' | 'learning_hub' = body.target ?? 'plan';

    const { data: profile, error: profileFetchErr } = await supabase
      .from('profiles')
      .select('plan, plan_status, paystack_subscription_code, plan_renewal_date, learning_hub_plan_status, learning_hub_subscription_code, learning_hub_renewal_date')
      .eq('id', userId)
      .maybeSingle();

    if (profileFetchErr || !profile) return fail('Profile not found', 404);

    if (target === 'plan') {
      if (profile.plan === 'free') return fail('Free plan cannot be cancelled');
      if (profile.plan_status === 'cancelled') return ok({ success: true, message: 'Plan already cancelled' });

      const subCode = profile.paystack_subscription_code;
      if (subCode) {
        const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: subCode, token: '' }),
        });
        if (!disableRes.ok) {
          const errText = await disableRes.text();
          console.error('Paystack disable subscription error:', errText);
        } else {
          const disableData = await disableRes.json();
          if (!disableData.status) {
            console.error('Paystack disable subscription failed:', disableData.message);
          }
        }
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ plan_status: 'cancelled' })
        .eq('id', userId);

      if (updateErr) {
        console.error('Failed to update plan_status:', updateErr);
        return fail('Cancellation processed but profile update failed', 500);
      }

      return ok({
        success: true,
        message: 'Subscription cancelled. Access continues until billing end date.',
        access_until: profile.plan_renewal_date,
      });
    }

    // target === 'learning_hub'
    if (profile.learning_hub_plan_status === 'cancelled') {
      return ok({ success: true, message: 'Learning Hub already cancelled' });
    }

    const lhSubCode = profile.learning_hub_subscription_code;
    if (lhSubCode) {
      const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: lhSubCode, token: '' }),
      });
      if (!disableRes.ok) {
        const errText = await disableRes.text();
        console.error('Paystack disable LH subscription error:', errText);
      }
    }

    const { error: lhUpdateErr } = await supabase
      .from('profiles')
      .update({ learning_hub_plan_status: 'cancelled' })
      .eq('id', userId);

    if (lhUpdateErr) {
      console.error('Failed to update learning_hub_plan_status:', lhUpdateErr);
      return fail('Cancellation processed but profile update failed', 500);
    }

    return ok({
      success: true,
      message: 'Learning Hub add-on cancelled. Access continues until renewal date.',
      access_until: profile.learning_hub_renewal_date,
    });
  } catch (err) {
    console.error('paystack-cancel-subscription error:', err);
    return fail('Internal server error', 500);
  }
});
