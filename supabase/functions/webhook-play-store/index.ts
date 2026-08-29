import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  try {
    const body = await req.json();
    
    // Google Play RTDN sends base64 encoded data inside message.data
    if (!body.message || !body.message.data) {
      return new Response("Invalid payload", { status: 400 });
    }

    const dataBuffer = Uint8Array.from(atob(body.message.data), c => c.charCodeAt(0));
    const dataString = new TextDecoder().decode(dataBuffer);
    const notification = JSON.parse(dataString);

    if (notification.testNotification) {
      return new Response("Test notification received", { status: 200 });
    }

    const { subscriptionNotification } = notification;
    if (!subscriptionNotification) {
      return new Response("Not a subscription notification", { status: 200 });
    }

    const { purchaseToken, subscriptionId, notificationType } = subscriptionNotification;

    // Retrieve authoritative subscription state from Google Play Developer API
    // using a service account (this is mocked for the example, but should call the real API)
    // const playApiRes = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.youfi.app/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`, { ... })
    // ...

    // Mock API response
    const mockExpiresAt = new Date();
    mockExpiresAt.setDate(mockExpiresAt.getDate() + 30);
    const expiresAtIso = mockExpiresAt.toISOString();

    // Map notification types to statuses
    // 1: SUBSCRIPTION_RECOVERED, 2: SUBSCRIPTION_RENEWED, 3: SUBSCRIPTION_CANCELED, 4: SUBSCRIPTION_PURCHASED...
    let status = 'active';
    let autoRenew = true;

    switch (notificationType) {
      case 3: // CANCELED
        autoRenew = false;
        break;
      case 5: // ON_HOLD
      case 6: // IN_GRACE_PERIOD
      case 13: // EXPIRED
        status = 'expired';
        autoRenew = false;
        break;
      case 12: // REVOKED
        status = 'revoked';
        autoRenew = false;
        break;
    }

    // We find the user subscription by purchase_token
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('platform', 'android')
      .eq('purchase_token', purchaseToken)
      .maybeSingle();

    // Check if this specific event was already processed (using a composite or hash if needed, but for simplicity we can just check if raw_data.notificationType matches recently)
    // Actually, making it idempotent means we only update if it's a new state or just always update to the latest state.
    // To prevent duplicate transaction rows for the same event:
    const eventId = notification.eventId || (purchaseToken + '_' + notificationType);
    const { data: existingTx } = await supabase.from('subscription_transactions')
        .select('id')
        .eq('transaction_id', eventId)
        .maybeSingle();
        
    if (!existingTx) {
      await supabase.from('subscription_transactions').insert({
        user_id: existingSub ? existingSub.user_id : null,
        platform: 'android',
        transaction_id: eventId,
        amount: 0,
        currency: 'USD',
        status: status,
        raw_data: notification
      });
    }

    if (existingSub) {
      await supabase.from('user_subscriptions')
        .update({
          status: status,
          expires_at: expiresAtIso,
          auto_renew: autoRenew,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', existingSub.user_id);
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
