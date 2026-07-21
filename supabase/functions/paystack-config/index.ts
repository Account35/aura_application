const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const publicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY');

  if (!publicKey) {
    return new Response(
      JSON.stringify({ error: 'PAYSTACK_PUBLIC_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Security: never return a secret key to the browser
  if (publicKey.startsWith('sk_') || publicKey.startsWith('SK_')) {
    return new Response(
      JSON.stringify({ error: 'Invalid key type: a secret key was configured instead of a public key. Please set your Paystack PUBLIC key (starts with pk_).' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({ publicKey }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
});
