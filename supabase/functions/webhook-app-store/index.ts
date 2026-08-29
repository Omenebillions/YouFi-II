import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  try {
    const body = await req.json();
    
    // App Store Server Notifications V2 uses signed payloads
    const { signedPayload } = body;
    if (!signedPayload) {
      return new Response("Missing signedPayload", { status: 400 });
    }

    // In a real implementation, you verify the JWT using Apple's public key
    // For this example, we'll parse the unverified JWT payload
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      return new Response("Invalid JWT", { status: 400 });
    }

    const payloadBuffer = Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(payloadBuffer));

    const { notificationType, subtype, data } = payload;
    
    if (notificationType === 'TEST') {
      return new Response("Test notification", { status: 200 });
    }

    const signedTransactionInfo = data?.signedTransactionInfo;
    let transactionInfo: any = {};
    if (signedTransactionInfo) {
      const txParts = signedTransactionInfo.split('.');
      if (txParts.length === 3) {
        const txBuffer = Uint8Array.from(atob(txParts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        transactionInfo = JSON.parse(new TextDecoder().decode(txBuffer));
      }
    }

    const originalTransactionId = transactionInfo.originalTransactionId;
    const expiresDate = transactionInfo.expiresDate ? new Date(transactionInfo.expiresDate) : new Date();
    
    let status = 'active';
    let autoRenew = true;

    // Map notification types to statuses
    switch (notificationType) {
      case 'DID_RENEW':
      case 'SUBSCRIBED':
        status = 'active';
        autoRenew = true;
        break;
      case 'DID_FAIL_TO_RENEW':
      case 'EXPIRED':
        status = 'expired';
        autoRenew = false;
        break;
      case 'REFUND':
      case 'REVOKE':
        status = 'revoked';
        autoRenew = false;
        break;
      case 'DID_CHANGE_RENEWAL_STATUS':
        if (subtype === 'AUTO_RENEW_DISABLED') {
          autoRenew = false;
        } else if (subtype === 'AUTO_RENEW_ENABLED') {
          autoRenew = true;
        }
        break;
    }

    let userId = null;
    if (originalTransactionId) {
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('platform', 'ios')
        .eq('original_transaction_id', originalTransactionId)
        .maybeSingle();
      if (existingSub) userId = existingSub.user_id;
    }

    const eventId = payload.notificationUUID || (originalTransactionId + '_' + notificationType);
    const { data: existingTx } = await supabase.from('subscription_transactions')
        .select('id')
        .eq('transaction_id', eventId)
        .maybeSingle();
        
    if (!existingTx) {
      await supabase.from('subscription_transactions').insert({
        user_id: userId,
        platform: 'ios',
        transaction_id: eventId,
        amount: 0,
        currency: 'USD',
        status: status,
        raw_data: payload
      });
    }

    if (originalTransactionId && userId) {


        await supabase.from('user_subscriptions')
          .update({
            status: status,
            expires_at: expiresDate.toISOString(),
            auto_renew: autoRenew,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});
