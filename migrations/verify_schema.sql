-- Verify whether the security and scalability migration has been applied
-- Run this in Supabase SQL Editor

-- 1. Check core tables
SELECT 'public.users' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'
) AS exists;

SELECT 'public.payment_transactions' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_transactions'
) AS exists;

SELECT 'public.audit_logs' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs'
) AS exists;

SELECT 'public.api_keys' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='api_keys'
) AS exists;

SELECT 'public.user_sessions' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_sessions'
) AS exists;

SELECT 'public.transactions' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transactions'
) AS exists;

-- 2. Check important columns on users
SELECT 'users.is_premium' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_premium'
) AS exists;

SELECT 'users.premium_plan' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='premium_plan'
) AS exists;

SELECT 'users.premium_updated_at' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='premium_updated_at'
) AS exists;

SELECT 'users.last_login' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_login'
) AS exists;

SELECT 'users.failed_login_attempts' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='failed_login_attempts'
) AS exists;

SELECT 'users.account_locked_until' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='account_locked_until'
) AS exists;

SELECT 'users.two_factor_enabled' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='two_factor_enabled'
) AS exists;

SELECT 'users.updated_at' AS object_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='updated_at'
) AS exists;

-- 3. Check indexes
SELECT 'idx_users_email' AS object_name, EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_users_email'
) AS exists;

SELECT 'idx_users_is_premium' AS object_name, EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_users_is_premium'
) AS exists;

SELECT 'idx_transactions_user_id' AS object_name, EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_transactions_user_id'
) AS exists;

SELECT 'idx_audit_created_at' AS object_name, EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_audit_created_at'
) AS exists;

SELECT 'idx_sessions_active' AS object_name, EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_sessions_active'
) AS exists;

-- 4. Check policies
SELECT 'policy: payment_transactions select' AS object_name, EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='Users can view their own transactions'
) AS exists;

SELECT 'policy: payment_transactions insert' AS object_name, EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='Only admins can insert transactions'
) AS exists;

SELECT 'policy: audit_logs select' AS object_name, EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='Users can view their own audit logs'
) AS exists;

SELECT 'policy: api_keys all' AS object_name, EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_keys' AND policyname='Users can manage their own API keys'
) AS exists;

SELECT 'policy: user_sessions select' AS object_name, EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_sessions' AND policyname='Users can view their own sessions'
) AS exists;

-- 5. Check functions and triggers
SELECT 'function: update_updated_at_column' AS object_name, EXISTS (
  SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace = 'public'::regnamespace
) AS exists;

SELECT 'function: log_audit_event' AS object_name, EXISTS (
  SELECT 1 FROM pg_proc WHERE proname='log_audit_event' AND pronamespace = 'public'::regnamespace
) AS exists;

SELECT 'trigger: update_users_updated_at' AS object_name, EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname='update_users_updated_at'
) AS exists;

SELECT 'trigger: update_payment_transactions_updated_at' AS object_name, EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname='update_payment_transactions_updated_at'
) AS exists;
