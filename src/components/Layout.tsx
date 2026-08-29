import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate, useParams } from 'react-router-dom';
import { 
  Home, Repeat, Target, MessageCircle, Plus, Menu, X, Sparkles, 
  ArrowDown, CreditCard, Settings, LogOut, Briefcase,
  Building2, ShoppingCart, Package, Wallet, TrendingUp, TrendingDown,
  BarChart3, Calendar, History, LineChart, WifiOff, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { useUI } from '../contexts/UIContext';
import { usePremium } from '../contexts/PremiumContext';
import Paywall from './Paywall';
import { supabase } from '../services/supabase';
import { parseBusinessName } from '../lib/business';
import DuePaymentsBanner from './DuePaymentsBanner';


export default function Layout() {
  const { user, userProfile, logout } = useAuth();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const { isModalOpen } = useUI();
  
  const location = useLocation();
  const navigate = useNavigate();
  const { businessId: businessIdParam } = useParams();
  
  const { isPaywallOpen, paywallFeatureName, hidePaywall, isReadOnly, isTrial, trialEndsAt, showPaywall } = usePremium();

  // Custom hook-like behavior to extract businessId from pathname if not in params
  const businessIdMatch = location.pathname.match(/\/business\/([a-zA-Z0-9_-]+)/);
  const businessId = businessIdParam || (businessIdMatch ? businessIdMatch[1] : null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBusinessAddMenu, setShowBusinessAddMenu] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadSidebarBusinesses();
      
      const bizChannel = supabase.channel('layout-businesses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `user_id=eq.${user.id}` }, () => {
          loadSidebarBusinesses();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(bizChannel);
      };
    }
  }, [user]);

  const loadSidebarBusinesses = async () => {
    try {
      const { data } = await supabase.from('businesses').select('*').eq('user_id', user?.id);
      if (data) {
        setBusinesses(data.map((b: any) => {
          const meta = parseBusinessName(b.name);
          return {
            ...b,
            name: meta.name,
            category: meta.category,
            description: meta.description
          };
        }));
      }
    } catch (err) {
      console.error("Error loading sidebar businesses:", err);
    }
  };

  const isBusinessPage = location.pathname.startsWith('/business');
  const isCoachPage = location.pathname.includes('/coach');
  const activeBusiness = businesses.find(b => b.id === businessId);

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#f8f9fc] flex-col relative">
      <DuePaymentsBanner />
      {isOffline && (
        <div className="w-full bg-orange-500 text-white text-xs font-bold py-1.5 flex justify-center items-center gap-2 z-50">
          <WifiOff size={14} />
          <span> Data is saved locally and will sync when you reconnect.</span>
        </div>
      )}
      <main className={`flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${isCoachPage ? 'pb-0' : isBusinessPage ? 'pb-8' : 'pb-[calc(8rem+env(safe-area-inset-bottom))]'} pt-4 relative z-0 hide-scrollbar`}>
        <Outlet />
      </main>
      
      {/* Global Hamburger Menu Button */}
      <div className="fixed top-[calc(0.5rem+env(safe-area-inset-top))] right-2 flex items-center gap-2 z-[60]">
        <button 
          onClick={togglePrivacyMode}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 bg-white border border-gray-100 text-gray-400 shadow-lg hover:bg-gray-50`}
        >
          {isPrivacyMode ? <EyeOff size={18} className="text-brand-600" /> : <Eye size={18} />}
        </button>
        <button 
           onClick={() => setDrawerOpen((prev) => !prev)}
           className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
             drawerOpen 
               ? 'bg-gray-50 text-gray-500 hover:bg-gray-100' 
               : 'bg-white border border-gray-100 text-gray-700 shadow-lg hover:bg-gray-50'
           }`}
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Global Drawer */}
      <div 
         className={`fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 h-full flex flex-col pt-16">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-gray-100 flex items-center justify-center bg-white p-1">
                 <img 
                   src="/logo.jpeg" 
                   onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} 
                   alt="YouFi" 
                   className="w-full h-full object-contain" 
                 />
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">YouFi</h2>
          </div>
          
          <div className="flex items-center gap-3 mb-6 px-3 py-3 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
               {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="User" /> : <div className="text-brand-600 font-bold">{userProfile?.name?.charAt(0) || 'U'}</div>}
            </div>
            <div className="min-w-0">
               <h3 className="font-bold text-gray-900 text-sm truncate">{userProfile?.name || 'User'}</h3>
               <p className="text-[10px] text-gray-500 truncate">{userProfile?.email}</p>
            </div>
          </div>
          
          <nav className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2">
             {activeBusiness ? (
               <>
                 {/* Specific Business Context */}
                 <div className="mb-4 p-4 bg-brand-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1">Business Mode</p>
                    <h3 className="font-bold text-gray-900 truncate">{activeBusiness.name}</h3>
                 </div>

                 <Link to={`/business/${businessId}`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Building2 size={20} className="text-gray-500" />
                    <span>Dashboard</span>
                 </Link>
                 <Link to={`/business/${businessId}/goals`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Target size={20} className="text-gray-500" />
                    <span>Goals & Strategy</span>
                 </Link>
                 <Link to={`/business/${businessId}/transactions/income`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <TrendingUp size={20} className="text-green-500" />
                    <span>Income / Profit</span>
                 </Link>
                 <Link to={`/business/${businessId}/transactions/expense`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <TrendingDown size={20} className="text-red-500" />
                    <span>Expenses</span>
                 </Link>
                 <Link to={`/business/${businessId}/debts`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <CreditCard size={20} className="text-orange-500" />
                    <span>Debt History</span>
                 </Link>
                 <Link to={`/business/${businessId}/products`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Package size={20} className="text-gray-500" />
                    <span>Inventory</span>
                 </Link>
                 <Link to={`/business/${businessId}/upcoming-payments`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Calendar size={20} className="text-amber-600" />
                    <span>Upcoming Payments</span>
                 </Link>
                 <Link to={`/business/${businessId}/coach`} className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <MessageCircle size={20} className="text-brand-600" />
                    <span>Business AI Advisor</span>
                 </Link>
                 <div className="h-px bg-gray-100 my-4"></div>
                 
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-3">Other Businesses</p>
                 {businesses.filter(b => b.id !== businessId).map(biz => (
                   <Link key={biz.id} to={`/business/${biz.id}`} className="flex items-center gap-4 text-gray-600 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                      <Building2 size={18} className="text-gray-400" />
                      <span className="truncate">{biz.name}</span>
                   </Link>
                 ))}
                 
                 <div className="h-px bg-gray-100 my-4"></div>
                 <Link to="/" className="flex items-center gap-4 text-brand-600 font-bold hover:bg-brand-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Wallet size={20} />
                    <span>YouFi (Personal)</span>
                 </Link>
               </>
             ) : isBusinessPage ? (
               <>
                 {/* Business List Context */}
                 <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">My Companies</p>
                    <h3 className="font-bold text-gray-900">Manage SMEs</h3>
                 </div>

                 <Link to="/business?add=true" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-brand-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Briefcase size={20} className="text-brand-600" />
                    <span>Add / Register Business</span>
                 </Link>

                 <div className="h-px bg-gray-100 my-4"></div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-3">Select Business</p>
                 {businesses.map(biz => (
                   <Link key={biz.id} to={`/business/${biz.id}`} className="flex items-center gap-4 text-gray-600 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                      <Building2 size={18} className="text-gray-400" />
                      <span className="truncate">{biz.name}</span>
                   </Link>
                 ))}

                 <div className="h-px bg-gray-100 my-4"></div>
                 <Link to="/" className="flex items-center gap-4 text-brand-600 font-bold hover:bg-brand-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Wallet size={20} />
                    <span>YouFi (Personal)</span>
                 </Link>
               </>
             ) : (
               <>
                 {/* Personal Finance Context */}
                 <Link to="/business" className="flex items-center gap-4 text-gray-700 font-bold hover:bg-brand-50 p-3 rounded-xl transition-colors border border-dashed border-brand-200 mb-2" onClick={() => setDrawerOpen(false)}>
                    <Briefcase size={20} className="text-brand-600" />
                    <span>Business (SME)</span>
                 </Link>
                 <Link to="/settings" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Settings size={20} className="text-gray-500" />
                    <span>Settings</span>
                 </Link>
                 <Link to="/history/income" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <ArrowDown size={20} className="rotate-180 text-brand-600" />
                    <span>Income History</span>
                 </Link>
                 <Link to="/history/expense" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <ArrowDown size={20} className="text-orange-500" />
                    <span>Expense History</span>
                 </Link>
                 <Link to="/history/debt" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <CreditCard size={20} className="text-red-500" />
                    <span>Debt History</span>
                 </Link>
                 <Link to="/living-expenses" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Home size={20} className="text-emerald-600" />
                    <span>Living Expenses</span>
                 </Link>
                 <Link to="/expenses-planner" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Calendar size={20} className="text-indigo-500" />
                    <span>Expenses Planner</span>
                 </Link>
                 <Link to="/upcoming-payments" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <Calendar size={20} className="text-brand-600" />
                    <span>Upcoming Payments</span>
                 </Link>
                  <Link to="/insights" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                     <LineChart size={20} className="text-brand-600" />
                     <span>Analysis & Insights</span>
                  </Link>
                 <Link to="/coach" className="flex items-center gap-4 text-gray-700 font-medium hover:bg-gray-50 p-3 rounded-xl transition-colors" onClick={() => setDrawerOpen(false)}>
                    <MessageCircle size={20} className="text-brand-600" />
                    <span>AI Advisor</span>
                 </Link>
               </>
             )}
          </nav>
          
          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col gap-4">
             <div className="flex flex-col gap-2.5 px-3">
                <Link 
                   to="/pricing" 
                   className="flex items-center gap-2.5 text-brand-600 font-bold text-xs" 
                   onClick={() => setDrawerOpen(false)}
                >
                   <Sparkles size={14} className="fill-brand-50 shrink-0 text-amber-500" />
                   <span>View Premium Plans</span>
                </Link>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400 font-semibold">
                   <Link to="/terms" onClick={() => setDrawerOpen(false)} className="hover:text-gray-600 hover:underline">
                      Terms of Service
                   </Link>
                   <span>•</span>
                   <Link to="/privacy" onClick={() => setDrawerOpen(false)} className="hover:text-gray-600 hover:underline">
                      Privacy Policy
                   </Link>
                   <span>•</span>
                   <Link to="/refundpolicy" onClick={() => setDrawerOpen(false)} className="hover:text-gray-600 hover:underline">
                      Refunds
                   </Link>
                </div>
             </div>

             <button 
               onClick={() => {
                 setDrawerOpen(false);
                 logout();
                 navigate('/login');
               }}
               className="flex items-center gap-4 text-red-500 font-bold hover:bg-red-50 p-3 rounded-xl w-full transition-colors"
             >
                <LogOut size={20} />
                <span>Log Out</span>
             </button>
          </div>
        </div>
      </div>
      
      {/* Global Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" 
          onClick={() => setDrawerOpen(false)}
        />
      )}
      
      {/* Personal Bottom Nav Wrapper */}
      {!isBusinessPage && !location.pathname.includes('/coach') && !location.pathname.includes('/living-expenses') && !isModalOpen ? (
        <nav className="print:hidden fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-md bg-white/80 backdrop-blur-md border border-gray-100 rounded-full flex justify-around items-center px-6 py-4 z-30 shadow-xl">
          <NavItem to="/" icon={<Home size={22} />} isActive={location.pathname === '/'} />
          <NavItem to="/goals" icon={<Target size={22} />} isActive={location.pathname === '/goals'} />
          
          <div className="relative -top-8 flex-shrink-0">
            <NavLink to="/add" className="flex items-center justify-center w-14 h-14 bg-brand-600 rounded-full text-white shadow-[0_8px_20px_-6px_rgba(85,68,232,0.6)] transform transition-transform active:scale-95">
              <Plus size={26} strokeWidth={2.5} />
            </NavLink>
          </div>
          
          <NavItem to="/history/all" icon={<Repeat size={22} />} isActive={location.pathname === '/history/all'} />
          <NavItem to="/coach" icon={<MessageCircle size={22} />} isActive={location.pathname === '/coach'} />
        </nav>
      ) : businessId && activeBusiness && !location.pathname.includes('/coach') && !isModalOpen ? (
        <>
          {showBusinessAddMenu && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => setShowBusinessAddMenu(false)}>
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-md bg-white rounded-3xl p-4 shadow-xl border border-gray-100 transform transition-all flex flex-col gap-2">
                 <button onClick={() => { setShowBusinessAddMenu(false); navigate(`/business/${businessId}/sales?add=true`); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-gray-800 font-bold w-full transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                       <ShoppingCart size={20} />
                    </div>
                    Add Sales Record
                 </button>
                 <button onClick={() => { setShowBusinessAddMenu(false); navigate(`/business/${businessId}/transactions/income?add=true`); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-gray-800 font-bold w-full transition-colors">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                       <TrendingUp size={20} />
                    </div>
                    Add Business Income
                 </button>
                 <button onClick={() => { setShowBusinessAddMenu(false); navigate(`/business/${businessId}/transactions/expense?add=true`); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-gray-800 font-bold w-full transition-colors">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                       <TrendingDown size={20} />
                    </div>
                    Add Business Expense
                 </button>
                 <button onClick={() => { setShowBusinessAddMenu(false); navigate(`/business/${businessId}/debts?add=true`); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-gray-800 font-bold w-full transition-colors">
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                       <CreditCard size={20} />
                    </div>
                    Add Business Debt
                 </button>
              </div>
            </div>
          )}
          <nav className="print:hidden fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-md bg-white/80 backdrop-blur-md border border-gray-100 rounded-full flex justify-around items-center px-6 py-4 z-40 shadow-xl">
            <NavItem to={`/business/${businessId}`} icon={<Home size={22} />} isActive={location.pathname === `/business/${businessId}`} />
            <NavItem to={`/business/${businessId}/goals`} icon={<Target size={22} />} isActive={location.pathname.includes('/goals')} />
            
            <div className="relative -top-8 flex-shrink-0">
              <button onClick={() => setShowBusinessAddMenu(!showBusinessAddMenu)} className={`flex items-center justify-center w-14 h-14 bg-gray-900 rounded-full text-white shadow-[0_8px_20px_-6px_rgba(17,24,39,0.6)] transform transition-transform active:scale-95 ${showBusinessAddMenu ? 'rotate-45' : ''}`}>
                <Plus size={26} strokeWidth={2.5} />
              </button>
            </div>
            
            <NavItem to={`/business/${businessId}/transactions/all`} icon={<Repeat size={22} />} isActive={location.pathname.includes('/transactions/')} />
            <NavItem to={`/business/${businessId}/coach`} icon={<MessageCircle size={22} />} isActive={location.pathname.includes('/coach')} />
          </nav>
        </>
      ) : null}
      
      {/* Central Global Paywall Component */}
      <Paywall 
        isOpen={isPaywallOpen} 
        onClose={hidePaywall} 
        featureName={paywallFeatureName} 
      />
    </div>
  );
}

function NavItem({ to, icon, isActive }: { to: string; icon: React.ReactNode; isActive: boolean }) {
  return (
    <NavLink 
      to={to} 
      className={`flex items-center justify-center w-12 h-12 transition-all duration-300 ${isActive ? 'text-brand-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
    </NavLink>
  );
}
