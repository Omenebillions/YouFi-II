-- ==================== BILLING TRIAL & MULTI-GATEWAY SUPPORT ====================
-- Safe idempotent migration for trial access and provider-aware billing.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS billing_provider TEXT DEFAULT 'none';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS billing_customer_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS billing_reference TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_subscriptions' AND policyname = 'Users can view their own subscriptions'
  ) THEN
    CREATE POLICY "Users can view their own subscriptions"
      ON public.billing_subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_subscriptions' AND policyname = 'Users can insert their own subscriptions'
  ) THEN
    CREATE POLICY "Users can insert their own subscriptions"
      ON public.billing_subscriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON public.users(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_billing_provider ON public.users(billing_provider);
CREATE INDEX IF NOT EXISTS idx_billing_user_id ON public.billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_provider ON public.billing_subscriptions(provider);

-- ==================== END BILLING TRIAL MIGRATION ====================
