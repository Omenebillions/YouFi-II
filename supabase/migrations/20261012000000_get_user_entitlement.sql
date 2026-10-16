DROP FUNCTION IF EXISTS public.get_user_entitlement(uuid);

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
  trial_ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    CASE WHEN u.created_at + interval '30 days' > now() THEN 'trial'
         ELSE coalesce(s.status, 'inactive')
    END,
    coalesce(
      (u.created_at + interval '30 days' > now())
      OR (s.status = 'active' AND s.expires_at > now()),
      false
    ),
    coalesce(
      (u.created_at + interval '30 days' > now())
      OR (s.status = 'active' AND s.expires_at > now()),
      false
    ),
    (u.created_at + interval '30 days' > now()),
    coalesce(s.status = 'active' AND s.expires_at > now(), false),
    coalesce(s.status = 'payment_failed', false),
    coalesce(s.status = 'expired' OR s.expires_at <= now(), false),
    NOT coalesce((
      (u.created_at + interval '30 days' > now())
      OR (s.status = 'active' AND s.expires_at > now())
    ), false),
    s.expires_at,
    u.created_at + interval '30 days'
  FROM public.users AS u
  LEFT JOIN public.user_subscriptions AS s ON s.user_id = u.id
  WHERE u.id = p_user_id
    AND p_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_user_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_entitlement(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
