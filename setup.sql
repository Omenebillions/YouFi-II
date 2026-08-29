-- Supabase Setup Script for YouFi & SME Manager
-- Run this in the SQL Editor of your Supabase Dashboard

-- 1. Create Users (Profiles) table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  name TEXT,
  currency TEXT DEFAULT 'USD',
  income DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own data" 
  ON public.users FOR ALL 
  USING (auth.uid() = id);


CREATE OR REPLACE FUNCTION public.has_full_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_sub_status TEXT;
  v_sub_expires TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check user creation date for 30-day trial
  SELECT created_at INTO v_created_at FROM public.users WHERE id = user_uuid;
  IF v_created_at IS NOT NULL AND v_created_at + INTERVAL '30 days' > now() THEN
    RETURN TRUE;
  END IF;

  -- Check active subscription
  SELECT status, expires_at INTO v_sub_status, v_sub_expires 
  FROM public.user_subscriptions 
  WHERE user_id = user_uuid;

  IF v_sub_status = 'active' AND v_sub_expires > now() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  note TEXT,
  type TEXT CHECK (type IN ('income', 'expense', 'debt')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" 
   ON public.transactions FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
   ON public.transactions FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own transactions" 
   ON public.transactions FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own transactions" 
   ON public.transactions FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 3. Create Budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  period TEXT DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budgets" 
   ON public.budgets FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" 
   ON public.budgets FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own budgets" 
   ON public.budgets FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own budgets" 
   ON public.budgets FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 4. Create Savings Goals table
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  target_amount DECIMAL NOT NULL,
  saved_amount DECIMAL DEFAULT 0,
  deadline DATE,
  emoji TEXT DEFAULT '🎯',
  frequency TEXT DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own savings_goals" 
   ON public.savings_goals FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings_goals" 
   ON public.savings_goals FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own savings_goals" 
   ON public.savings_goals FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own savings_goals" 
   ON public.savings_goals FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 5. Create Financial Plans table
CREATE TABLE IF NOT EXISTS public.financial_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'proposed',
  progress DECIMAL DEFAULT 0,
  tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  plan_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own financial_plans" 
   ON public.financial_plans FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own financial_plans" 
   ON public.financial_plans FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own financial_plans" 
   ON public.financial_plans FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own financial_plans" 
   ON public.financial_plans FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 6. Create Trash table
CREATE TABLE IF NOT EXISTS public.trash (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  table_name TEXT NOT NULL,
  original_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trash" 
   ON public.trash FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trash" 
   ON public.trash FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own trash" 
   ON public.trash FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own trash" 
   ON public.trash FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 7. Create Businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  balance DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own businesses" 
   ON public.businesses FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own businesses" 
   ON public.businesses FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own businesses" 
   ON public.businesses FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own businesses" 
   ON public.businesses FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 8. Create Business Transactions table
CREATE TABLE IF NOT EXISTS public.business_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  amount DECIMAL NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.business_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business_transactions" 
   ON public.business_transactions FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business_transactions" 
   ON public.business_transactions FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own business_transactions" 
   ON public.business_transactions FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own business_transactions" 
   ON public.business_transactions FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 9. Create Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL NOT NULL,
  cost_price DECIMAL DEFAULT 0,
  selling_price DECIMAL,
  stock INTEGER DEFAULT 0,
  is_service BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own products" 
   ON public.products FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products" 
   ON public.products FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own products" 
   ON public.products FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own products" 
   ON public.products FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 10. Create Sales record table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL NOT NULL,
  total_price DECIMAL NOT NULL,
  profit DECIMAL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sales" 
   ON public.sales FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales" 
   ON public.sales FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own sales" 
   ON public.sales FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own sales" 
   ON public.sales FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 11. Create Business Debts table
CREATE TABLE IF NOT EXISTS public.business_debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  lender TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.business_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business_debts" 
   ON public.business_debts FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business_debts" 
   ON public.business_debts FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own business_debts" 
   ON public.business_debts FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own business_debts" 
   ON public.business_debts FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 12. Create Business Ideas table
CREATE TABLE IF NOT EXISTS public.business_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  plan JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.business_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business_ideas" 
   ON public.business_ideas FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business_ideas" 
   ON public.business_ideas FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own business_ideas" 
   ON public.business_ideas FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own business_ideas" 
   ON public.business_ideas FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 13. Create Upcoming Payments table
CREATE TABLE IF NOT EXISTS public.upcoming_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  due_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  frequency TEXT,
  status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.upcoming_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own upcoming_payments" 
   ON public.upcoming_payments FOR SELECT 
   USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own upcoming_payments" 
   ON public.upcoming_payments FOR INSERT 
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can update their own upcoming_payments" 
   ON public.upcoming_payments FOR UPDATE 
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id AND public.has_full_access(auth.uid()));

CREATE POLICY "Users can delete their own upcoming_payments" 
   ON public.upcoming_payments FOR DELETE 
   USING (auth.uid() = user_id AND public.has_full_access(auth.uid()));

-- 14. Create User Subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'inactive',
  plan_id TEXT,
  platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
  purchase_token TEXT,
  original_transaction_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscription" 
   ON public.user_subscriptions FOR SELECT 
   USING (auth.uid() = user_id);

-- 15. Create Subscription Transactions log
CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  transaction_id TEXT,
  amount DECIMAL,
  currency TEXT,
  status TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscription transactions" 
   ON public.subscription_transactions FOR SELECT 
   USING (auth.uid() = user_id);

-- 16. Create Account Deletion Requests table
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
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own deletion requests"
   ON public.account_deletion_requests FOR SELECT
   USING (auth.uid() = user_id);
