import {
  corsHeaders,
  jsonResponse,
  verifyAndActivatePayment,
} from "../_shared/paystack.ts";

async function isValidSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const expected = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  let difference = expected.length ^ signature.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      console.error("[Paystack webhook]: PAYSTACK_SECRET_KEY is not configured.");
      return jsonResponse({ error: "Webhook verification is not configured." }, 503);
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature") || "";
    if (!await isValidSignature(rawBody, signature, secretKey)) {
      return jsonResponse({ error: "Invalid webhook signature." }, 401);
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string };
    };
    if (event.event !== "charge.success") {
      return jsonResponse({ received: true });
    }
    if (typeof event.data?.reference !== "string") {
      return jsonResponse({ error: "Webhook payment reference is missing." }, 400);
    }

    const result = await verifyAndActivatePayment(event.data.reference);
    return jsonResponse(result, "status" in result ? result.status : 200);
  } catch (error) {
    console.error("[Paystack webhook]: Event processing failed:", error);
    return jsonResponse({ error: "Could not process the payment event." }, 500);
  }
});
