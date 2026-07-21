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

// ─── Auth helper ─────────────────────────────────────────────────────────────
async function resolveUserId(req: Request, supabase: ReturnType<typeof createClient>): Promise<string> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return '';
  const { data: { user } } = await supabase.auth.getUser(token);
  return user?.id ?? '';
}

// ─── Cancel subscription ──────────────────────────────────────────────────────
async function handleCancel(
  supabase: ReturnType<typeof createClient>,
  paystackKey: string,
  userId: string,
  target: 'plan' | 'learning_hub'
): Promise<Response> {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('plan, plan_status, paystack_subscription_code, plan_renewal_date, learning_hub_plan_status, learning_hub_subscription_code, learning_hub_renewal_date')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profile) return fail('Profile not found', 404);

  if (target === 'plan') {
    if (profile.plan === 'free') return fail('Free plan cannot be cancelled');
    if (profile.plan_status === 'cancelled') return ok({ success: true, message: 'Plan already cancelled' });

    const subCode = profile.paystack_subscription_code;
    if (subCode) {
      const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: subCode, token: '' }),
      });
      if (disableRes.ok) {
        const disableData = await disableRes.json();
        if (!disableData.status) console.error('Paystack disable failed:', disableData.message);
      } else {
        console.error('Paystack disable error:', await disableRes.text());
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

    return ok({ success: true, message: 'Subscription cancelled.', access_until: profile.plan_renewal_date });
  }

  // learning_hub
  if (profile.learning_hub_plan_status === 'cancelled') return ok({ success: true, message: 'Learning Hub already cancelled' });

  const lhSubCode = profile.learning_hub_subscription_code;
  if (lhSubCode) {
    const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: lhSubCode, token: '' }),
    });
    if (!disableRes.ok) console.error('Paystack disable LH error:', await disableRes.text());
  }

  const { error: lhUpdateErr } = await supabase
    .from('profiles')
    .update({ learning_hub_plan_status: 'cancelled' })
    .eq('id', userId);

  if (lhUpdateErr) {
    console.error('Failed to update learning_hub_plan_status:', lhUpdateErr);
    return fail('Cancellation processed but profile update failed', 500);
  }

  return ok({ success: true, message: 'Learning Hub add-on cancelled.', access_until: profile.learning_hub_renewal_date });
}

// ─── Reinstate subscription ───────────────────────────────────────────────────
async function handleReinstate(
  supabase: ReturnType<typeof createClient>,
  paystackKey: string,
  userId: string,
  target: 'plan' | 'learning_hub'
): Promise<Response> {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('plan, plan_status, paystack_subscription_code, plan_renewal_date, learning_hub_plan_status, learning_hub_subscription_code, learning_hub_renewal_date')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profile) return fail('Profile not found', 404);

  if (target === 'plan') {
    if (profile.plan_status === 'active') return ok({ success: true, message: 'Subscription already active' });

    if (profile.plan_renewal_date && new Date() >= new Date(profile.plan_renewal_date)) {
      return fail('Your access period has ended. Please purchase a new subscription.', 400);
    }

    const subCode = profile.paystack_subscription_code;
    if (subCode) {
      const enableRes = await fetch('https://api.paystack.co/subscription/enable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: subCode, token: '' }),
      });
      if (!enableRes.ok) {
        console.error('Paystack enable error:', await enableRes.text());
        return fail('Unable to reinstate subscription. Please try again or contact support.', 502);
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

    return ok({ success: true, message: 'Subscription reinstated.', next_billing_date: profile.plan_renewal_date });
  }

  // learning_hub
  if (profile.learning_hub_plan_status === 'active') return ok({ success: true, message: 'Learning Hub already active' });

  if (profile.learning_hub_renewal_date && new Date() >= new Date(profile.learning_hub_renewal_date)) {
    return fail('Your Learning Hub access period has ended. Please purchase a new add-on.', 400);
  }

  const lhSubCode = profile.learning_hub_subscription_code;
  if (lhSubCode) {
    const enableRes = await fetch('https://api.paystack.co/subscription/enable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: lhSubCode, token: '' }),
    });
    if (!enableRes.ok) {
      console.error('Paystack enable LH error:', await enableRes.text());
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

  return ok({ success: true, message: 'Learning Hub reinstated.', next_billing_date: profile.learning_hub_renewal_date });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackKey) return fail('PAYSTACK_SECRET_KEY not configured', 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { action } = body;

    // ── Cancel / Reinstate actions ─────────────────────────────────────────────
    if (action === 'cancel' || action === 'reinstate') {
      const userId = await resolveUserId(req, supabase);
      if (!userId) return fail('Unauthorized', 401);

      const target: 'plan' | 'learning_hub' = body.target ?? 'plan';
      return action === 'cancel'
        ? handleCancel(supabase, paystackKey, userId, target)
        : handleReinstate(supabase, paystackKey, userId, target);
    }

    // ── Existing upgrade flow ─────────────────────────────────────────────────
    const { reference, planType, billingPeriod } = body;
    if (!reference || !planType || !billingPeriod) {
      return fail('Missing required fields: reference, planType, billingPeriod');
    }
    if (!['pro', 'career_accelerator'].includes(planType)) {
      return fail('Invalid planType. Must be pro or career_accelerator');
    }
    if (!['two_months', 'annual'].includes(billingPeriod)) {
      return fail('Invalid billingPeriod. Must be two_months or annual');
    }

    const userId = await resolveUserId(req, supabase);
    if (!userId) return fail('Unauthorized', 401);

    // Idempotency: check if this reference was already processed
    const { data: existingPayment } = await supabase
      .from('learning_hub_payments')
      .select('id, status')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (existingPayment?.status === 'completed') {
      return ok({ success: true, message: 'Plan already upgraded' });
    }

    // Verify with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackKey}` } }
    );

    if (!verifyRes.ok) {
      const errText = await verifyRes.text();
      console.error('Paystack verify error:', errText);
      return fail('Failed to verify payment with Paystack', 502);
    }

    const verifyData = await verifyRes.json();
    const txn = verifyData.data;

    if (!verifyData.status || txn?.status !== 'success') {
      return ok({ success: false, message: 'Payment not completed' });
    }

    // Calculate renewal date based on billing period
    const now = new Date();
    const renewalDate = new Date(now);
    if (billingPeriod === 'annual') {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else {
      renewalDate.setMonth(renewalDate.getMonth() + 2);
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan: planType, plan_renewal_date: renewalDate.toISOString() })
      .eq('id', userId);

    if (profileErr) {
      console.error('Failed to update plan:', profileErr);
      return fail('Payment verified but plan activation failed', 500);
    }

    const dbBillingPeriod = billingPeriod === 'two_months' ? '2_months' : 'annual';
    await supabase.from('learning_hub_payments').upsert(
      {
        user_id: userId,
        paystack_reference: reference,
        amount_kobo: txn.amount ?? 0,
        plan_type: planType,
        billing_period: dbBillingPeriod,
        status: 'completed',
        completed_at: now.toISOString(),
      },
      { onConflict: 'paystack_reference' }
    );

    return ok({ success: true, message: `Plan upgraded to ${planType}`, plan: planType, renewal_date: renewalDate.toISOString() });
  } catch (err) {
    console.error('paystack-plan-upgrade error:', err);
    return fail('Internal server error', 500);
  }
});
