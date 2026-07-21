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

    const { amount, billingPeriod, callbackUrl } = await req.json();
    if (!amount || !billingPeriod || !callbackUrl) {
      return fail('Missing required fields: amount, billingPeriod, callbackUrl');
    }

    // Get the user from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let userEmail = '';
    let userId = '';
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userEmail = user.email ?? '';
        userId = user.id;
      }
    }

    if (!userEmail) return fail('Unable to identify user', 401);

    // Initialize Paystack transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        amount, // amount in kobo (ZAR cents)
        currency: 'ZAR',
        callback_url: callbackUrl,
        metadata: {
          user_id: userId,
          billing_period: billingPeriod,
          product: 'learning_hub_addon',
        },
      }),
    });

    if (!paystackRes.ok) {
      const errText = await paystackRes.text();
      console.error('Paystack initialize error:', errText);
      return fail('Failed to initialize payment', 502);
    }

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return fail(paystackData.message ?? 'Payment initialization failed');
    }

    const { authorization_url, reference } = paystackData.data;

    // Record pending payment
    await supabase.from('learning_hub_payments').insert({
      user_id: userId,
      paystack_reference: reference,
      amount_kobo: amount,
      plan_type: 'learning_hub_addon',
      billing_period: billingPeriod === 'two_months' ? '2_months' : 'annual',
      status: 'pending',
    });

    return ok({ authorization_url, reference });
  } catch (err) {
    console.error('paystack-initialize error:', err);
    return fail('Internal server error', 500);
  }
});
