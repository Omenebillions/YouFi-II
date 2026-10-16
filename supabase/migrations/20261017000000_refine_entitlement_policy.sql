ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_grace_ends_at timestamptz;

UPDATE public.user_subscriptions
   SET payment_failed_at = coalesce(payment_failed_at, updated_at, now()),
       payment_grace_ends_at = coalesce(
         payment_grace_ends_at,
         coalesce(payment_failed_at, updated_at, now()) + interval '7 days'
       )
 WHERE status = 'payment_failed'
   AND payment_grace_ends_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_subscription_payment_failure_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.status = 'payment_failed' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.payment_failed_at := now();
      NEW.payment_grace_ends_at := now() + interval '7 days';
    ELSIF OLD.status IS DISTINCT FROM 'payment_failed' THEN
      NEW.payment_failed_at := now();
      NEW.payment_grace_ends_at := now() + interval '7 days';
    ELSE
      NEW.payment_failed_at := coalesce(NEW.payment_failed_at, OLD.payment_failed_at, now());
      NEW.payment_grace_ends_at := coalesce(
        NEW.payment_grace_ends_at,
        OLD.payment_grace_ends_at,
        NEW.payment_failed_at + interval '7 days'
      );
    END IF;
  ELSE
    NEW.payment_failed_at := NULL;
    NEW.payment_grace_ends_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_subscription_payment_failure_timestamps() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_subscription_payment_failure_timestamps ON public.user_subscriptions;
CREATE TRIGGER set_subscription_payment_failure_timestamps
BEFORE INSERT OR UPDATE OF status, payment_failed_at, payment_grace_ends_at
ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_subscription_payment_failure_timestamps();

CREATE OR REPLACE FUNCTION public.has_full_access(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT user_uuid = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.users AS u
        JOIN auth.users AS auth_user ON auth_user.id = u.id
        LEFT JOIN public.user_subscriptions AS s ON s.user_id = u.id
       WHERE u.id = user_uuid
         AND (
           (s.user_id IS NULL AND auth_user.created_at + interval '30 days' > now())
           OR (s.status = 'active' AND s.expires_at > now())
           OR (
             s.status = 'payment_failed'
             AND s.payment_failed_at IS NOT NULL
             AND s.payment_grace_ends_at > now()
           )
         )
    );
$$;

REVOKE ALL ON FUNCTION public.has_full_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_full_access(uuid) TO authenticated;

DROP FUNCTION public.get_user_entitlement(uuid);

CREATE FUNCTION public.get_user_entitlement(p_user_id uuid)
RETURNS TABLE (
  status text,
  has_full_access boolean,
  can_modify_data boolean,
  is_trial boolean,
  is_active boolean,
  is_payment_failed boolean,
  is_expired boolean,
  preview_only boolean,
  subscription_ends_at timestamptz,
  trial_ends_at timestamptz,
  payment_failed_at timestamptz,
  payment_grace_ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH entitlement AS (
    SELECT
      auth_user.created_at + interval '30 days' > now()
        AND s.user_id IS NULL AS trial_eligible,
      coalesce(s.status = 'active' AND s.expires_at > now(), false) AS subscription_active,
      coalesce(
        s.status = 'payment_failed'
          AND s.payment_failed_at IS NOT NULL
          AND s.payment_grace_ends_at > now(),
        false
      ) AS in_payment_grace,
      s.user_id IS NOT NULL AS has_subscription,
      s.status AS subscription_status,
      s.expires_at AS subscription_ends_at,
      s.payment_failed_at,
      s.payment_grace_ends_at,
      auth_user.created_at + interval '30 days' AS trial_ends_at
    FROM public.users AS u
    JOIN auth.users AS auth_user ON auth_user.id = u.id
    LEFT JOIN public.user_subscriptions AS s ON s.user_id = u.id
    WHERE u.id = p_user_id
      AND p_user_id = auth.uid()
  )
  SELECT
    CASE
      WHEN subscription_active THEN 'active'
      WHEN in_payment_grace THEN 'payment_failed'
      WHEN trial_eligible THEN 'trial'
      WHEN has_subscription AND (
        subscription_status = 'expired'
        OR (subscription_status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at <= now()))
        OR (subscription_status = 'payment_failed' AND NOT in_payment_grace)
      ) THEN 'expired'
      ELSE coalesce(subscription_status, 'inactive')
    END,
    subscription_active OR in_payment_grace OR trial_eligible,
    subscription_active OR in_payment_grace OR trial_eligible,
    trial_eligible,
    subscription_active,
    coalesce(subscription_status = 'payment_failed', false),
    has_subscription AND (
      subscription_status = 'expired'
      OR (subscription_status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at <= now()))
      OR (subscription_status = 'payment_failed' AND NOT in_payment_grace)
    ),
    NOT (subscription_active OR in_payment_grace OR trial_eligible),
    subscription_ends_at,
    CASE WHEN trial_eligible OR NOT has_subscription THEN trial_ends_at END,
    payment_failed_at,
    payment_grace_ends_at
  FROM entitlement;
$$;

REVOKE ALL ON FUNCTION public.get_user_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_entitlement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_paystack_payment(
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
    user_id, status, plan_id, platform, purchase_token, expires_at, auto_renew, updated_at,
    payment_failed_at, payment_grace_ends_at
  )
  VALUES (
    v_intent.user_id, 'active', v_intent.plan_id, 'web', p_reference, v_expires_at, false,
    p_verified_at, NULL, NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    plan_id = EXCLUDED.plan_id,
    platform = 'web',
    purchase_token = EXCLUDED.purchase_token,
    expires_at = EXCLUDED.expires_at,
    auto_renew = false,
    updated_at = EXCLUDED.updated_at,
    payment_failed_at = NULL,
    payment_grace_ends_at = NULL;

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
