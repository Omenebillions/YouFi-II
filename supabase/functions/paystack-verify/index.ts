import {
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  verifyAndActivatePayment,
} from "../_shared/paystack.ts";

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

    const body = await request.json();
    const reference = body?.reference;
    if (typeof reference !== "string" || !/^youfi-[0-9a-f-]{36}$/i.test(reference)) {
      return jsonResponse({ error: "A valid payment reference is required." }, 400);
    }

    const result = await verifyAndActivatePayment(reference, user.id);
    return jsonResponse(result, "status" in result ? result.status : 200);
  } catch (error) {
    console.error("[Paystack]: Payment verification failed:", error);
    return jsonResponse({ error: "Could not verify this payment. Please try again." }, 500);
  }
});
