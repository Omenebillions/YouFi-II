import { createAdminClient, corsHeaders, getAuthenticatedUser, jsonResponse } from "../_shared/paystack.ts";

const plans = {
  pro_monthly: { usd: 4.99, ngn: 2500 },
  pro_yearly: { usd: 39.99, ngn: 20000 },
  biz_monthly: { usd: 12.99, ngn: 7000 },
  biz_yearly: { usd: 99.99, ngn: 60000 },
} as const;

const supportedCurrencies = new Set(["USD", "NGN", "GHS", "KES", "ZAR"]);

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return jsonResponse({ error: "A valid signed-in session is required." }, 401);
    if (!user.email) return jsonResponse({ error: "Your account must have an email address to purchase a plan." }, 400);

    const body = await request.json();
    const planId = body?.planId;
    const currency = body?.currency;
    if (typeof planId !== "string" || !Object.hasOwn(plans, planId)) {
      return jsonResponse({ error: "Select a valid subscription plan." }, 400);
    }
    if (typeof currency !== "string" || !supportedCurrencies.has(currency)) {
      return jsonResponse({ error: "The selected payment currency is not supported." }, 400);
    }

    const selectedPlan = plans[planId as keyof typeof plans];
    let amountMajor = currency === "NGN" ? selectedPlan.ngn : selectedPlan.usd;
    if (currency !== "NGN" && currency !== "USD") {
      const ratesResponse = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!ratesResponse.ok) {
        return jsonResponse({ error: "Could not retrieve the current exchange rate. Please try again." }, 502);
      }
      const ratesData = await ratesResponse.json() as { rates?: Record<string, number> };
      const rate = ratesData.rates?.[currency];
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        return jsonResponse({ error: `An exchange rate for ${currency} is unavailable.` }, 502);
      }
      amountMajor = Math.round(selectedPlan.usd * rate * 100) / 100;
    }

    const admin = createAdminClient();
    const reference = `youfi-${crypto.randomUUID()}`;
    const amount = Math.round(amountMajor * 100);
    const { error: cleanupError } = await admin
      .from("paystack_payment_intents")
      .delete()
      .lt("expires_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq("status", "pending");
    if (cleanupError) {
      console.error("[Paystack]: Could not clean up expired payment intents:", cleanupError);
      return jsonResponse({ error: "Could not prepare your payment. Please try again." }, 500);
    }

    const { error: insertError } = await admin.from("paystack_payment_intents").insert({
      reference,
      user_id: user.id,
      plan_id: planId,
      amount_subunits: amount,
      currency,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
    if (insertError) {
      console.error("[Paystack]: Failed to create payment intent:", insertError);
      return jsonResponse({ error: "Could not prepare your payment. Please try again." }, 500);
    }

    return jsonResponse({ reference, amount, currency });
  } catch (error) {
    console.error("[Paystack]: Payment initialization failed:", error);
    return jsonResponse({ error: "Could not prepare your payment. Please try again." }, 500);
  }
});
