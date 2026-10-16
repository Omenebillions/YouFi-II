import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getAuthenticatedUser(request: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || request.headers.get("apikey");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !authorization?.startsWith("Bearer ")) {
    return null;
  }

  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function verifyAndActivatePayment(reference: string, expectedUserId?: string) {
  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    return { error: "Paystack verification is not configured.", status: 503 };
  }

  const admin = createAdminClient();
  const { data: intent, error: intentError } = await admin
    .from("paystack_payment_intents")
    .select("reference,user_id,amount_subunits,currency,status,expires_at")
    .eq("reference", reference)
    .maybeSingle();
  if (intentError) {
    console.error("[Paystack]: Failed to load payment intent:", intentError);
    return { error: "Could not verify this payment. Please try again.", status: 500 };
  }
  if (!intent || (expectedUserId && intent.user_id !== expectedUserId)) {
    return { error: "Payment reference was not found for this account.", status: 404 };
  }
  if (intent.status === "verified") {
    return { success: true, alreadyVerified: true };
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  let verification: {
    status?: boolean;
    message?: string;
    data?: {
      id?: number;
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      paid_at?: string;
    };
  };
  try {
    verification = await response.json();
  } catch {
    console.error("[Paystack]: Transaction verification returned invalid JSON.");
    return { error: "Paystack could not verify this payment. Please try again.", status: 502 };
  }
  if (!response.ok || verification.status !== true || !verification.data) {
    console.error("[Paystack]: Transaction verification request failed:", verification.message);
    return { error: "Paystack could not verify this payment. Please try again.", status: 502 };
  }

  const transaction = verification.data;
  const paidAt = transaction.paid_at ? new Date(transaction.paid_at) : null;
  if (
    transaction.status !== "success" ||
    transaction.reference !== intent.reference ||
    transaction.amount !== Number(intent.amount_subunits) ||
    transaction.currency !== intent.currency ||
    typeof transaction.id !== "number" ||
    !paidAt ||
    Number.isNaN(paidAt.getTime()) ||
    paidAt.getTime() > new Date(intent.expires_at).getTime()
  ) {
    return { error: "The payment could not be verified against the expected amount, currency, and checkout period.", status: 400 };
  }

  const { error: completionError } = await admin.rpc("complete_paystack_payment", {
    p_reference: intent.reference,
    p_transaction_id: String(transaction.id),
    p_verified_at: paidAt.toISOString(),
  });
  if (completionError) {
    console.error("[Paystack]: Supabase could not activate the verified payment:", completionError);
    return { error: "Payment was received, but subscription activation failed. Contact support with your reference.", status: 500 };
  }

  return { success: true };
}
