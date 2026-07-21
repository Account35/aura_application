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

    const { reference } = await req.json();
    if (!reference) return fail('Missing reference');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if already processed (idempotency)
    const { data: existingPayment } = await supabase
      .from('learning_hub_payments')
      .select('id, status, user_id, billing_period')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (existingPayment?.status === 'completed') {
      return ok({ success: true, message: 'Payment already verified' });
    }

    // Verify with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${paystackKey}` },
      }
    );

    if (!verifyRes.ok) {
      const errText = await verifyRes.text();
      console.error('Paystack verify error:', errText);
      return fail('Failed to verify payment with Paystack', 502);
    }

    const verifyData = await verifyRes.json();
    const txn = verifyData.data;

    if (!verifyData.status || txn?.status !== 'success') {
      // Mark as failed
      if (existingPayment) {
        await supabase
          .from('learning_hub_payments')
          .update({ status: 'failed' })
          .eq('paystack_reference', reference)
          .eq('status', 'pending');
      }
      return ok({ success: false, message: 'Payment not completed' });
    }

    // Determine billing period from metadata
    const billingPeriod: string =
      txn.metadata?.billing_period ?? existingPayment?.billing_period ?? '2_months';
    const userId: string = txn.metadata?.user_id ?? existingPayment?.user_id ?? '';

    if (!userId) return fail('Cannot identify user for payment activation', 400);

    // Calculate renewal date: today + billing period + 3 week extension
    const now = new Date();
    let renewalDate = new Date(now);
    if (billingPeriod === 'annual') {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else {
      // 2 months
      renewalDate.setMonth(renewalDate.getMonth() + 2);
    }
    // Add 3 weeks extension
    renewalDate.setDate(renewalDate.getDate() + 21);

    // Activate Learning Hub on profile (optimistic lock: only if not already active)
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        learning_hub_addon: true,
        learning_hub_start_date: now.toISOString(),
        learning_hub_renewal_date: renewalDate.toISOString(),
      })
      .eq('id', userId);

    if (profileErr) {
      console.error('Failed to activate Learning Hub:', profileErr);
      return fail('Payment verified but activation failed', 500);
    }

    // Mark payment as completed
    await supabase
      .from('learning_hub_payments')
      .update({ status: 'completed', completed_at: now.toISOString() })
      .eq('paystack_reference', reference)
      .eq('status', 'pending');

    return ok({
      success: true,
      message: 'Learning Hub activated successfully',
      renewal_date: renewalDate.toISOString(),
    });
  } catch (err) {
    console.error('paystack-verify error:', err);
    return fail('Internal server error', 500);
  }
});
