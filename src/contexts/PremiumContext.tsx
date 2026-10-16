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

const unavailableEntitlement: Entitlement = {
  status: 'unavailable',
  hasFullAccess: false,
  canModify: false,
  isTrial: false,
  isActive: false,
  isPaymentFailed: false,
  isExpired: false,
  previewOnly: true,
};

async function fetchEntitlement(userId: string): Promise<Entitlement> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_entitlement', { p_user_id: userId })
      .single();

    if (error) {
      console.error('Server entitlement check failed; access is restricted:', error);
      return unavailableEntitlement;
    }

    if (!data) {
      console.error('Server entitlement check returned no result; access is restricted.');
      return unavailableEntitlement;
    }

    const d = data as any;
    return {
      status: d.status ?? 'inactive',
      hasFullAccess: d.has_full_access === true,
      canModify: d.can_modify_data === true,
      isTrial: d.is_trial === true,
      isActive: d.is_active === true,
      isPaymentFailed: d.is_payment_failed === true,
      isExpired: d.is_expired === true,
      previewOnly: d.preview_only === true,
      paymentFailedAt: d.payment_failed_at ?? undefined,
      paymentGraceEndsAt: d.payment_grace_ends_at ?? undefined,
      subscriptionEndsAt: d.subscription_ends_at ?? undefined,
      trialEndsAt: d.trial_ends_at ?? undefined,
    };
  } catch (error) {
    console.error('Server entitlement check failed; access is restricted:', error);
    return unavailableEntitlement;
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

  const isPremium = entitlement?.hasFullAccess === true;
  const isReadOnly = entitlement?.previewOnly ?? Boolean(user);
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