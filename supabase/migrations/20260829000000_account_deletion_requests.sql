-- Migration: Account Deletion Requests table for public deletion flow & compliance
-- Run in Supabase SQL editor or automated migration runner

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists to avoid conflicts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'account_deletion_requests' 
    AND policyname = 'Users can view their own deletion requests'
  ) THEN
    DROP POLICY "Users can view their own deletion requests" ON public.account_deletion_requests;
  END IF;
END $$;

-- RLS Policy: Users can only view requests linked to their own auth ID
CREATE POLICY "Users can view their own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);
