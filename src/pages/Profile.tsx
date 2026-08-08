import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, DollarSign, Save, Trash2, Store, Briefcase, Smartphone, Download, CheckCircle2, Share, PlusSquare, Monitor } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { CURRENCIES } from '../lib/currency';
import { parseBusinessName } from '../lib/business';
import { usePWA } from '../hooks/usePWA';

export default function Profile() {
  const { userProfile, user, logout, refreshProfile } = useAuth();
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
        console.error("Error loading businesses in profile page:", err);
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
        console.error("Error parsing business settings in profile:", e);
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
      console.error("Error updating profile:", e);
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
            System
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

      {/* Logout */}
      <button 
        onClick={logout}
        className="w-full mt-auto bg-white border border-danger-200 text-danger-500 rounded-2xl py-4 font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
      >
         <LogOut size={20} />
         Log Out
      </button>
    </div>
  );
}
