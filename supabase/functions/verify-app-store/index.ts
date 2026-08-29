import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { receiptData, productId } = await req.json();

    if (!receiptData) {
      throw new Error('Missing receipt data');
    }

    // Call Apple App Store receipt validation
    // const IS_SANDBOX = Deno.env.get('APPLE_SANDBOX') === 'true';
    // const endpoint = IS_SANDBOX ? 'https://sandbox.itunes.apple.com/verifyReceipt' : 'https://buy.itunes.apple.com/verifyReceipt';
    
    // const appleRes = await fetch(endpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     'receipt-data': receiptData,
    //     'password': Deno.env.get('APPLE_SHARED_SECRET')
    //   })
    // });
    // const appleData = await appleRes.json();
    
    // Mocking apple validation for this edge function structure:
    const isValid = true; 
    const expiryTimeMillis = Date.now() + 30 * 24 * 60 * 60 * 1000;
    
    if (!isValid) {
      throw new Error('Invalid Apple receipt');
    }

    const expiresAt = new Date(expiryTimeMillis).toISOString();

    // Upsert subscription
    const { error: dbError } = await supabaseClient
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        status: 'active',
        plan_id: productId,
        platform: 'ios',
        purchase_token: receiptData, // store a hash or partial in prod
        expires_at: expiresAt,
        auto_renew: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (dbError) throw dbError;

    // Log transaction
    await supabaseClient.from('subscription_transactions').insert({
      user_id: user.id,
      platform: 'ios',
      transaction_id: 'apple_transaction_id',
      status: 'verified',
      raw_data: { receiptData, productId }
    });

    return new Response(JSON.stringify({ success: true, expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
