export type BillingProvider = 'paystack' | 'lemonsqueezy';

export const FREE_TRIAL_DAYS = 30;
export const FREE_TRIAL_MESSAGE = 'You get 30 days of full premium access free. Billing starts automatically after the trial ends.';

const isNigeriaCountry = (country?: string | null) => {
  if (!country) return false;
  const normalized = country.toUpperCase();
  return normalized === 'NG' || normalized === 'NGA' || normalized === 'NIGERIA';
};

export async function detectBillingProvider(fallbackCountry?: string | null): Promise<BillingProvider> {
  if (fallbackCountry && isNigeriaCountry(fallbackCountry)) {
    return 'paystack';
  }

  if (typeof window === 'undefined') {
    return 'lemonsqueezy';
  }

  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      const countryCode = data.country_code || data.country;
      return isNigeriaCountry(countryCode) ? 'paystack' : 'lemonsqueezy';
    }
  } catch (error) {
    console.warn('Billing provider detection failed, defaulting to Lemon Squeezy.', error);
  }

  return 'lemonsqueezy';
}

export function getProviderLabel(provider: BillingProvider) {
  return provider === 'paystack' ? 'Paystack' : 'Lemon Squeezy';
}

export function isTrialActive(profile: any) {
  if (!profile?.trial_started_at || !profile?.trial_ends_at) {
    return false;
  }

  const trialEnd = new Date(profile.trial_ends_at).getTime();
  return Number.isFinite(trialEnd) && trialEnd > Date.now();
}

export function canAccessPremium(profile: any, bridgeStatus = false) {
  const fromTrial = isTrialActive(profile);
  const isPremium = Boolean(profile?.is_premium);
  const hasActiveSubscription = profile?.subscription_status === 'active' || profile?.subscription_status === 'trial';
  return Boolean(bridgeStatus || isPremium || fromTrial || hasActiveSubscription);
}
