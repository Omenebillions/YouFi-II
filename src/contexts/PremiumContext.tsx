import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

export interface Entitlement {
  status: string;
  hasFullAccess: boolean;
  canModify: boolean;
  isTrial: boolean;
  isActive: boolean;
  isPaymentFailed: boolean;
  isExpired: boolean;
  previewOnly: boolean;
  paymentFailedAt?: string;
  paymentGraceEndsAt?: string;
  subscriptionEndsAt?: string;
  trialEndsAt?: string;
}

interface PremiumContextType {
  entitlement: Entitlement | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isPaywallOpen: boolean;
  paywallFeatureName: string;
  showPaywall: (featureName: string) => void;
  hidePaywall: () => void;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

async function fetchEntitlement(userId: string): Promise<Entitlement> {
  const { data, error } = await supabase
    .rpc('get_user_entitlement', { p_user_id: userId })
    .single();

  if (error || !data) {
    return {
      status: 'expired',
      hasFullAccess: false,
      canModify: false,
      isTrial: false,
      isActive: false,
      isPaymentFailed: false,
      isExpired: true,
      previewOnly: true,
    };
  }

  // Also fetch timestamps from the table (optional)
  const { data: row } = await supabase
    .from('user_entitlements')
    .select('payment_failed_at, payment_grace_ends_at, subscription_ends_at, trial_ends_at')
    .eq('user_id', userId)
    .single();

  return {
    status: data.status,
    hasFullAccess: data.has_full_access,
    canModify: data.can_modify_data,
    isTrial: data.is_trial,
    isActive: data.is_active,
    isPaymentFailed: data.is_payment_failed,
    isExpired: data.is_expired,
    previewOnly: data.preview_only,
    paymentFailedAt: row?.payment_failed_at,
    paymentGraceEndsAt: row?.payment_grace_ends_at,
    subscriptionEndsAt: row?.subscription_ends_at,
    trialEndsAt: row?.trial_ends_at,
  };
}

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallFeatureName, setPaywallFeatureName] = useState('Premium Services');

  const showPaywall = (featureName: string) => {
    setPaywallFeatureName(featureName);
    setIsPaywallOpen(true);
  };
  const hidePaywall = () => setIsPaywallOpen(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setEntitlement(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ent = await fetchEntitlement(user.id);
      setEntitlement(ent);
    } catch (err) {
      console.error('Failed to fetch entitlement:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for native events (purchase completion, etc.)
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.type === 'premiumStatusChanged') {
        refresh();
      }
    };
    window.addEventListener('nativeEvent', handler);
    return () => window.removeEventListener('nativeEvent', handler);
  }, [refresh]);

  return (
    <PremiumContext.Provider value={{ entitlement, loading, refresh, isPaywallOpen, paywallFeatureName, showPaywall, hidePaywall }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (context === undefined) throw new Error('usePremium must be used within a PremiumProvider');
  return context;
};