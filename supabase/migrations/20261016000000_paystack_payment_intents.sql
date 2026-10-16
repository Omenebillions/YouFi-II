CREATE TABLE public.paystack_payment_intents (
  reference text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('pro_monthly', 'pro_yearly', 'biz_monthly', 'biz_yearly')),
  amount_subunits bigint NOT NULL CHECK (amount_subunits > 0),
  currency text NOT NULL CHECK (currency IN ('USD', 'NGN', 'GHS', 'KES', 'ZAR')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified')),
  paystack_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz
);

ALTER TABLE public.paystack_payment_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.paystack_payment_intents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.paystack_payment_intents TO service_role;

CREATE FUNCTION public.complete_paystack_payment(
  p_reference text,
  p_transaction_id text,
  p_verified_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_intent public.paystack_payment_intents%ROWTYPE;
  v_period_start timestamptz;
  v_expires_at timestamptz;
BEGIN
  SELECT *
    INTO v_intent
    FROM public.paystack_payment_intents
   WHERE reference = p_reference
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent not found';
  END IF;

  IF v_intent.status = 'verified' THEN
    RETURN true;
  END IF;

  IF v_intent.expires_at <= p_verified_at THEN
    RAISE EXCEPTION 'Payment intent has expired';
  END IF;

  SELECT expires_at
    INTO v_period_start
    FROM public.user_subscriptions
   WHERE user_id = v_intent.user_id
     AND status = 'active'
     AND expires_at > p_verified_at
   FOR UPDATE;

  v_period_start := greatest(coalesce(v_period_start, p_verified_at), p_verified_at);
  v_expires_at := CASE
    WHEN v_intent.plan_id IN ('pro_yearly', 'biz_yearly') THEN v_period_start + interval '1 year'
    ELSE v_period_start + interval '1 month'
  END;

  INSERT INTO public.user_subscriptions (
    user_id, status, plan_id, platform, purchase_token, expires_at, auto_renew, updated_at
  )
  VALUES (
    v_intent.user_id, 'active', v_intent.plan_id, 'web', p_reference, v_expires_at, false, p_verified_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    plan_id = EXCLUDED.plan_id,
    platform = 'web',
    purchase_token = EXCLUDED.purchase_token,
    expires_at = EXCLUDED.expires_at,
    auto_renew = false,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.subscription_transactions (
    user_id, platform, transaction_id, amount, currency, status, raw_data
  )
  VALUES (
    v_intent.user_id,
    'web',
    p_transaction_id,
    v_intent.amount_subunits / 100.0,
    v_intent.currency,
    'verified',
    jsonb_build_object('reference', p_reference, 'plan_id', v_intent.plan_id)
  );

  UPDATE public.paystack_payment_intents
     SET status = 'verified',
         paystack_transaction_id = p_transaction_id,
         verified_at = p_verified_at
   WHERE reference = p_reference;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_paystack_payment(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paystack_payment(text, text, timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
