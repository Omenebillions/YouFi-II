import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, TrendingUp, TrendingDown, 
  Package, ShoppingCart, ArrowRightLeft, Plus, 
  MoreVertical, PieChart, CreditCard, AlertCircle, Activity, CalendarDays, X, FileText, Settings, Store
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { parseBusinessName, parseBusinessTxCategory, serializeBusinessTxCategory } from '../lib/business';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';
import NotificationCenter from '../components/NotificationCenter';
import { ModalTracker } from '../components/ModalTracker';
import BusinessInvoices from '../components/BusinessInvoices';

export default function BusinessDashboard() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const [business, setBusiness] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [bTxs, setBTxs] = useState<any[]>([]);
  const [bSales, setBSales] = useState<any[]>([]);
  const [bDebts, setBDebts] = useState<any[]>([]);
  const [bUpcomingPayments, setBUpcomingPayments] = useState<any[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices'>('overview');
  
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ amount: '', type: 'to-personal', note: '' });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [bizSettings, setBizSettings] = useState({
    address: '',
    phone: '',
    email: '',
    logo: '🏢',
    paymentInstructions: ''
  });

  // Load business settings on mount or businessId change
  useEffect(() => {
    if (!businessId) return;
    const stored = localStorage.getItem(`youfi_biz_settings_${businessId}`);
    if (stored) {
      try {
        setBizSettings(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing business settings on dashboard mount:", e);
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
  }, [businessId]);

  const handleSaveBizSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    localStorage.setItem(`youfi_biz_settings_${businessId}`, JSON.stringify(bizSettings));
    setShowSettingsModal(false);
    alert("Business profile settings saved successfully!");
  };

  const currencyCode = userProfile?.currency || 'USD';

  const fetchData = useCallback(async (showLoader = false) => {
    if (!businessId || !user) return;
    if (showLoader) setLoading(true);

    try {
      const [bizRes, txRes, prodRes, salesRes, debtRes, recentRes, upcomingRes] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).single(),
        supabase.from('business_transactions').select('*').eq('business_id', businessId).eq('user_id', user.id),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('user_id', user.id),
        supabase.from('sales').select('*').eq('business_id', businessId).eq('user_id', user.id),
        supabase.from('business_debts').select('*').eq('business_id', businessId).eq('user_id', user.id).eq('status', 'unpaid'),
        supabase.from('business_transactions').select('*').eq('business_id', businessId).eq('user_id', user.id).order('date', { ascending: false }).limit(5),
        supabase.from('upcoming_payments').select('*').eq('user_id', user.id)
      ]);

      if (bizRes.data) {
        const meta = parseBusinessName(bizRes.data.name);
        setBusiness({
          ...bizRes.data,
          name: meta.name,
          category: meta.category,
          description: meta.description
        });
      }
      if (txRes.data) {
        setBTxs(txRes.data.map((row: any) => {
          const meta = parseBusinessTxCategory(row.category);
          return {
            ...row,
            category: meta.category,
            note: meta.note || ''
          };
        }));
      }
      if (prodRes.count !== null) setProductsCount(prodRes.count);
      if (salesRes.data) setBSales(salesRes.data);
      if (debtRes.data) setBDebts(debtRes.data);
      if (upcomingRes && upcomingRes.data) {
        const bizUpcoming = upcomingRes.data.filter(p => p.business_id === businessId || (p.title && p.title.startsWith(`[Biz:${businessId}]`)));
        setBUpcomingPayments(bizUpcoming);
      }
      if (recentRes.data) {
        setRecentTransactions(recentRes.data.map((row: any) => {
          const meta = parseBusinessTxCategory(row.category);
          return {
            ...row,
            category: meta.category,
            note: meta.note || ''
          };
        }));
      }
    } catch (err) {
      console.error("Error fetching business dashboard data:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [businessId, user]);

  useEffect(() => {
    if (!businessId || !user) return;

    fetchData(true);

    // Subscriptions
    const bizChannel = supabase.channel(`biz-dashboard-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `id=eq.${businessId}` }, (payload) => {
        if (payload.new && (payload.new as any).name) {
          const meta = parseBusinessName((payload.new as any).name);
          setBusiness({
            ...payload.new,
            name: meta.name,
            category: meta.category,
            description: meta.description
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_transactions', filter: `business_id=eq.${businessId}` }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${businessId}` }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_debts', filter: `business_id=eq.${businessId}` }, () => fetchData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upcoming_payments', filter: `user_id=eq.${user.id}` }, () => fetchData(false))
      .subscribe();

    return () => {
      supabase.removeChannel(bizChannel);
    };
  }, [businessId, user, fetchData]);

  const stats = React.useMemo(() => {
    let txRev = 0;
    let txExp = 0;
    let salesRev = 0;
    let salesProfit = 0;
    
    // For this month explicitly
    let monthlyTxRev = 0;
    let monthlyTxExp = 0;
    let monthlySalesRev = 0;
    let monthlySalesProfit = 0;
    
    const chartMap: Record<string, any> = {};
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Process Sales (Sales = Revenue)
    bSales.forEach(s => {
       const totalPrice = s.total_price || 0;
       const profit = s.profit || 0;
       salesRev += totalPrice;
       salesProfit += profit;
       
       const dateStr = s.date;
       if (dateStr) {
           if (dateStr.startsWith(currentMonthPrefix)) {
               monthlySalesRev += totalPrice;
               monthlySalesProfit += profit;
           }
           const monthStr = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
           const sortKey = dateStr.substring(0, 7);
           if (!chartMap[sortKey]) {
              chartMap[sortKey] = { name: monthStr, sortKey, income: 0, expense: 0 };
           }
           chartMap[sortKey].income += totalPrice;
       }
    });

    // Process Transactions
    bTxs.forEach(tx => {
       if (tx.type === 'income') txRev += tx.amount;
       else txExp += tx.amount;

       const dateStr = tx.date;
       if (dateStr) {
           if (dateStr.startsWith(currentMonthPrefix)) {
               if (tx.type === 'income') monthlyTxRev += tx.amount;
               else monthlyTxExp += tx.amount;
           }
           const monthStr = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
           const sortKey = dateStr.substring(0, 7);
           if (!chartMap[sortKey]) {
              chartMap[sortKey] = { name: monthStr, sortKey, income: 0, expense: 0 };
           }
           if (tx.type === 'income') chartMap[sortKey].income += tx.amount;
           else chartMap[sortKey].expense += tx.amount;
       }
    });

    const chartData = Object.values(chartMap)
          .sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey))
          .slice(-6);

    const totalRevenue = txRev + salesRev;
    const totalExpenses = txExp;
    const netBalance = totalRevenue - totalExpenses;
    const debtsAmt = bDebts.reduce((acc, d) => acc + d.amount, 0);
    
    // Monthly Net Profit (Revenue - Expenses)
    const monthlyNetProfit = monthlySalesRev + monthlyTxRev - monthlyTxExp;
    const lifetimeNetProfit = totalRevenue - totalExpenses;

    return { 
       revenue: totalRevenue, 
       expenses: totalExpenses, 
       netBalance,
       salesProfit, 
       chartData, 
       debts: debtsAmt, 
       products: productsCount,
       monthlyNetProfit,
       lifetimeNetProfit
    };
  }, [bTxs, bSales, bDebts, productsCount]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const amount = parseFloat(transferData.amount);
    if (!user || !businessId || isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      if (transferData.type === 'to-personal') {
        if (business.balance < amount) {
           alert("Insufficient business balance.");
           setLoading(false);
           return;
        }

        const { error: e1 } = await supabase.from('businesses')
          .update({ balance: (business.balance || 0) - amount })
          .eq('id', businessId);
        if (e1) throw e1;

        const { error: e2 } = await supabase.from('business_transactions').insert({
           business_id: businessId, 
           user_id: user.id, 
           type: 'expense', 
           amount, 
           category: serializeBusinessTxCategory('Transfer to Personal', transferData.note || 'Transfer to personal account'),
           date: new Date().toISOString().split('T')[0]
        });
        if (e2) throw e2;

        const { error: e3 } = await supabase.from('transactions').insert({
           user_id: user.id, type: 'income', amount, category: 'From Business',
           note: `From ${business.name}: ${transferData.note}`,
           date: new Date().toISOString().split('T')[0]
        });
        if (e3) throw e3;
      } else {
        const { error: e4 } = await supabase.from('businesses')
          .update({ balance: (business.balance || 0) + amount })
          .eq('id', businessId);
        if (e4) throw e4;

        const { error: e5 } = await supabase.from('business_transactions').insert({
           business_id: businessId, 
           user_id: user.id, 
           type: 'income', 
           amount, 
           category: serializeBusinessTxCategory('Transfer from Personal', transferData.note || 'Transfer from personal account'),
           date: new Date().toISOString().split('T')[0]
        });
        if (e5) throw e5;
        
        const { error: e6 } = await supabase.from('transactions').insert({
           user_id: user.id, type: 'expense', amount, category: 'To Business',
           note: `To ${business.name}: ${transferData.note}`,
           date: new Date().toISOString().split('T')[0]
        });
        if (e6) throw e6;
      }
      setShowTransferModal(false);
      setTransferData({ amount: '', type: 'to-personal', note: '' });
      fetchData();
    } catch (error: any) {
      console.error("Error during transfer:", error);
      alert("Transfer failed: " + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, currencyCode, isPrivacyMode);
  };

  const netProfit = stats.lifetimeNetProfit;

  const healthMetrics = React.useMemo(() => {
    let score = 50;
    const rev = stats.revenue;
    const debt = stats.debts;
    const mNetProfit = stats.monthlyNetProfit;
    
    // Profit margin contribution (-20 to +20)
    const profitMargin = rev > 0 ? (stats.lifetimeNetProfit / rev) : 0;
    score += Math.min(20, Math.max(-20, profitMargin * 40));

    // Monthly trend contribution (-15 to +15)
    score += mNetProfit > 0 ? 15 : (mNetProfit < 0 ? -15 : 0);

    // Debt contribution (-25 to +15)
    if (debt > 0) {
        const debtRatio = rev > 0 ? (debt / rev) : 1;
        score -= Math.min(25, debtRatio * 30);
    } else {
        score += 15;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let rating = 'Fair';
    let explanation = 'Your business is stable but there is room for improvement in cash flow and debt management.';
    let colorClass = 'text-yellow-600';
    let bgClass = 'bg-yellow-50';
    let barColor = 'bg-yellow-400';

    if (score >= 80) {
        rating = 'Excellent';
        explanation = 'Outstanding financial health! Strong profit margins, positive cash flow, and manageable debt levels.';
        colorClass = 'text-emerald-700';
        bgClass = 'bg-emerald-50';
        barColor = 'bg-emerald-500';
    } else if (score >= 60) {
        rating = 'Good';
        explanation = 'Solid financial health. Maintain your current cash flow trends and keep debt under control.';
        colorClass = 'text-blue-700';
        bgClass = 'bg-blue-50';
        barColor = 'bg-blue-500';
    } else if (score < 40) {
        rating = 'Needs Attention';
        explanation = 'Your financial health is at risk. Focus on increasing revenue, cutting expenses, or clearing outstanding debts.';
        colorClass = 'text-rose-700';
        bgClass = 'bg-rose-50';
        barColor = 'bg-rose-500';
    }

    return { score, rating, explanation, colorClass, bgClass, barColor };
  }, [stats]);

  if (!business && !loading) return <div className="p-10 text-center">Business not found.</div>;

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-20">
        <button onClick={() => navigate('/business')} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold text-gray-900">{business?.name || 'Loading...'}</h1>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{business?.category}</span>
        </div>
        <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowSettingsModal(true)} 
              className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-500 shadow-sm transition-transform active:scale-95 hover:text-gray-700 hover:bg-gray-50"
              title="Business Settings"
            >
              <Settings size={18} />
            </button>
            <NotificationCenter businessId={businessId} />
        </div>
      </div>

      {/* Hero Stats */}
      <div className="bg-gray-900 rounded-[32px] p-8 text-white shadow-xl mb-6 relative overflow-hidden">
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-8 text-left">
                <div>
                   <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Company Assets</p>
                   <h2 className="text-4xl font-extrabold tracking-tight leading-none">
                      {formatCurrency(stats.netBalance)}
                   </h2>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                   <Building2 size={20} className="text-brand-400" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 pb-2">
                <div className="flex flex-col gap-1 text-left">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Total Income</p>
                    <p className="text-lg font-black text-emerald-400">{formatCurrency(stats.revenue)}</p>
                </div>
                <div className="flex flex-col gap-1 text-left border-l border-white/10 pl-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400"></span> Total Expenses</p>
                    <p className="text-lg font-black text-rose-400">{formatCurrency(stats.expenses)}</p>
                </div>
            </div>

            {/* Income vs Expense Bar */}
            <div className="flex items-center gap-1 mb-8 h-2 opacity-80 hover:opacity-100 transition-opacity">
               <div 
                 className="h-full bg-emerald-400 rounded-l-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
                 style={{ width: `${stats.revenue + stats.expenses === 0 ? 50 : (stats.revenue / (stats.revenue + stats.expenses) * 100)}%` }}
               ></div>
               <div 
                 className="h-full bg-rose-400 rounded-r-full shadow-[0_0_10px_rgba(251,113,133,0.5)]"
                 style={{ width: `${stats.revenue + stats.expenses === 0 ? 50 : (stats.expenses / (stats.revenue + stats.expenses) * 100)}%` }}
               ></div>
            </div>

            <div className="flex gap-3">
               <button onClick={() => setShowTransferModal(true)} className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95 border border-white/5">
                 <ArrowRightLeft size={16} /> Transfer
               </button>
               <button onClick={() => navigate(`/business/${businessId}/transactions/income`)} className="flex-1 bg-brand-600 rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-lg shadow-brand-500/30">
                 <Plus size={16} /> New Entry
               </button>
            </div>
         </div>
                   <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-brand-600/20 rounded-full blur-3xl shadow-inner shadow-brand-400 pointer-events-none"></div>
       </div>

       {/* Tabs Selector */}
       <div className="print:hidden bg-gray-100 p-1 rounded-2xl flex mb-6 border border-gray-200/50">
         <button 
           type="button"
           onClick={() => setActiveTab('overview')}
           className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700'}`}
         >
           Overview
         </button>
         <button 
           type="button"
           onClick={() => setActiveTab('invoices')}
           className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'invoices' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700'}`}
         >
           <FileText size={14} className={activeTab === 'invoices' ? 'text-brand-600' : ''} /> Invoices
         </button>
       </div>

       {activeTab === 'overview' ? (
         <>

      {/* SME Tools Section */}
      <div className="grid grid-cols-3 gap-3 mb-8">
         <div onClick={() => navigate(`/business/${businessId}/sales`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mx-auto mb-2">
               <ShoppingCart size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Sales</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/products`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mx-auto mb-2">
               <Package size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Products</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/transactions/income`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mx-auto mb-2">
               <TrendingUp size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Income</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/transactions/expense`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mx-auto mb-2">
               <TrendingDown size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Expenses</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/debts`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mx-auto mb-2">
               <CreditCard size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Debts</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/upcoming-payments`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mx-auto mb-2">
               <CalendarDays size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Upcoming Payments</p>
         </div>
         <div onClick={() => setShowSettingsModal(true)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mx-auto mb-2">
               <Settings size={16} />
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Profile Settings</p>
         </div>
      </div>

      {/* Profit Analysis */}
      <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
         <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
               <PieChart size={18} className="text-brand-600" /> Overall Net Profit
            </h3>
            <span className={`text-[10px] font-extrabold px-2 py-1 rounded-lg ${netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
               {netProfit >= 0 ? 'Profitable' : 'Loss'}
            </span>
         </div>
         <div className="text-3xl font-extrabold text-gray-900 mb-2">{formatCurrency(netProfit)}</div>
         <p className="text-xs text-gray-500 font-medium">calculated as Total Income (Sales + Other Income) minus Total Operating Expenses.</p>
         {stats.debts > 0 && (
           <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle size={14} /> Outstanding Debt:</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(stats.debts)}</span>
           </div>
         )}
      </div>

      {/* Financial Health Score */}
      <div className={`p-6 rounded-[32px] mb-8 flex flex-col gap-4 shadow-sm border border-gray-100 transition-all ${healthMetrics.bgClass}`}>
         <div className="flex justify-between items-start">
            <div className="flex flex-col">
               <h3 className={`text-sm font-bold flex items-center gap-2 mb-1 ${healthMetrics.colorClass}`}>
                  <Activity size={18} /> Financial Health Score
               </h3>
               <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md self-start bg-white/60 ${healthMetrics.colorClass}`}>{healthMetrics.rating}</span>
            </div>
            <div className={`text-3xl font-black ${healthMetrics.colorClass}`}>
               {healthMetrics.score}<span className="text-sm font-bold opacity-50">/100</span>
            </div>
         </div>
         
         <div className="w-full bg-black/5 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${healthMetrics.barColor}`} style={{ width: `${healthMetrics.score}%` }}></div>
         </div>

         <p className="text-xs text-gray-700 font-medium leading-relaxed opacity-90">
            {healthMetrics.explanation}
         </p>
      </div>

      {/* Income vs Expenses Chart */}
      {stats.chartData.length > 0 && (
         <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-900 mb-6">Income vs Expenses (Monthly)</h3>
            <div className="h-48 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                     <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#F3F4F6' }}
                        formatter={(value: any) => [formatCurrency(value), '']}
                        labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '4px' }}
                     />
                     <Bar dataKey="income" name="Income" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={40} />
                     <Bar dataKey="expense" name="Expense" fill="#FB7185" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      )}

      {/* Upcoming Payments Widget */}
      {bUpcomingPayments.length > 0 && (
          <div 
             onClick={() => navigate(`/business/${businessId}/upcoming-payments`)}
             className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] mb-8 cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
          >
             <div className="flex items-center justify-between mb-4 relative z-10">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-amber-200/50 rounded-xl flex items-center justify-center text-amber-700">
                         <CalendarDays size={20} />
                     </div>
                     <div>
                         <h3 className="font-bold text-gray-900">Upcoming Payments</h3>
                         <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{bUpcomingPayments.length} Bills Due</p>
                     </div>
                 </div>
                 <div className="text-right">
                     <p className="text-xs font-bold text-gray-500">Total Due</p>
                     <p className="text-sm font-black text-gray-900">{formatCurrency(bUpcomingPayments.reduce((acc, p) => acc + p.amount, 0))}</p>
                 </div>
             </div>
             
             <div className="flex flex-col gap-2 relative z-10">
                 {(() => {
                     const now = new Date();
                     const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                     const tmrwStr = new Date(now.getTime() + 86400000 - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                     
                     // Sort by closeness
                     const sorted = [...bUpcomingPayments].sort((a,b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 3);
                     
                     return sorted.map((p, idx) => {
                         const dateStr = p.due_date;
                         let dayLabel = '';
                         if (dateStr === todayStr) dayLabel = 'Today';
                         else if (dateStr === tmrwStr) dayLabel = 'Tomorrow';
                         else dayLabel = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                         
                         const displayTitle = p.title.replace(/^\[Biz:.*?\]\s*/, '');
                         
                         const isPastDue = new Date(dateStr) < new Date(todayStr);

                         return (
                             <div key={idx} className="flex justify-between items-center text-xs bg-white/60 p-2.5 rounded-xl">
                                 <span className="font-bold text-gray-700 flex items-center gap-2 flex-1 min-w-0 pr-2">
                                     <span className={`w-1.5 h-1.5 rounded-full ${isPastDue ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></span>
                                     <span className="truncate">{displayTitle}</span>
                                 </span>
                                 <div className="flex items-center gap-3 flex-shrink-0">
                                     <span className={`font-black ${isPastDue ? 'text-red-500' : 'text-gray-400 uppercase tracking-wider text-[9px]'}`}>{isPastDue ? 'Past Due' : dayLabel}</span>
                                     <p className="text-xs font-black text-gray-900">{formatCurrency(p.amount)}</p>
                                 </div>
                             </div>
                         );
                     });
                 })()}
             </div>
          </div>
      )}

      {/* Recent Activity */}
      <div className="flex flex-col gap-5">
         <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-gray-900">Latest History</h3>
            <span className="text-xs font-bold text-brand-600" onClick={() => navigate(`/business/${businessId}/transactions/all`)}>History</span>
         </div>

         {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-3xl border border-dashed border-gray-100">No activity recorded.</div>
         ) : (
            <div className="flex flex-col gap-3">
               {recentTransactions.map((tx) => (
                 <div key={tx.id} className="bg-white p-4 rounded-2xl border border-gray-50 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {tx.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-900 text-xs">{tx.category}</h4>
                          <p className="text-[10px] text-gray-400 font-medium">{tx.date}</p>
                       </div>
                    </div>
                    <div className={`text-xs font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                       {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                 </div>
               ))}
            </div>
          )}
       </div>
       </>
       ) : (
         <BusinessInvoices 
           businessId={businessId!}
           currencyCode={currencyCode}
           businessName={business?.name || ''}
         />
       )}

       <ModalTracker isOpen={showTransferModal || showSettingsModal} />
      <AnimatePresence>
        {showTransferModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTransferModal(false)} className="fixed inset-0 bg-black/40 z-[60]" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ArrowRightLeft size={20} className="text-brand-600" /> Fund Transfer</h2>
                 <button onClick={() => setShowTransferModal(false)} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                    <X size={20} />
                 </button>
               </div>
               <form onSubmit={handleTransfer} className="flex flex-col gap-4">
                  <div className="bg-gray-100/50 p-1 rounded-2xl flex relative h-12">
                     <button type="button" onClick={() => setTransferData({...transferData, type: 'to-personal'})} className={`flex-1 flex items-center justify-center text-xs font-bold rounded-xl transition-all z-10 ${transferData.type === 'to-personal' ? 'text-brand-700 bg-white shadow-sm' : 'text-gray-500'}`}>Business → YouFi</button>
                     <button type="button" onClick={() => setTransferData({...transferData, type: 'to-business'})} className={`flex-1 flex items-center justify-center text-xs font-bold rounded-xl transition-all z-10 ${transferData.type === 'to-business' ? 'text-brand-700 bg-white shadow-sm' : 'text-gray-500'}`}>YouFi → Business</button>
                  </div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount</label><input required type="number" step="0.01" min="0" value={transferData.amount} onChange={(e) => setTransferData({...transferData, amount: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold text-lg" placeholder="0.00" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-gray-500 uppercase ml-1">Reference</label><input value={transferData.note} onChange={(e) => setTransferData({...transferData, note: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900" placeholder="Transfer notes..." /></div>
                  <button type="submit" disabled={loading} className="mt-4 bg-gray-900 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg">{loading ? 'Processing...' : 'Transfer Funds'}</button>
                  <button type="button" onClick={() => setShowTransferModal(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest text-center mt-2">Cancel Transaction</button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

       <AnimatePresence>
         {showSettingsModal && (
           <>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettingsModal(false)} className="fixed inset-0 bg-black/40 z-[60]" />
             <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl text-gray-800">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Store size={20} className="text-brand-600" /> Business Settings</h2>
                  <button onClick={() => setShowSettingsModal(false)} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                     <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleSaveBizSettings} className="flex flex-col gap-4">
                  <p className="text-xs text-gray-400 leading-relaxed">These details are shared across invoices and billing documents for <span className="font-bold text-gray-700">{business?.name || 'your business'}</span>.</p>
                  
                  {/* Custom Logo Upload / Emoji Input Section */}
                  <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Business Logo</span>
                    
                    <div className="flex gap-4 items-center">
                      {/* Visual Preview */}
                      <div className="w-16 h-16 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {bizSettings.logo && (bizSettings.logo.startsWith('data:') || bizSettings.logo.startsWith('http')) ? (
                          <img src={bizSettings.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-3xl">{bizSettings.logo || '🏢'}</span>
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-1.5">
                        <p className="text-[10px] text-gray-500 font-medium">Use a text emoji/symbol, or upload your official company logo file (Max 1MB).</p>
                        
                        <div className="flex gap-2 items-center">
                          <label className="cursor-pointer py-2 px-3 bg-white border border-gray-150 rounded-xl text-[10px] font-extrabold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 flex items-center gap-1.5">
                            <span>Upload Image File</span>
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
                              className="py-2 px-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-bold hover:bg-red-100 transition-colors"
                            >
                              Reset to Default
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 font-bold">Or Emoji:</span>
                              <input 
                                type="text" 
                                maxLength={4}
                                value={bizSettings.logo} 
                                onChange={(e) => setBizSettings({...bizSettings, logo: e.target.value})} 
                                className="w-14 bg-white border border-gray-150 rounded-xl py-1 px-2 text-center text-sm font-bold text-gray-800 focus:border-brand-500"
                                placeholder="🏢"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Contact Phone</label>
                    <input 
                      type="tel" 
                      value={bizSettings.phone} 
                      onChange={(e) => setBizSettings({...bizSettings, phone: e.target.value})} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Business Contact Email</label>
                    <input 
                      type="email" 
                      value={bizSettings.email} 
                      onChange={(e) => setBizSettings({...bizSettings, email: e.target.value})} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800"
                      placeholder="billing@yourbusiness.com"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Physical Address / Headquarters</label>
                    <textarea 
                      rows={2}
                      value={bizSettings.address} 
                      onChange={(e) => setBizSettings({...bizSettings, address: e.target.value})} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800 resize-none"
                      placeholder="123 Business Rd, Suite 100, Metropolis"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Payment Instructions (Optional)</label>
                    <textarea 
                      rows={2}
                      value={bizSettings.paymentInstructions} 
                      onChange={(e) => setBizSettings({...bizSettings, paymentInstructions: e.target.value})} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800 resize-none"
                      placeholder="Bank: GTBank, Account: 0123456789..."
                    />
                  </div>

                  <button type="submit" className="mt-4 bg-gray-900 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg">Save Settings</button>
                  <button type="button" onClick={() => setShowSettingsModal(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest text-center mt-2">Cancel</button>
                </form>
             </motion.div>
           </>
         )}
       </AnimatePresence>
    </div>
  );
}
