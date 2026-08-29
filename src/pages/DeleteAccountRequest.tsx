import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Trash2, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Mail, KeyRound, Loader2, Info, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clearLocalUserData } from '../services/db';
import { supabase } from '../services/supabase';

interface VerifiedTokenData {
  valid: boolean;
  email: string;
  maskedEmail: string;
  expiresAt: string;
  createdAt: string;
  hasLinkedUser: boolean;
}

export default function DeleteAccountRequest() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode: 'request' | 'verify' | 'success'
  const [mode, setMode] = useState<'request' | 'verify' | 'success'>('request');
  
  // Step 1: Request Deletion Form state
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestResponseMsg, setRequestResponseMsg] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Step 2: Verification state
  const [tokenInput, setTokenInput] = useState(searchParams.get('token') || '');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [verifiedData, setVerifiedData] = useState<VerifiedTokenData | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Confirmation state
  const [confirmInput, setConfirmInput] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Auto-verify if token is in URL query parameters
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken && urlToken.trim()) {
      setTokenInput(urlToken.trim());
      setMode('verify');
      handleVerifyToken(urlToken.trim());
    }
  }, [searchParams]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmittingRequest(true);
    setRequestResponseMsg('');
    setGeneratedToken(null);

    try {
      const response = await fetch('/api/account/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit account deletion request.');
      }

      setRequestSubmitted(true);
      setRequestResponseMsg(data.message || 'If an account is associated with this email address, a secure verification link has been generated.');
      if (data.token) {
        setGeneratedToken(data.token);
      }
    } catch (err: any) {
      setRequestResponseMsg(err.message || 'An error occurred. Please check your email format and try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleVerifyToken = async (tokenToVerify?: string) => {
    const activeToken = (tokenToVerify || tokenInput).trim();
    if (!activeToken) {
      setVerifyError('Please enter a valid verification token.');
      return;
    }

    setIsVerifyingToken(true);
    setVerifyError(null);
    setConfirmError(null);

    try {
      const response = await fetch('/api/account/deletion-request/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken })
      });

      const data = await response.json();
      if (!response.ok || !data.valid) {
        throw new Error(data.error || 'Invalid or expired verification token.');
      }

      setVerifiedData(data);
      setTokenInput(activeToken);
      setSearchParams({ token: activeToken });
      setMode('verify');
    } catch (err: any) {
      setVerifiedData(null);
      setVerifyError(err.message || 'Invalid or expired verification token.');
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleConfirmPermanentDeletion = async () => {
    const activeToken = tokenInput.trim();
    if (!activeToken) return;

    setIsConfirmingDelete(true);
    setConfirmError(null);

    try {
      const response = await fetch('/api/account/deletion-request/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete permanent deletion.');
      }

      // Clear local browser storage and sign out if user happens to be logged in on this browser
      await clearLocalUserData();
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore client signout errors
      }

      setMode('success');
    } catch (err: any) {
      setConfirmError(err.message || 'An error occurred during account deletion. Please try again.');
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex flex-col justify-between text-gray-900 px-4 py-8">
      {/* Top Header */}
      <div className="max-w-2xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 p-1.5 flex items-center justify-center shadow-xs">
              <img 
                src="/logo.jpeg" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} 
                alt="YouFi Logo" 
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-gray-900 block group-hover:text-brand-600 transition-colors">YouFi</span>
              <span className="text-[11px] font-semibold text-gray-400 block -mt-0.5">Account Deletion & Data Privacy</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100/80 px-2.5 py-1 rounded-full border border-gray-200">
              <Lock size={12} className="text-gray-600" />
              <span>TLS 1.3 Verified</span>
            </span>
            <Link 
              to="/login"
              className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors shadow-2xs"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200 relative overflow-hidden">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-amber-500 to-brand-500" />

          {/* Mode: Success View */}
          {mode === 'success' ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-6 space-y-5"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-black text-gray-900">Account Successfully Deleted</h1>
                <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                  Your YouFi account, personal data, business registries, transactions, budgets, and authentication credentials have been permanently removed from our databases.
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-xs text-gray-600 max-w-md mx-auto text-left space-y-1.5">
                <p className="font-bold text-gray-800 flex items-center gap-1.5">
                  <Info size={14} className="text-brand-600" />
                  <span>Summary of Actions Completed:</span>
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-gray-500">
                  <li>Personal transactions and budget records purged</li>
                  <li>SME business profiles, products, sales & debts wiped</li>
                  <li>Active subscriptions and authentication credentials deleted</li>
                  <li>Local cache and offline IndexedDB records cleared</li>
                </ul>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Link
                  to="/login"
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs shadow-sm transition-all text-center"
                >
                  Return to Sign In
                </Link>
                <Link
                  to="/privacy"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-6 rounded-2xl text-xs transition-all text-center"
                >
                  View Privacy Policy
                </Link>
              </div>
            </motion.div>
          ) : (
            <div>
              {/* Navigation Tabs between Request and Verify */}
              <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setMode('request')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    mode === 'request'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Mail size={14} />
                  <span>1. Request Deletion</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('verify')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    mode === 'verify'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <KeyRound size={14} />
                  <span>2. Verify & Confirm</span>
                </button>
              </div>

              {/* Mode: Step 1 - Request Deletion Form */}
              {mode === 'request' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      <Trash2 size={22} className="text-red-500" />
                      <span>Request Permanent Account Deletion</span>
                    </h1>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      In compliance with GDPR, CCPA, and app store account deletion requirements, you can request full permanent removal of your YouFi account and all associated data at any time.
                    </p>
                  </div>

                  {requestSubmitted ? (
                    <div className="space-y-5">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-emerald-900">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>Deletion Request Submitted</span>
                        </div>
                        <p className="text-[12px] text-emerald-800 leading-relaxed font-medium">
                          {requestResponseMsg}
                        </p>
                      </div>

                      {generatedToken && (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                            <KeyRound size={14} className="text-amber-600" />
                            <span>Your Verification Token:</span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-amber-200 font-mono text-xs text-gray-800 break-all select-all font-semibold">
                            {generatedToken}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTokenInput(generatedToken);
                              handleVerifyToken(generatedToken);
                            }}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <span>Proceed to Verification & Confirmation</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      )}

                      <div className="pt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setRequestSubmitted(false);
                            setEmail('');
                          }}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl text-xs transition-colors"
                        >
                          Submit Another Request
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('verify')}
                          className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors"
                        >
                          Enter Verification Token
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          Account Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                          Reason for leaving (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Help us improve YouFi (optional feedback)..."
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none"
                        />
                      </div>

                      {/* Policy Information Box */}
                      <div className="bg-red-50/70 border border-red-100 rounded-2xl p-4 text-xs text-red-900 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5 text-red-950">
                          <AlertTriangle size={14} className="text-red-600 shrink-0" />
                          <span>What happens after submitting:</span>
                        </p>
                        <p className="text-[11px] text-red-800 leading-relaxed font-normal">
                          A 24-hour verification token will be created. Once verified and confirmed by you, all personal ledgers, SME sales data, invoices, and credentials are permanently purged with zero recovery possibility.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingRequest || !email.trim()}
                        className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] disabled:bg-red-300 disabled:cursor-not-allowed text-white font-extrabold py-3.5 px-4 rounded-xl text-xs shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmittingRequest ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Processing Request...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={16} />
                            <span>Send Deletion Verification Request</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}

              {/* Mode: Step 2 - Verify & Confirm Deletion */}
              {mode === 'verify' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      <KeyRound size={22} className="text-amber-500" />
                      <span>Verify & Confirm Account Deletion</span>
                    </h1>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Enter your verification token to authenticate your request before permanently deleting your account data.
                    </p>
                  </div>

                  {/* Token Verification Form */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-700">
                      Verification Token
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste verification token here"
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-semibold text-gray-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyToken()}
                        disabled={isVerifyingToken || !tokenInput.trim()}
                        className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-extrabold px-5 py-3 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {isVerifyingToken ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <span>Verify</span>
                        )}
                      </button>
                    </div>

                    {verifyError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0 text-red-600" />
                        <span>{verifyError}</span>
                      </div>
                    )}
                  </div>

                  {/* Verified Token Details & Permanent Deletion Confirmation */}
                  {verifiedData && (
                    <div className="space-y-5 pt-4 border-t border-gray-100">
                      {/* Verified Badge */}
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-amber-600" />
                            <span>Verification Token Valid</span>
                          </span>
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                            Pending Confirmation
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 text-gray-700">
                          <div>
                            <span className="text-gray-400 font-semibold block">Target Account:</span>
                            <span className="font-bold text-gray-900">{verifiedData.maskedEmail}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-semibold block">Expires At:</span>
                            <span className="font-bold text-gray-900">
                              {new Date(verifiedData.expiresAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Explicit Warning */}
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-950 space-y-2">
                        <p className="font-black text-red-900 text-sm flex items-center gap-1.5">
                          <ShieldAlert size={16} className="text-red-600" />
                          <span>Permanent Deletion Warning</span>
                        </p>
                        <p className="text-[11px] text-red-800 leading-relaxed font-medium">
                          Confirming this action will immediately and irreversibly delete:
                        </p>
                        <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-red-900 font-medium">
                          <li>Personal income, expense, and budget history</li>
                          <li>All SME businesses, sales logs, inventory & debt balances</li>
                          <li>AI financial coach history, goals, and upcoming bill reminders</li>
                          <li>Active subscriptions & authentication credentials</li>
                        </ul>
                      </div>

                      {/* Confirmation Input */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-800">
                          Type <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black">DELETE</span> to confirm permanent erasure:
                        </label>
                        <input
                          type="text"
                          value={confirmInput}
                          onChange={(e) => setConfirmInput(e.target.value)}
                          placeholder="Type DELETE"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all"
                        />
                      </div>

                      {confirmError && (
                        <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                          <AlertTriangle size={14} className="shrink-0 text-red-600" />
                          <span>{confirmError}</span>
                        </div>
                      )}

                      {/* Final Confirm Button */}
                      <button
                        type="button"
                        disabled={isConfirmingDelete || confirmInput.trim().toUpperCase() !== 'DELETE'}
                        onClick={handleConfirmPermanentDeletion}
                        className="w-full bg-red-600 hover:bg-red-700 active:scale-95 disabled:bg-red-300 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-extrabold py-4 px-4 rounded-xl text-xs shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isConfirmingDelete ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Purging All Account Data...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={16} />
                            <span>Permanently Delete Account Now</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation & Legal Links */}
      <div className="max-w-2xl mx-auto w-full pt-8 text-center space-y-2">
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-gray-500">
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link to="/settings" className="hover:text-gray-900 transition-colors">In-App Settings</Link>
        </div>
        <p className="text-[11px] text-gray-400">
          © {new Date().getFullYear()} YouFi Finance. All personal and financial rights reserved.
        </p>
      </div>
    </div>
  );
}
