// paystack-reinstate-subscription edge function
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
      if (profile.plan_status === 'active') {
        return ok({ success: true, message: 'Subscription already active' });
      }

      if (profile.plan_renewal_date && new Date() >= new Date(profile.plan_renewal_date)) {
        return fail('Your access period has ended. Please purchase a new subscription.', 400);
      }

      const subCode = profile.paystack_subscription_code;
      if (subCode) {
        const enableRes = await fetch('https://api.paystack.co/subscription/enable', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: subCode, token: '' }),
        });

        if (!enableRes.ok) {
          const errText = await enableRes.text();
          console.error('Paystack enable subscription error:', errText);
          return fail('Unable to reinstate subscription with Paystack. Please try again or contact support.', 502);
        }

        const enableData = await enableRes.json();
        if (!enableData.status) {
          console.error('Paystack enable failed:', enableData.message);
          return fail(enableData.message ?? 'Paystack reinstatement failed', 502);
        }
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ plan_status: 'active' })
        .eq('id', userId);

      if (updateErr) {
        console.error('Failed to update plan_status to active:', updateErr);
        return fail('Reinstatement processed but profile update failed', 500);
      }

      return ok({
        success: true,
        message: 'Subscription reinstated. Recurring billing will resume from your existing billing date.',
        next_billing_date: profile.plan_renewal_date,
      });
    }

    // target === 'learning_hub'
    if (profile.learning_hub_plan_status === 'active') {
      return ok({ success: true, message: 'Learning Hub subscription already active' });
    }

    if (profile.learning_hub_renewal_date && new Date() >= new Date(profile.learning_hub_renewal_date)) {
      return fail('Your Learning Hub access period has ended. Please purchase a new add-on.', 400);
    }

    const lhSubCode = profile.learning_hub_subscription_code;
    if (lhSubCode) {
      const enableRes = await fetch('https://api.paystack.co/subscription/enable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: lhSubCode, token: '' }),
      });

      if (!enableRes.ok) {
        const errText = await enableRes.text();
        console.error('Paystack enable LH subscription error:', errText);
        return fail('Unable to reinstate Learning Hub subscription. Please try again or contact support.', 502);
      }

      const enableData = await enableRes.json();
      if (!enableData.status) {
        console.error('Paystack enable LH failed:', enableData.message);
        return fail(enableData.message ?? 'Paystack reinstatement failed', 502);
      }
    }

    const { error: lhUpdateErr } = await supabase
      .from('profiles')
      .update({ learning_hub_plan_status: 'active' })
      .eq('id', userId);

    if (lhUpdateErr) {
      console.error('Failed to update learning_hub_plan_status to active:', lhUpdateErr);
      return fail('Reinstatement processed but profile update failed', 500);
    }

    return ok({
      success: true,
      message: 'Learning Hub reinstated. Recurring billing will resume from your existing renewal date.',
      next_billing_date: profile.learning_hub_renewal_date,
    });
  } catch (err) {
    console.error('paystack-reinstate-subscription error:', err);
    return fail('Internal server error', 500);
  }
});
