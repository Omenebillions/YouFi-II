import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, DollarSign, Save, Trash2, Store, Briefcase, Smartphone, Download, CheckCircle2, Share, PlusSquare, Monitor, AlertTriangle, ShieldAlert, X, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { CURRENCIES } from '../lib/currency';
import { parseBusinessName } from '../lib/business';
import { usePWA } from '../hooks/usePWA';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const { userProfile, user, logout, deleteAccount, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { isInstalled, isTWA, deviceType, platform, browser, canInstallPrompt, promptInstall } = usePWA();
  const [income, setIncome] = useState(userProfile?.income?.toString() || '0');
  const [currency, setCurrency] = useState(userProfile?.currency || 'USD');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Business Profiles State
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string>('');
  const [bizSettings, setBizSettings] = useState({
    address: '',
    phone: '',
    email: '',
    logo: '🏢',
    paymentInstructions: ''
  });
  const [bizSaved, setBizSaved] = useState(false);

  // Delete Account State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch businesses
  useEffect(() => {
    async function loadBusinesses() {
      if (!user) return;
      try {
        const { data, error } = await supabase.from('businesses').select('*').eq('user_id', user.id);
        if (data && data.length > 0) {
          const parsed = data.map(b => {
            const meta = parseBusinessName(b.name);
            return { ...b, name: meta.name, category: meta.category };
          });
          setBusinesses(parsed);
          setSelectedBizId(parsed[0].id);
        }
      } catch (err) {
        console.error("Error loading businesses in settings page:", err);
      }
    }
    loadBusinesses();
  }, [user]);

  // Load selected business settings
  useEffect(() => {
    if (!selectedBizId) return;
    const stored = localStorage.getItem(`youfi_biz_settings_${selectedBizId}`);
    if (stored) {
      try {
        setBizSettings(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing business settings in settings:", e);
      }
    } else {
      setBizSettings({
        address: '',
        phone: '',
        email: '',
        logo: '🏢',
        paymentInstructions: ''
      });
    }
  }, [selectedBizId]);

  const handleSaveBizSettings = () => {
    if (!selectedBizId) return;
    localStorage.setItem(`youfi_biz_settings_${selectedBizId}`, JSON.stringify(bizSettings));
    setBizSaved(true);
    setTimeout(() => setBizSaved(false), 3000);
  };

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);
    setSaved(false);
    
    try {
      const { error } = await supabase.from('users').update({
        income: parseFloat(income),
        currency: currency
      }).eq('id', user.id);
      
      if (error) throw error;
      
      await refreshProfile();
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Error updating settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const currentSymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-32">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 px-1 pr-12">Settings</h1>
      
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 mb-6 relative overflow-hidden">
        <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-brand-400 to-brand-600 left-0"></div>
        <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={32} />
            )}
        </div>
        <div>
           <h2 className="text-xl font-bold text-gray-900">{userProfile?.name}</h2>
           <p className="text-sm text-gray-500">{userProfile?.email}</p>
        </div>
      </div>
      
      {/* Financial Setup */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-brand-500" />
            Financial Baseline
        </h3>
        
        <div className="space-y-4">
           <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Global Currency</label>
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
           </div>
           <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Income ({currentSymbol})</label>
              <input 
                type="number" 
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
              />
           </div>
           
           <button 
             onClick={handleUpdate}
             disabled={loading}
             className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
           >
              {loading ? 'Saving...' : (
                <>
                  <Save size={16} /> Save Changes
                </>
              )}
           </button>
           {saved && <p className="text-xs text-center text-success-500 font-medium">Settings updated successfully! Changes may require a refresh.</p>}
        </div>
      </div>
      
      {/* Business Configuration (SMEs) */}
      {businesses.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6 text-gray-800">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Store size={16} className="text-brand-500" />
              SME Business Profiles
          </h3>

          <div className="space-y-4">
             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Select Business</label>
                <select 
                  value={selectedBizId}
                  onChange={(e) => setSelectedBizId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
                >
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.category})</option>
                  ))}
                </select>
             </div>

             {/* Custom Logo Upload / Emoji Input Section */}
             <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col gap-3">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company Logo</span>
               
               <div className="flex gap-4 items-center">
                 {/* Visual Preview */}
                 <div className="w-14 h-14 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                   {bizSettings.logo && (bizSettings.logo.startsWith('data:') || bizSettings.logo.startsWith('http')) ? (
                     <img src={bizSettings.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                   ) : (
                     <span className="text-2xl">{bizSettings.logo || '🏢'}</span>
                   )}
                 </div>
                 
                 <div className="flex-1 flex flex-col gap-1.5">
                   <div className="flex gap-2 items-center">
                     <label className="cursor-pointer py-1.5 px-2.5 bg-white border border-gray-250 rounded-xl text-[10px] font-extrabold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95">
                       <span>Upload Image</span>
                       <input 
                         type="file" 
                         accept="image/*" 
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             if (file.size > 1024 * 1024) {
                               alert("Logo size should be less than 1MB to ensure smooth saving.");
                               return;
                             }
                             const reader = new FileReader();
                             reader.onloadend = () => {
                               setBizSettings({ ...bizSettings, logo: reader.result as string });
                             };
                             reader.readAsDataURL(file);
                           }
                         }}
                         className="hidden" 
                       />
                     </label>
                     
                     {(bizSettings.logo && (bizSettings.logo.startsWith('data:') || bizSettings.logo.startsWith('http'))) ? (
                       <button 
                         type="button"
                         onClick={() => setBizSettings({ ...bizSettings, logo: '🏢' })}
                         className="py-1.5 px-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-bold hover:bg-red-100 transition-colors"
                       >
                         Reset
                       </button>
                     ) : (
                       <div className="flex items-center gap-1">
                         <span className="text-[10px] text-gray-400 font-bold">Emoji:</span>
                         <input 
                           type="text" 
                           maxLength={4}
                           value={bizSettings.logo} 
                           onChange={(e) => setBizSettings({...bizSettings, logo: e.target.value})} 
                           className="w-12 bg-white border border-gray-150 rounded-xl py-0.5 px-1.5 text-center text-xs font-bold text-gray-800 focus:border-brand-500"
                           placeholder="🏢"
                         />
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             </div>

             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact Phone</label>
                <input 
                  type="tel" 
                  value={bizSettings.phone}
                  onChange={(e) => setBizSettings({ ...bizSettings, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
                />
             </div>

             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Contact Email</label>
                <input 
                  type="email" 
                  value={bizSettings.email}
                  onChange={(e) => setBizSettings({ ...bizSettings, email: e.target.value })}
                  placeholder="billing@yourbusiness.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
                />
             </div>

             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Physical Address / Headquarters</label>
                <textarea 
                  rows={2}
                  value={bizSettings.address}
                  onChange={(e) => setBizSettings({ ...bizSettings, address: e.target.value })}
                  placeholder="123 Business Rd, Suite 100, Metropolis"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold resize-none"
                />
             </div>

             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Instructions (Optional)</label>
                <textarea 
                  rows={2}
                  value={bizSettings.paymentInstructions}
                  onChange={(e) => setBizSettings({ ...bizSettings, paymentInstructions: e.target.value })}
                  placeholder="Bank: GTBank, Account: 0123456789..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold resize-none"
                />
             </div>
             
             <button 
               onClick={handleSaveBizSettings}
               className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
             >
                <Save size={16} /> Save Business Profile
             </button>
             {bizSaved && <p className="text-xs text-center text-success-500 font-medium mt-2">Business settings saved successfully! They are now synced across all invoices.</p>}
          </div>
        </div>
      )}
      
      {/* App Installation & PWA Status */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100/80 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 p-1 flex items-center justify-center shrink-0">
              <img 
                src="/logo.jpeg" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} 
                alt="YouFi Logo" 
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">App Installation & Status</h3>
              <p className="text-[11px] text-gray-500 font-medium">Desktop & Mobile PWA / TWA</p>
            </div>
          </div>
          {isInstalled ? (
            <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1 shadow-2xs">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Installed</span>
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
              Browser Mode
            </span>
          )}
        </div>

        {isInstalled ? (
          <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-100 text-xs text-emerald-900 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>YouFi is active in App Mode</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Running in {isTWA ? 'Android TWA Shell' : 'Standalone App'} mode on your {deviceType === 'mobile' ? 'mobile phone' : 'desktop'}. You have fast offline access, crisp full-screen views, and caching enabled.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              Install YouFi on your {deviceType === 'mobile' ? 'mobile phone' : 'desktop computer'} for instant launch, offline tracking, and home screen icon access.
            </p>

            <button
              onClick={async () => {
                await promptInstall();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all text-sm cursor-pointer"
            >
              <Download size={18} />
              <span>Install YouFi App Now</span>
            </button>

            {platform === 'ios' && (
              <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-100/80 text-xs text-gray-700 flex flex-col gap-1.5 mt-1">
                <span className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Smartphone size={12} className="text-emerald-600" />
                  <span>iOS Safari Installation:</span>
                </span>
                <span>1. Tap <Share size={13} className="inline text-emerald-600 shrink-0" /> <b>Share</b> in Safari bottom bar</span>
                <span>2. Select <span className="bg-white border px-1.5 py-0.5 rounded-md font-bold text-[11px] border-emerald-200">Add to Home Screen <PlusSquare size={12} className="inline text-emerald-600" /></span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Settings */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            System & Data
        </h3>
        
        <button 
          onClick={() => navigate('/trash')}
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 font-bold flex items-center justify-between px-4 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-700">
            <Trash2 size={20} />
            View Trash Bin
          </div>
        </button>
      </div>

      {/* Danger Zone: Delete Account */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100 mb-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Danger Zone</h3>
              <p className="text-[11px] text-gray-500 font-medium">Permanent and irreversible account actions</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50/60 rounded-2xl p-4 border border-red-100 text-xs text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-extrabold text-red-900 text-sm">Delete YouFi Account</p>
            <p className="text-[11px] text-red-700 leading-relaxed max-w-sm">
              Permanently wipe your personal account, all financial logs, SME business data, sales, plans, and subscriptions.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmText('');
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Logout */}
      <button 
        onClick={logout}
        className="w-full mt-auto bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-2xl py-4 font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm mb-4 cursor-pointer"
      >
         <LogOut size={20} className="text-gray-500" />
         Log Out
      </button>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isDeleting) {
                  setIsDeleteModalOpen(false);
                  setConfirmText('');
                  setDeleteError(null);
                }
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-100 relative z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              {!isDeleting && (
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setConfirmText('');
                    setDeleteError(null);
                  }}
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              )}

              {/* Warning Header */}
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">Delete Account Permanently</h3>
                  <p className="text-xs text-red-600 font-semibold mt-0.5">This action cannot be undone</p>
                </div>
              </div>

              {/* Warning Content */}
              <div className="bg-red-50/80 rounded-2xl p-4 border border-red-100 text-xs text-red-900 space-y-2 mb-5">
                <p className="font-bold text-red-950">
                  Are you sure you want to delete your YouFi account?
                </p>
                <p className="text-red-800 leading-relaxed text-[11px]">
                  All of your data will be permanently wiped from our databases and your device:
                </p>
                <ul className="space-y-1 text-[11px] text-red-900 list-disc pl-4 font-medium">
                  <li>Personal transactions, budgets & cash flow history</li>
                  <li>All SME business profiles, products, sales & debts</li>
                  <li>Savings goals, AI financial action plans & notes</li>
                  <li>Active subscriptions & profile preferences</li>
                </ul>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-2 mb-5">
                <label className="block text-xs font-bold text-gray-700">
                  To confirm, type <span className="font-mono bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-extrabold">DELETE</span> or your email (<span className="text-gray-500 font-normal">{userProfile?.email || user?.email}</span>):
                </label>
                <input
                  type="text"
                  disabled={isDeleting}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-gray-900 font-semibold"
                  autoFocus
                />
              </div>

              {/* Error Message */}
              {deleteError && (
                <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-xs text-red-800 font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-red-600" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setConfirmText('');
                    setDeleteError(null);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    isDeleting ||
                    !(
                      confirmText.trim().toUpperCase() === 'DELETE' ||
                      (userProfile?.email && confirmText.trim().toLowerCase() === userProfile.email.toLowerCase()) ||
                      (user?.email && confirmText.trim().toLowerCase() === user.email.toLowerCase())
                    )
                  }
                  onClick={async () => {
                    setIsDeleting(true);
                    setDeleteError(null);
                    try {
                      await deleteAccount();
                      navigate('/login', { replace: true });
                    } catch (err: any) {
                      console.error("Account deletion failed:", err);
                      setDeleteError(err?.message || "Failed to delete account. Please try again.");
                      setIsDeleting(false);
                    }
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 disabled:bg-red-300 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Deleting Data...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
