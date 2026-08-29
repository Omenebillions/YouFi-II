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

    const { purchaseToken, productId, packageName } = await req.json();

    if (!purchaseToken || !productId || !packageName) {
      throw new Error('Missing purchase token or product details');
    }

    // Call Google Play Developer API
    // Using a service account JSON stored in an env variable
    // For this demonstration we outline the structural HTTP call to googleapis
    
    // In production, you'd use a JWT to get an access token for Google API.
    // Assuming you have GOOGLE_ACCESS_TOKEN logic or library:
    const GOOGLE_ACCESS_TOKEN = "fetch_this_with_jwt"; // Placeholder
    
    // Validate with Google
    // const googleRes = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`, {
    //   headers: { Authorization: `Bearer ${GOOGLE_ACCESS_TOKEN}` }
    // });
    // const googleData = await googleRes.json();
    
    // Mocking google validation for this edge function structure:
    const isValid = true; 
    const expiryTimeMillis = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now
    
    if (!isValid) {
      throw new Error('Invalid purchase token');
    }

    const expiresAt = new Date(expiryTimeMillis).toISOString();

    // Upsert subscription
    const { error: dbError } = await supabaseClient
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        status: 'active',
        plan_id: productId,
        platform: 'android',
        purchase_token: purchaseToken,
        expires_at: expiresAt,
        auto_renew: true, // or from googleData.autoRenewing
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (dbError) throw dbError;

    // Log transaction
    await supabaseClient.from('subscription_transactions').insert({
      user_id: user.id,
      platform: 'android',
      transaction_id: purchaseToken, // or Google orderId
      status: 'verified',
      raw_data: { productId, purchaseToken }
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
