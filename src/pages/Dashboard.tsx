import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { tables, fetchTransactions, fetchBudgets } from '../services/db';
import { Bell, ShoppingBag, HeartPulse, Wallet, ArrowDown, CreditCard, BarChart3, TrendingUp, ArrowRightLeft, Building2, TrendingDown, X, PieChart, ChevronRight } from 'lucide-react';
import { isSameMonth, format as formatDate, addDays, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import { formatCurrency } from '../lib/currency';
import { usePrivacy } from '../contexts/PrivacyContext';
import { ModalTracker } from '../components/ModalTracker';
import { motion, AnimatePresence } from 'motion/react';
import { 
    BarChart, Bar, XAxis, YAxis, 
    ResponsiveContainer, Tooltip
} from 'recharts';
import { checkUpcomingPaymentNotifications } from '../lib/notifications';
import { parsePersonalDebt, getCleanNote } from '../lib/debt';
import { parseBusinessName, serializeBusinessTxCategory } from '../lib/business';
import { parseIncomeCategory, parseExpensePlanCategory, isIncomeBudget } from '../lib/expensesPlanner';

import NotificationCenter from '../components/NotificationCenter';

export default function Dashboard() {
  const { userProfile, user } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ amount: '', businessId: '', note: '', transferType: 'Investment' });
  const [transferLoading, setTransferLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<any[]>([]);
  const [plannerBudgets, setPlannerBudgets] = useState<any[]>([]);
  const [livingExpenses, setLivingExpenses] = useState<any[]>([]);

  const fetchAllData = async () => {
    if (!user) {
      setTransactions([]);
      setBusinesses([]);
      setUpcomingPayments([]);
      setPlannerBudgets([]);
      setLivingExpenses([]);
      setLoading(false);
      return;
    }
    const currentMonthStr = formatDate(new Date(), 'yyyy-MM');
    try {
      const [txList, bizRes, upcomingRes, budgetList, livingRes] = await Promise.allSettled([
        fetchTransactions(user.id),
        supabase.from(tables.businesses).select('*').eq('user_id', user.id),
        supabase.from(tables.upcomingPayments).select('*').eq('user_id', user.id),
        fetchBudgets(user.id, currentMonthStr),
        supabase.from('living_expenses').select('*').eq('user_id', user.id)
      ]);

      const loadedTransactions = txList.status === 'fulfilled' ? (txList.value || []) : [];
      const loadedBusinesses = bizRes.status === 'fulfilled' ? (bizRes.value.data || []) : [];
      const loadedUpcoming = upcomingRes.status === 'fulfilled' ? (upcomingRes.value.data || []) : [];
      const loadedBudgets = budgetList.status === 'fulfilled' ? (budgetList.value || []) : [];
      const loadedLiving = livingRes.status === 'fulfilled' ? (livingRes.value.data || []) : [];

      setTransactions(loadedTransactions);
      processChartData(loadedTransactions);

      setBusinesses(loadedBusinesses.map((b: any) => {
        const meta = parseBusinessName(b.name);
        return {
          ...b,
          name: meta.name || b.name,
          category: meta.category || b.category || 'General Business',
          description: meta.description || b.description || ''
        };
      }));

      const personal = loadedUpcoming.filter((p: any) => !p.business_id && !(p.title && p.title.startsWith('[Biz:')));
      setUpcomingPayments(personal);
      checkUpcomingPaymentNotifications(personal);

      if (loadedBudgets.length > 0) {
        setPlannerBudgets(loadedBudgets);
      } else {
        setPlannerBudgets([]);
      }

      if (loadedLiving.length > 0) {
        setLivingExpenses(loadedLiving);
      } else {
        setLivingExpenses([]);
      }
    } catch (err) {
      console.warn("Dashboard fetchAllData warning, using offline fallback data:", err);
      try {
        const fallbackTxs = await fetchTransactions(user.id);
        setTransactions(fallbackTxs);
        processChartData(fallbackTxs);
      } catch (offlineErr) {}
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetchAllData();

    // Set up real-time subscriptions
    const txChannel = supabase.channel('dashboard-tx')
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.transactions, filter: `user_id=eq.${user.id}` }, () => {
        supabase.from(tables.transactions).select('*').eq('user_id', user.id).order('date', { ascending: false }).then(({ data }) => {
          if (data) {
            setTransactions(data);
            processChartData(data);
          }
        });
      })
      .subscribe();

    const bizChannel = supabase.channel('dashboard-biz')
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.businesses, filter: `user_id=eq.${user.id}` }, () => {
        supabase.from(tables.businesses).select('*').eq('user_id', user.id).then(({ data }) => {
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
        });
      })
      .subscribe();

    const upcomingChannel = supabase.channel('dashboard-upcoming')
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.upcomingPayments, filter: `user_id=eq.${user.id}` }, () => {
        supabase.from(tables.upcomingPayments).select('*').eq('user_id', user.id).then(({ data }) => {
          if (data) {
            const personal = data.filter(p => !p.business_id && !(p.title && p.title.startsWith('[Biz:')));
            setUpcomingPayments(personal);
            checkUpcomingPaymentNotifications(personal);
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(bizChannel);
      supabase.removeChannel(upcomingChannel);
    };
  }, [user]);

  const processChartData = (data: any[]) => {
    const monthlyData: { [key: string]: { date: string, income: number, expenses: number } } = {};
    data.forEach((item: any) => {
        if (!item.date) return;
        const month = item.date.substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { date: month, income: 0, expenses: 0 };
        }
        if (item.type === 'income') monthlyData[month].income += item.amount;
        if (item.type === 'expense') monthlyData[month].expenses += item.amount;
    });
    setChartData(Object.values(monthlyData).sort((a,b) => a.date.localeCompare(b.date)));
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLoading) return;
    const amount = parseFloat(transferData.amount);
    if (!user || !transferData.businessId || isNaN(amount) || amount <= 0) return;

    setTransferLoading(true);
    try {
      const targetBiz = businesses.find(b => b.id === transferData.businessId);
      if (!targetBiz) {
        setTransferLoading(false);
        return;
      }
      
      // Update business balance
      const { error: e1 } = await supabase.from(tables.businesses)
        .update({ balance: (targetBiz.balance || 0) + amount })
        .eq('id', transferData.businessId);
      if (e1) throw e1;

      const category = transferData.transferType || 'Investment';

      // Add business transaction (income)
      const { error: e2 } = await supabase.from('business_transactions').insert({
        business_id: transferData.businessId,
        user_id: user.id,
        type: 'income',
        amount,
        category: serializeBusinessTxCategory(category, transferData.note || `Transfer from personal as ${category}`),
        date: new Date().toISOString().split('T')[0]
      });
      if (e2) throw e2;

      // If it's a loan, also record it in business_debts
      if (category === 'Loan') {
        const { error: e3 } = await supabase.from('business_debts').insert({
          amount,
          lender: 'Personal (Owner)',
          due_date: '',
          status: 'unpaid',
          business_id: transferData.businessId,
          user_id: user.id
        });
        if (e3) throw e3;
      }

      // Add personal transaction (expense)
      const { error: e4 } = await supabase.from(tables.transactions).insert({
        user_id: user.id,
        type: 'expense',
        amount,
        category: 'To Business',
        note: `To ${targetBiz.name} (${category}): ${transferData.note}`,
        date: new Date().toISOString().split('T')[0]
      });
      if (e4) throw e4;

      setShowTransferModal(false);
      setTransferData({ amount: '', businessId: '', note: '', transferType: 'Investment' });
      await fetchAllData();
    } catch (error: any) {
      console.error("Error during transfer:", error);
      alert("Transfer failed: " + (error.message || JSON.stringify(error)));
    } finally {
      setTransferLoading(false);
    }
  };
  
  const currencyCode = userProfile?.currency || 'USD';
  const format = (amt: number) => formatCurrency(amt, currencyCode, isPrivacyMode);

  // Dynamic Balance Calculations
  const allIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const allExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const debtsTotal = transactions.filter(t => t.type === 'debt' && parsePersonalDebt(t).status !== 'paid').reduce((acc, t) => acc + t.amount, 0);
  const totalBalance = (userProfile?.income || 0) + allIncome - allExpense;
  
  // Current Month Data
  const currentMonthTx = transactions.filter(t => {
    try {
      return t.date ? isSameMonth(new Date(t.date), new Date()) : false;
    } catch {
      return false;
    }
  });

  const incomeTotal = currentMonthTx.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expenseTotal = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const getIconForCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'shopping': return { icon: <ShoppingBag size={20} />, bg: 'bg-[#eef2ff]', text: 'text-indigo-500' };
      case 'insurance':
      case 'health': return { icon: <HeartPulse size={20} />, bg: 'bg-[#ffedb5]/30', text: 'text-orange-500' };
      default: return { icon: <Wallet size={20} />, bg: 'bg-[#f0f9ff]', text: 'text-sky-500' };
    }
  };

  const expensesByCategory = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => {
    const cat = t.category.toLowerCase();
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const topExpenseCategory = Object.entries(expensesByCategory).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  const insightMessage = topExpenseCategory 
    ? `Highest spend this month: ${topExpenseCategory[0].charAt(0).toUpperCase() + topExpenseCategory[0].slice(1)} (${format(topExpenseCategory[1] as number)})` 
    : "Track your expenses to see insights!";

  return (
    <div className="flex flex-col tracking-tight relative pt-4 overflow-x-hidden">
      {/* Header Context */}
      <div className="flex justify-between items-center mb-8 pr-20">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1 shadow-sm">
                <img 
                  src="/logo.jpeg" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} 
                  alt="YouFi" 
                  className="w-full h-full object-contain" 
                />
             </div>
             <div>
               <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-0.5 leading-none">Welcome back,</p>
               <h1 className="text-xl font-black text-gray-900 leading-tight">{userProfile?.name?.split(' ')[0] || 'Member'}</h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-white shadow-sm flex items-center justify-center font-bold text-brand-600 overflow-hidden">
                {userProfile?.avatar ? <img src={userProfile.avatar} alt="avatar" /> : userProfile?.name?.charAt(0) || 'U'}
            </div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Dark Balance Card */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setShowTransferModal(true)}
            className="bg-gray-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden cursor-pointer group"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-brand-500/20"></div>
            
            <div className="flex justify-between items-start mb-8">
                <div>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Personal Balance</p>
                    <h2 className="text-3xl font-black tracking-tight leading-none">
                        {format(totalBalance)}
                    </h2>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Wallet size={20} className="text-brand-400" />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        className="h-full bg-gradient-to-r from-brand-400 to-indigo-400 rounded-full"
                    ></motion.div>
                </div>
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest leading-none">Ready to Transfer</span>
            </div>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => navigate('/history/income')}
              className="bg-emerald-500 p-5 rounded-[28px] text-white shadow-lg shadow-emerald-200 cursor-pointer hover:bg-emerald-600 active:scale-[0.98] transition-all group relative overflow-hidden"
            >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <TrendingUp size={18} />
                  </div>
                  <ChevronRight size={16} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5 tracking-wider">Total Money In</p>
                <h4 className="text-lg font-black">{format((userProfile?.income || 0) + allIncome)}</h4>
            </div>
            <div 
              onClick={() => navigate('/history/expense')}
              className="bg-rose-500 p-5 rounded-[28px] text-white shadow-lg shadow-rose-200 cursor-pointer hover:bg-rose-600 active:scale-[0.98] transition-all group relative overflow-hidden"
            >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <TrendingDown size={18} />
                  </div>
                  <ChevronRight size={16} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5 tracking-wider">Total Money Out</p>
                <h4 className="text-lg font-black">{format(allExpense)}</h4>
            </div>
        </div>
      </div>

      {/* Upcoming Payments Widget */}
      {upcomingPayments.length > 0 && (
          <div 
             onClick={() => navigate('/upcoming-payments')}
             className="bg-brand-50 border border-brand-100 p-6 rounded-[32px] mb-8 cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand-200/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                         <Bell size={20} />
                     </div>
                     <div>
                         <h3 className="text-sm font-black text-gray-900">Upcoming Payments</h3>
                         <p className="text-[10px] uppercase font-bold tracking-widest text-brand-600">Prepare your funds</p>
                     </div>
                 </div>
                 <div className="text-right">
                     <p className="text-xs font-bold text-gray-500">Total Due</p>
                     <p className="text-sm font-black text-gray-900">{format(upcomingPayments.reduce((acc, p) => acc + p.amount, 0))}</p>
                 </div>
             </div>
             
             <div className="space-y-3 mt-4 relative z-10">
                 {(() => {
                     const now = new Date();
                     const todayStr = formatDate(now, 'yyyy-MM-dd');
                     const tmrwStr = formatDate(addDays(now, 1), 'yyyy-MM-dd');
                     
                     // Sort by closeness
                     const sorted = [...upcomingPayments].sort((a,b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 3);
                     
                     return sorted.map((p, idx) => {
                         const date = new Date(p.due_date);
                         let timeLabel = formatDate(date, 'MMM d');
                         
                         if (p.due_date < todayStr) timeLabel = 'Overdue';
                         else if (p.due_date === todayStr) timeLabel = 'Today';
                         else if (p.due_date === tmrwStr) timeLabel = 'Tomorrow';
                         else if (isThisWeek(date)) timeLabel = 'This Week';
                         else if (isThisMonth(date)) timeLabel = 'This Month';
                         else if (isThisYear(date)) timeLabel = 'This Year';
                         
                         return (
                             <div key={idx} className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm border border-gray-50 gap-2">
                                 <div className="flex items-center gap-3 flex-1 min-w-0">
                                     <div className={`w-2 h-2 rounded-full ${p.due_date <= todayStr ? 'bg-red-500' : 'bg-brand-400'}`}></div>
                                     <p className="text-xs font-bold text-gray-800 truncate">{p.title}</p>
                                 </div>
                                 <div className="text-right flex-shrink-0">
                                     <p className="text-xs font-black text-gray-900">{format(p.amount)}</p>
                                     <p className={`text-[10px] font-bold ${p.due_date <= todayStr ? 'text-red-500' : 'text-gray-400'}`}>{timeLabel}</p>
                                 </div>
                             </div>
                         )
                     })
                 })()}
             </div>
          </div>
      )}

      {/* Overview Cards Grid: Living Expenses & Expenses Planner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Living Expenses Card */}
        {(() => {
          const currencyCode = userProfile?.currency || 'USD';
          const monthlyLiving = livingExpenses.reduce((acc, exp) => {
            let monthlyAmt = Number(exp.amount) || 0;
            if (exp.frequency === 'weekly') monthlyAmt = (monthlyAmt * 52) / 12;
            if (exp.frequency === 'yearly') monthlyAmt = monthlyAmt / 12;
            return acc + monthlyAmt;
          }, 0);

          return (
            <div 
              onClick={() => navigate('/living-expenses')}
              className="bg-white border border-gray-100 p-6 rounded-[32px] cursor-pointer hover:border-rose-200 transition-all shadow-sm group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-2xs group-hover:bg-rose-500 group-hover:text-white transition-colors">
                      <HeartPulse size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900">Living Expenses</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-rose-500">Monthly Run-Rate</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-rose-500 group-hover:translate-x-0.5 transition-transform">
                    <span>Manage</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                {/* Main Total Highlight */}
                <div className="bg-rose-50/50 p-3.5 rounded-2xl mb-4 border border-rose-100/60 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">Est. Monthly Total</p>
                    <p className="text-base font-black text-rose-600 mt-0.5">{formatCurrency(monthlyLiving, currencyCode, isPrivacyMode)}</p>
                  </div>
                  <span className="text-xs font-extrabold text-rose-700 bg-white px-2.5 py-1 rounded-xl shadow-2xs border border-rose-100">
                    {livingExpenses.length} {livingExpenses.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Top Living Expenses List */}
                {livingExpenses.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fixed Cost Items</p>
                    {livingExpenses.slice(0, 3).map(exp => (
                      <div key={exp.id} className="flex items-center justify-between bg-gray-50/60 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-400" />
                          <span className="font-bold text-gray-800">{exp.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium capitalize">({exp.frequency})</span>
                        </div>
                        <span className="font-black text-gray-900">{formatCurrency(exp.amount, currencyCode, isPrivacyMode)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-gray-400 italic">No living expenses set up yet. Tap to configure your monthly run-rate!</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Expenses Planner Card */}
        {(() => {
          const currencyCode = userProfile?.currency || 'USD';
          const incomeBudgets = plannerBudgets.filter(b => isIncomeBudget(b.category));
          const expenseBudgets = plannerBudgets.filter(b => !isIncomeBudget(b.category));

          const parsedIncomes = incomeBudgets.map(b => ({
            ...parseIncomeCategory(b.category),
            amount: Number(b.amount) || 0
          }));

          const parsedPlans = expenseBudgets.map(b => ({
            ...parseExpensePlanCategory(b.category),
            id: b.id,
            amount: Number(b.amount) || 0
          }));

          const totalExpectedIncome = parsedIncomes.reduce((a, b) => a + b.amount, 0);
          const totalAllocatedPlan = parsedPlans.reduce((a, b) => a + b.amount, 0);
          const remainingUnallocated = totalExpectedIncome - totalAllocatedPlan;

          return (
            <div 
              onClick={() => navigate('/expenses-planner')}
              className="bg-white border border-gray-100 p-6 rounded-[32px] cursor-pointer hover:border-brand-200 transition-all shadow-sm group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shadow-2xs group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <PieChart size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900">Expenses Planner</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-brand-600">Monthly Budget & Subs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                    <span>View Planner</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                {/* Quick summary numbers */}
                <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-3.5 rounded-2xl mb-4 border border-gray-100 text-center">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Expected Inc.</p>
                    <p className="text-xs font-black text-emerald-600 mt-0.5">{formatCurrency(totalExpectedIncome, currencyCode, isPrivacyMode)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Allocated</p>
                    <p className="text-xs font-black text-brand-600 mt-0.5">{formatCurrency(totalAllocatedPlan, currencyCode, isPrivacyMode)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Unallocated</p>
                    <p className={`text-xs font-black mt-0.5 ${remainingUnallocated < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      {formatCurrency(remainingUnallocated, currencyCode, isPrivacyMode)}
                    </p>
                  </div>
                </div>

                {/* Top Planned Expenses Preview */}
                {parsedPlans.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Planned Expenses</p>
                    {parsedPlans.slice(0, 3).map(plan => {
                      const subCount = plan.subItems ? plan.subItems.length : 0;
                      return (
                        <div key={plan.id} className="flex items-center justify-between gap-2 bg-gray-50/60 p-2.5 rounded-xl border border-gray-100 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                            <span className="font-bold text-gray-800 truncate">{plan.name}</span>
                            {subCount > 0 && (
                              <span className="bg-brand-50 text-brand-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                {subCount} {subCount === 1 ? 'sub' : 'subs'}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-gray-900 shrink-0">{formatCurrency(plan.amount, currencyCode, isPrivacyMode)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-gray-400 italic">No expense plans created for this month yet. Tap to start planning!</p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {chartData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8"
          >
             <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-sm font-black text-gray-900 border-l-4 border-brand-500 pl-3">Personal Growth</h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Out</span>
                    </div>
                </div>
             </div>
             
             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis 
                         dataKey="date" 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                         tickFormatter={(val) => {
                             const [y, m] = val.split('-');
                             // Return Jan, Feb, etc
                             const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                             return months[parseInt(m)-1] || val;
                         }}
                      />
                      <YAxis 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                      />
                      <Tooltip 
                         cursor={{ fill: '#f8fafc' }}
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '10px' }}
                      />
                      <Bar 
                         dataKey="income" 
                         fill="#10b981" 
                         radius={[4, 4, 0, 0]}
                         barSize={12}
                      />
                      <Bar 
                         dataKey="expenses" 
                         fill="#f43f5e" 
                         radius={[4, 4, 0, 0]}
                         barSize={12}
                      />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>
      )}

      {/* Mini Insight */}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 mb-8 flex items-start gap-4">
         <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-brand-600 shrink-0">
            <BarChart3 size={16} />
         </div>
         <div>
            <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest mb-1">Financial Intelligence</p>
            <p className="text-xs font-bold text-gray-700 leading-tight">
                {insightMessage}
            </p>
         </div>
      </div>
      
      {/* Transfer Modal */}
      <ModalTracker isOpen={showTransferModal} />
      <AnimatePresence>
        {showTransferModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTransferModal(false)}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                     <ArrowRightLeft className="text-brand-600" />
                     Transfer to Business
                  </h2>
                  <button 
                    onClick={() => setShowTransferModal(false)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               
               {businesses.length === 0 ? (
                  <div className="text-center py-6">
                     <p className="text-gray-500 text-sm mb-4">You haven't registered any business yet.</p>
                     <button 
                       onClick={() => navigate('/business')}
                       className="bg-gray-900 text-white font-bold py-3 px-6 rounded-2xl text-sm"
                     >
                        Register Business now
                     </button>
                  </div>
               ) : (
                  <form onSubmit={handleTransfer} className="flex flex-col gap-4">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Target Business</label>
                        <select 
                          required
                          value={transferData.businessId}
                          onChange={(e) => setTransferData({...transferData, businessId: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all appearance-none"
                        >
                           <option value="">Select a business...</option>
                           {businesses.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                           ))}
                        </select>
                     </div>

                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount to Transfer</label>
                        <input 
                          required
                          type="number"
                          step="0.01"
                          min="0"
                          value={transferData.amount}
                          onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-brand-500 transition-all px-1"
                          placeholder="0.00"
                        />
                     </div>
                     
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Transfer Type</label>
                        <div className="flex gap-2">
                           {['Investment', 'Loan'].map((t) => (
                              <button 
                                key={t}
                                type="button"
                                onClick={() => setTransferData({...transferData, transferType: t})}
                                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${transferData.transferType === t ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-gray-100 bg-white text-gray-400'}`}
                              >
                                 {t}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Reference Note</label>
                        <input 
                          value={transferData.note}
                          onChange={(e) => setTransferData({...transferData, note: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                          placeholder="What is this for?"
                        />
                     </div>

                     <button 
                       type="submit" 
                       disabled={transferLoading}
                       className="mt-4 bg-brand-600 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                     >
                       {transferLoading ? 'Processing...' : 'Complete Transfer'}
                     </button>
                  </form>
               )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Recent Transactions */}
      <div>
         <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Transaction</h2>
          <span onClick={() => navigate('/history/all')} className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-brand-100 transition-colors">View All</span>
        </div>
        
        <div className="flex flex-col gap-4">
          {loading ? (
             <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center">
              No transactions yet. Add one!
            </div>
          ) : (
            transactions.slice(0, 5).map(tx => {
              const { icon, bg, text } = getIconForCategory(tx.category);
              const txAmountFormatted = format(Math.abs(tx.amount));
              const isDebt = tx.type === 'debt';
              const debtMeta = isDebt ? parsePersonalDebt(tx) : null;
              const cleanNote = getCleanNote(tx, debtMeta);
              const displayNote = cleanNote || (isDebt ? 'Debt' : 'Transaction');
              
              return (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} ${text}`}>
                        {icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 capitalize">{tx.category}</h4>
                        <p className="text-xs text-gray-400 font-medium mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{displayNote}</p>
                      </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${tx.type === 'income' ? 'text-success-500' : 'text-danger-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{txAmountFormatted}
                    </div>
                    {tx.date && (() => {
                        const d = new Date(tx.date);
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        return <p className="text-[10px] uppercase font-bold text-gray-400 mt-1">{mm}/{dd}/{yyyy}</p>;
                    })()}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}
