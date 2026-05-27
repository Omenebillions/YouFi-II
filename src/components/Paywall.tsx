import React, { useState, useEffect } from 'react';
import { Sparkles, Check, ShieldAlert, CreditCard, X, Loader2, RefreshCw } from 'lucide-react';
import { useNativeBridge } from '../hooks/useNativeBridge';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/currency';
import { revenueCat } from '../services/revenueCat';

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  onSuccess?: () => void;
}

export default function Paywall({ isOpen, onClose, featureName = "Premium Services", onSuccess }: PaywallProps) {
  const { isNative, bridge, refreshPremiumStatus } = useNativeBridge();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'business'>('yearly');
  
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (isOpen && currencyCode !== 'USD') {
      fetch('https://open.er-api.com/v6/latest/USD')
        .then(res => res.json())
        .then(data => {
          if (data && data.rates && data.rates[currencyCode]) {
            setExchangeRate(data.rates[currencyCode]);
          }
        })
        .catch(err => console.error("Error fetching exchange rate:", err));
    }
  }, [isOpen, currencyCode]);

  if (!isOpen) return null;

  const getPrice = (usdPrice: number) => {
    return formatCurrency(usdPrice * exchangeRate, currencyCode);
  };

  const planIds = {
    monthly: 'premium_monthly',
    yearly: 'premium_yearly',
    business: 'premium_business'
  };

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      let success = false;
      if (isNative && bridge?.purchasePremium) {
        success = await bridge.purchasePremium(selectedPlan);
      } else {
        const productIdentifier = planIds[selectedPlan];
        success = await revenueCat.purchaseProduct(productIdentifier);
      }

      if (success) {
        await refreshPremiumStatus();
        setSuccessMsg("Success! Premium has been activated on your channel.");
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError("Payment process was cancelled or failed to verify.");
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setError(err?.message || "An unexpected billing error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (isNative && bridge?.getPremiumStatus) {
        const hasPremium = await bridge.getPremiumStatus();
        if (hasPremium) {
          await refreshPremiumStatus();
          setSuccessMsg("Restored! Your active subscription was successfully found.");
          if (onSuccess) onSuccess();
        } else {
          setError("No pre-existing native purchases were found for this account.");
        }
      } else {
        const hasEntitlement = await revenueCat.checkProEntitlement();
        if (hasEntitlement) {
          localStorage.setItem('youfi_premium', 'true');
          await refreshPremiumStatus();
          setSuccessMsg("Restored! Your active web premium entitlements were successfully verified.");
          if (onSuccess) onSuccess();
        } else {
          setError("No pre-existing premium credentials found in RevenueCat.");
        }
      }
    } catch (err: any) {
      setError("An error occurred while restoring purchases.");
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-gray-100 flex flex-col relative animate-in fade-in zoom-in-95 duration-200 hide-scrollbar"
        id="paywall-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors z-[160]"
          disabled={loading || restoreLoading}
          id="close-paywall-btn"
        >
          <X size={16} />
        </button>

        <div className="bg-gradient-to-br from-brand-600 to-indigo-900 p-8 text-white text-center flex flex-col items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent)] pointer-events-none" />
          <div className="w-14 h-14 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3 border border-white/10 shadow-inner">
            <Sparkles size={28} className="text-amber-300 fill-amber-300 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Experience YouFI Premium</h2>
          <p className="text-xs text-brand-100/90 mt-1.5 leading-relaxed max-w-xs">
            Unlock {featureName} plus native mobile widgets, scans, and absolute sync.
          </p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-2xl flex gap-2.5 items-center text-xs font-medium">
              <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-2xl flex gap-2.5 items-center text-xs font-bold animate-pulse">
              <Check size={16} className="text-emerald-500 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-3">Core Elite Benefits</p>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-3 text-xs text-gray-700">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mt-0.5 flex-shrink-0">
                <Check size={11} className="stroke-[3]" />
              </div>
              <div>
                <span className="font-bold text-gray-900">Native Push-To-Calendar Core</span>
                <p className="text-[10px] text-gray-500">Sync all payment occurrences onto Google Calendar or iOS Planner.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-xs text-gray-700">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mt-0.5 flex-shrink-0">
                <Check size={11} className="stroke-[3]" />
              </div>
              <div>
                <span className="font-bold text-gray-900">Smart Camera OCR Scanner</span>
                <p className="text-[10px] text-gray-500">Scan physical receipts; the AI parser converts image rows into logged items.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-xs text-gray-700">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mt-0.5 flex-shrink-0">
                <Check size={11} className="stroke-[3]" />
              </div>
              <div>
                <span className="font-bold text-gray-900">Priority Unlimited Engines</span>
                <p className="text-[10px] text-gray-500">Remove transaction caps, access business analytics dashboards, and add unlimited assets.</p>
              </div>
            </li>
          </ul>

          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Select Subscription Tier</p>
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <button
              onClick={() => setSelectedPlan('monthly')}
              disabled={loading || restoreLoading}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-brand-500 bg-brand-50/20 shadow-sm ring-1 ring-brand-500'
                  : 'border-gray-100 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Monthly</span>
              <span className="block text-sm font-black text-gray-950 mt-1.5">{getPrice(4.99)}</span>
            </button>
            <button
              onClick={() => setSelectedPlan('yearly')}
              disabled={loading || restoreLoading}
              className={`p-3.5 rounded-2xl border text-center relative transition-all ${
                selectedPlan === 'yearly'
                  ? 'border-brand-500 bg-brand-50/20 shadow-sm ring-1 ring-brand-500'
                  : 'border-gray-100 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest leading-none">Best Val</span>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Yearly</span>
              <span className="block text-sm font-black text-gray-950 mt-1.5">{getPrice(39.99)}</span>
            </button>
            <button
              onClick={() => setSelectedPlan('business')}
              disabled={loading || restoreLoading}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                selectedPlan === 'business'
                  ? 'border-brand-500 bg-brand-50/20 shadow-sm ring-1 ring-brand-500'
                  : 'border-gray-100 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Corporate</span>
              <span className="block text-sm font-black text-gray-950 mt-1.5">{getPrice(99.99)}</span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleUpgrade}
              disabled={loading || restoreLoading}
              className="w-full bg-gray-900 text-white rounded-2xl py-3.5 font-bold text-sm shadow-xl shadow-gray-900/10 hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              id="finalize-paywall-upgrade"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing payment...
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  Activate {selectedPlan === 'monthly' ? 'Monthly' : selectedPlan === 'yearly' ? 'Yearly' : 'Business'} Premium
                </>
              )}
            </button>

            <button
              onClick={handleRestore}
              disabled={loading || restoreLoading}
              className="w-full bg-white text-gray-500 border border-gray-100 rounded-2xl py-3 font-semibold text-xs hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
              id="restore-purchases-btn"
            >
              {restoreLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Restoring credentials...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  Restore Purchases
                </>
              )}
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-400 font-medium font-sans">
              Transactions securely handled by YouFI billing wrapper. Secure HTTPS.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
