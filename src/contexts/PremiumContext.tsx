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

export interface PremiumContextType {
  entitlement: Entitlement | null;
  isPremium: boolean;
  isReadOnly: boolean;
  isTrial: boolean;
  trialEndsAt?: string;
  aiTokens: number;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
  refreshAITokens: () => Promise<void>;
  isPaywallOpen: boolean;
  paywallFeatureName: string;
  showPaywall: (featureName: string) => void;
  hidePaywall: () => void;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

async function fetchEntitlement(userId: string): Promise<Entitlement> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_entitlement', { p_user_id: userId })
      .single();

    if (error || !data) {
      return {
        status: 'active',
        hasFullAccess: true,
        canModify: true,
        isTrial: false,
        isActive: true,
        isPaymentFailed: false,
        isExpired: false,
        previewOnly: false,
      };
    }

    const d = data as any;
    // Also fetch timestamps from the table (optional)
    const { data: row } = await supabase
      .from('user_entitlements')
      .select('payment_failed_at, payment_grace_ends_at, subscription_ends_at, trial_ends_at')
      .eq('user_id', userId)
      .single();

    return {
      status: d.status || 'active',
      hasFullAccess: d.has_full_access ?? true,
      canModify: d.can_modify_data ?? true,
      isTrial: d.is_trial ?? false,
      isActive: d.is_active ?? true,
      isPaymentFailed: d.is_payment_failed ?? false,
      isExpired: d.is_expired ?? false,
      previewOnly: d.preview_only ?? false,
      paymentFailedAt: row?.payment_failed_at,
      paymentGraceEndsAt: row?.payment_grace_ends_at,
      subscriptionEndsAt: row?.subscription_ends_at,
      trialEndsAt: row?.trial_ends_at,
    };
  } catch (e) {
    return {
      status: 'active',
      hasFullAccess: true,
      canModify: true,
      isTrial: false,
      isActive: true,
      isPaymentFailed: false,
      isExpired: false,
      previewOnly: false,
    };
  }
}

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [aiTokens, setAiTokens] = useState<number>(50);
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

  const refreshPremiumStatus = refresh;

  const refreshAITokens = useCallback(async () => {
    setAiTokens(50);
  }, []);

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

  const isPremium = entitlement ? entitlement.hasFullAccess : true;
  const isReadOnly = entitlement ? entitlement.previewOnly : false;
  const isTrial = entitlement ? entitlement.isTrial : false;
  const trialEndsAt = entitlement?.trialEndsAt;

  return (
    <PremiumContext.Provider value={{ 
      entitlement, 
      isPremium, 
      isReadOnly, 
      isTrial, 
      trialEndsAt, 
      aiTokens, 
      loading, 
      refresh, 
      refreshPremiumStatus, 
      refreshAITokens, 
      isPaywallOpen, 
      paywallFeatureName, 
      showPaywall, 
      hidePaywall 
    }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (context === undefined) throw new Error('usePremium must be used within a PremiumProvider');
  return context;
};