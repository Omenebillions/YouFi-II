/**
 * Paystack Payment Service
 * Full integration for accepting payments via Paystack
 * Supports subscription-based premium tiers
 */

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
const PAYSTACK_API_URL = 'https://api.paystack.co';

export interface PaystackPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: 'monthly' | 'quarterly' | 'biannually' | 'annually';
  description: string;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    status: 'success' | 'failed' | 'pending';
    paid_at: string;
    customer: {
      id: number;
      email: string;
      name: string;
    };
    metadata: {
      userId: string;
      planType: string;
    };
  };
}

class PaystackService {
  private publicKey: string;
  private plans: Map<string, PaystackPlan> = new Map();

  constructor() {
    this.publicKey = PAYSTACK_PUBLIC_KEY;
    this.initializePlans();
  }

  private initializePlans() {
    // Paystack plan amounts are in kobo (smallest unit), so multiply naira by 100
    // Using NGN as default, but can be configured per user
    this.plans.set('monthly', {
      id: 'PLN_monthly_premium',
      name: 'Premium Monthly',
      amount: 499900, // ₦4,999 in kobo
      currency: 'NGN',
      interval: 'monthly',
      description: 'Full access to premium features'
    });

    this.plans.set('yearly', {
      id: 'PLN_yearly_premium',
      name: 'Premium Yearly',
      amount: 4999900, // ₦49,999 in kobo (discounted)
      currency: 'NGN',
      interval: 'annually',
      description: 'Full year of premium features with savings'
    });

    this.plans.set('business', {
      id: 'PLN_business_tier',
      name: 'Business Tier',
      amount: 9999900, // ₦99,999 in kobo
      currency: 'NGN',
      interval: 'monthly',
      description: 'Unlimited features for businesses'
    });
  }

  /**
   * Get all available plans
   */
  getPlans(): PaystackPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Get a specific plan
   */
  getPlan(planKey: string): PaystackPlan | null {
    return this.plans.get(planKey) || null;
  }

  /**
   * Initialize a payment on the client side
   * Returns the authorization URL and transaction reference for integration
   */
  async initializePayment(
    email: string,
    amount: number, // amount in smallest currency unit (kobo for NGN)
    userId: string,
    planType: 'monthly' | 'yearly' | 'business',
    metadata?: Record<string, any>
  ): Promise<PaystackInitializeResponse> {
    if (!this.publicKey) {
      throw new Error('Paystack public key is not configured. Add VITE_PAYSTACK_PUBLIC_KEY to your environment variables.');
    }

    // Server-side initialization will return the data, but for client-side we prepare the parameters
    const reference = `TXN_${userId}_${Date.now()}`;

    // This structure is for server-side verification
    return {
      status: true,
      message: 'Use the server endpoint to initialize payment',
      data: {
        authorization_url: `${PAYSTACK_API_URL}/transaction/initialize`,
        access_code: '',
        reference
      }
    };
  }

  /**
   * Create a subscription (recurring charge)
   * Requires server-side implementation with API secret key
   */
  async createSubscription(
    authorizationCode: string,
    email: string,
    planType: 'monthly' | 'yearly' | 'business',
    userId: string
  ): Promise<{ status: boolean; subscriptionCode?: string; message: string }> {
    // This should be called from the backend
    // Frontend can request the backend to set up the subscription
    return {
      status: false,
      message: 'Subscription setup must be done via backend API'
    };
  }

  /**
   * Verify a payment transaction
   * Should be called from the backend for security
   */
  async verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    // This is for reference - actual verification happens on backend
    throw new Error('Use the /api/paystack/verify endpoint on the backend');
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currency: string = 'NGN'): string {
    const currencySymbols: Record<string, string> = {
      NGN: '₦',
      USD: '$',
      GBP: '£',
      EUR: '€'
    };
    const symbol = currencySymbols[currency] || currency;
    const formatted = (amount / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${symbol}${formatted}`;
  }

  /**
   * Open Paystack checkout inline
   * Requires PaystackPop to be loaded from script tag
   */
  openCheckout(options: {
    email: string;
    amount: number;
    reference: string;
    publicKey: string;
    currency?: string;
    onSuccess?: () => void;
    onClose?: () => void;
  }) {
    // This requires the Paystack JS library loaded in index.html
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PaystackPop = (window as any).PaystackPop;
    
    if (!PaystackPop) {
      console.error('Paystack library not loaded. Add it to index.html');
      throw new Error('Paystack library not loaded');
    }

    const handler = PaystackPop.setup({
      key: options.publicKey,
      email: options.email,
      amount: options.amount,
      currency: options.currency || 'NGN',
      ref: options.reference,
      onClose: () => {
        console.log('Window closed.');
        options.onClose?.();
      },
      onSuccess: (response: any) => {
        console.log('Payment successful:', response);
        options.onSuccess?.();
      }
    });

    handler.openIframe();
  }

  /**
   * Get payment history for a user (requires backend call)
   */
  async getUserPaymentHistory(userId: string): Promise<any[]> {
    const response = await fetch(`/api/paystack/history?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch payment history');
    }

    const data = await response.json();
    return data.transactions || [];
  }

  /**
   * Check if a transaction was successful
   */
  async checkTransactionStatus(reference: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/paystack/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === 'success' || data.data?.status === 'success';
    } catch (error) {
      console.error('Error checking transaction status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const paystackService = new PaystackService();
export default paystackService;
