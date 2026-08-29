import React, { useEffect, useState } from 'react';
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../lib/currency';
import { isSameMonth, subMonths, format, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { 
  LineChart, ArrowUp, ArrowDown, TrendingUp, AlertCircle, CheckCircle2, History, ChevronLeft, ChevronRight,
  Briefcase, Wallet, ShieldCheck, Target, Sparkles, Building2, Layers, DollarSign, Calendar, RefreshCw
} from 'lucide-react';

export default function Insights() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'all' | 'personal' | 'business'>('all');

  // Comprehensive Financial Datasets
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bizTxs, setBizTxs] = useState<any[]>([]);
  const [bizSales, setBizSales] = useState<any[]>([]);
  const [livingExps, setLivingExps] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);

  const now = new Date();
  const [activeMonthDate, setActiveMonthDate] = useState<Date>(startOfMonth(now));

  useEffect(() => {
    async function loadAllFinancials() {
      if (!user) return;
      setLoading(true);
      try {
        const [
          txRes,
          bizTxRes,
          salesRes,
          livingRes,
          upRes,
          goalsRes,
          budgetsRes
        ] = await Promise.all([
          supabase.from('transactions').select('*').eq('user_id', user.id),
          supabase.from('business_transactions').select('*').eq('user_id', user.id),
          supabase.from('sales').select('*').eq('user_id', user.id),
          supabase.from('living_expenses').select('*').eq('user_id', user.id),
          supabase.from('upcoming_payments').select('*').eq('user_id', user.id),
          supabase.from('savings_goals').select('*').eq('user_id', user.id),
          supabase.from('budgets').select('*').eq('user_id', user.id)
        ]);

        setTransactions(txRes.data || []);
        setBizTxs(bizTxRes.data || []);
        setBizSales(salesRes.data || []);
        setLivingExps(livingRes.data || []);
        setUpcoming(upRes.data || []);
        setGoals(goalsRes.data || []);
        setBudgets(budgetsRes.data || []);
      } catch (err) {
        console.error("Error loading all financials for Insights", err);
      } finally {
        setLoading(false);
      }
    }
    loadAllFinancials();
  }, [user]);

  const currencyCode = userProfile?.currency || 'USD';

  // Helper to compute monthly financial metrics for a given date and scope
  const getFinancialsForMonth = (monthDate: Date) => {
    const monthStr = format(monthDate, 'yyyy-MM');

    // 1. Personal Tx
    const personalIncomes = transactions
      .filter(t => t.type === 'income' && t.date?.startsWith(monthStr))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const personalExpenses = transactions
      .filter(t => t.type === 'expense' && t.date?.startsWith(monthStr))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 2. Business Sales & Tx
    const bizSalesRev = bizSales
      .filter(s => (s.sale_date || s.created_at)?.startsWith(monthStr))
      .reduce((sum, s) => sum + ((Number(s.selling_price) || 0) * (Number(s.quantity_sold) || 1)), 0);

    const bizTxIncomes = bizTxs
      .filter(t => t.type === 'income' && t.date?.startsWith(monthStr))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const bizExpenses = bizTxs
      .filter(t => t.type === 'expense' && t.date?.startsWith(monthStr))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 3. Living Expenses (Monthly Normalized)
    const monthlyLivingCost = livingExps.reduce((sum, exp) => {
      let amt = Number(exp.amount) || 0;
      if (exp.frequency === 'weekly') amt = (amt * 52) / 12;
      if (exp.frequency === 'yearly') amt = amt / 12;
      return sum + amt;
    }, 0);

    // Aggregate based on scope
    let totalIncome = 0;
    let totalExpense = 0;

    if (scope === 'personal') {
      totalIncome = personalIncomes;
      totalExpense = personalExpenses + monthlyLivingCost;
    } else if (scope === 'business') {
      totalIncome = bizSalesRev + bizTxIncomes;
      totalExpense = bizExpenses;
    } else {
      // 'all' scope
      totalIncome = personalIncomes + bizSalesRev + bizTxIncomes;
      totalExpense = personalExpenses + bizExpenses + monthlyLivingCost;
    }

    return {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
      personalIncomes,
      personalExpenses,
      bizIncome: bizSalesRev + bizTxIncomes,
      bizExpenses,
      monthlyLivingCost
    };
  };

  const currentStats = getFinancialsForMonth(activeMonthDate);
  const lastStats = getFinancialsForMonth(subMonths(activeMonthDate, 1));

  const currentSavingsRate = currentStats.income > 0 ? (currentStats.net / currentStats.income) * 100 : 0;
  const incomeChange = lastStats.income > 0 ? ((currentStats.income - lastStats.income) / lastStats.income) * 100 : 0;
  const expenseChange = lastStats.expense > 0 ? ((currentStats.expense - lastStats.expense) / lastStats.expense) * 100 : 0;

  // Category breakdown for pie chart
  const currentMonthStr = format(activeMonthDate, 'yyyy-MM');
  const categoryMap: Record<string, number> = {};

  if (scope === 'all' || scope === 'personal') {
    transactions
      .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthStr))
      .forEach(t => {
        const cat = t.category || 'Personal';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
      });

    if (livingExps.length > 0) {
      const livingSum = livingExps.reduce((acc, le) => {
        let amt = Number(le.amount) || 0;
        if (le.frequency === 'weekly') amt = (amt * 52) / 12;
        if (le.frequency === 'yearly') amt = amt / 12;
        return acc + amt;
      }, 0);
      categoryMap['Fixed Living Expenses'] = (categoryMap['Fixed Living Expenses'] || 0) + livingSum;
    }
  }

  if (scope === 'all' || scope === 'business') {
    bizTxs
      .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthStr))
      .forEach(t => {
        const cat = t.category || 'Business Overhead';
        categoryMap['Biz: ' + cat] = (categoryMap['Biz: ' + cat] || 0) + Number(t.amount);
      });
  }

  const predefinedColors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];

  const chartData = Object.entries(categoryMap).map(([name, value], idx) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: value as number,
    color: predefinedColors[idx % predefinedColors.length]
  })).sort((a, b) => b.value - a.value);

  const topCategory = chartData.length > 0 ? chartData[0] : null;

  // Monthly trends (Last 6 Months)
  const last6MonthsTrend = [];
  for (let i = 5; i >= 0; i--) {
    const mDate = subMonths(now, i);
    const mStats = getFinancialsForMonth(mDate);
    last6MonthsTrend.push({
      monthName: format(mDate, 'MMM'),
      income: Math.round(mStats.income),
      expense: Math.round(mStats.expense),
      net: Math.round(mStats.net)
    });
  }

  // Summary Metrics Across All Datasets
  const totalSavedGoals = goals.reduce((sum, g) => sum + (Number(g.saved_amount) || 0), 0);
  const totalTargetGoals = goals.reduce((sum, g) => sum + (Number(g.target_amount) || 0), 0);
  const totalUpcomingDebt = upcoming
    .filter(u => u.due_date && new Date(u.due_date) >= now)
    .reduce((sum, u) => sum + (Number(u.amount) || 0), 0);

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-36 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pr-12">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LineChart className="text-brand-600" />
            Analysis & Insights
          </h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Accurate consolidated metrics across all personal & business accounts</p>
        </div>
      </div>

      {/* Scope Selector Bar */}
      <div className="bg-white p-1 rounded-2xl flex items-center shadow-sm border border-gray-100">
        <button
          onClick={() => setScope('all')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            scope === 'all' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Layers size={14} />
          <span>All Financials</span>
        </button>
        <button
          onClick={() => setScope('personal')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            scope === 'personal' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Wallet size={14} />
          <span>Personal</span>
        </button>
        <button
          onClick={() => setScope('business')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            scope === 'business' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 size={14} />
          <span>Business</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16 text-gray-400 font-medium">
          Loading consolidated financials...
        </div>
      ) : (
        <>
          {/* Monthly Trends Chart */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Income vs Expense Trends</h3>
                <p className="text-[11px] text-gray-400 font-medium">Trailing 6-month performance ({scope === 'all' ? 'Personal + SME' : scope})</p>
              </div>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last6MonthsTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#F3F4F6' }}
                    formatter={(value: any, name: any) => [formatCurrency(value, currencyCode), name.charAt(0).toUpperCase() + name.slice(1)]}
                    labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Month Selector Header */}
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {isSameMonth(activeMonthDate, now) ? 'This Month' : format(activeMonthDate, 'MMMM yyyy')} Summary
              </h3>
              <p className="text-xs text-gray-400 font-medium">Calculated across all logged records</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveMonthDate(prev => subMonths(prev, 1))}
                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-2xs"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setActiveMonthDate(prev => subMonths(prev, -1))}
                disabled={isSameMonth(activeMonthDate, now)}
                className={`p-2 rounded-xl border ${isSameMonth(activeMonthDate, now) ? 'bg-gray-50 text-gray-300 border-gray-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 shadow-2xs'}`}
                aria-label="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Accurate Summary Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowUp size={12} className="text-emerald-500" /> Total Income
              </p>
              <h3 className="text-xl font-black text-emerald-600">
                {formatCurrency(currentStats.income, currencyCode)}
              </h3>
              <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1 pt-1">
                {incomeChange >= 0 ? <ArrowUp size={11} className="text-emerald-500" /> : <ArrowDown size={11} className="text-red-500" />}
                <span className={incomeChange >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                  {Math.abs(incomeChange).toFixed(1)}%
                </span> vs last mo
              </p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowDown size={12} className="text-red-500" /> Total Expenses
              </p>
              <h3 className="text-xl font-black text-red-500">
                {formatCurrency(currentStats.expense, currencyCode)}
              </h3>
              <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1 pt-1">
                {expenseChange <= 0 ? <ArrowDown size={11} className="text-emerald-500" /> : <ArrowUp size={11} className="text-red-500" />}
                <span className={expenseChange <= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                  {Math.abs(expenseChange).toFixed(1)}%
                </span> vs last mo
              </p>
            </div>
          </div>

          {/* Net Cash Flow Banner */}
          <div className={`p-5 rounded-3xl border shadow-xs flex items-center justify-between ${
            currentStats.net >= 0 ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100'
          }`}>
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Net Monthly Cash Surplus</p>
              <h3 className={`text-2xl font-black ${currentStats.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatCurrency(currentStats.net, currencyCode)}
              </h3>
              <p className="text-xs font-medium text-gray-600">
                Savings Rate: <span className="font-bold">{currentSavingsRate.toFixed(1)}%</span> of monthly income
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              currentStats.net >= 0 ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
            }`}>
              {currentStats.net >= 0 ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            </div>
          </div>

          {/* Strategic Financial Plan & Recommendations */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Plan & Strategy Overview</h3>
                <p className="text-xs text-gray-400 font-medium">Strategic guidance tailored to your verified numbers</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Target size={12} className="text-brand-600" /> Active Savings Goals
                </p>
                <p className="text-lg font-black text-gray-900">
                  {formatCurrency(totalSavedGoals, currencyCode)} <span className="text-xs text-gray-400 font-bold">/ {formatCurrency(totalTargetGoals, currencyCode)}</span>
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-brand-600 h-1.5 rounded-full" 
                    style={{ width: `${totalTargetGoals > 0 ? Math.min((totalSavedGoals / totalTargetGoals) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar size={12} className="text-orange-500" /> Upcoming Debt / Payments
                </p>
                <p className="text-lg font-black text-gray-900">
                  {formatCurrency(totalUpcomingDebt, currencyCode)}
                </p>
                <p className="text-[11px] text-gray-500 font-medium mt-1">
                  {upcoming.length} scheduled payment obligation(s)
                </p>
              </div>
            </div>

            {/* Strategic Insights */}
            <div className="bg-brand-50/60 rounded-2xl p-4 border border-brand-100 space-y-2">
              <h4 className="text-xs font-bold text-brand-900 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-brand-600" />
                Key Strategic Action Steps:
              </h4>
              <ul className="text-xs text-brand-900/80 font-medium space-y-1.5 pl-4 list-disc">
                {currentStats.net > 0 ? (
                  <>
                    <li>You have a surplus of <span className="font-bold text-brand-950">{formatCurrency(currentStats.net, currencyCode)}</span>. Direct at least 50% into high-yield savings or debt payoff.</li>
                    <li>Your savings rate is <span className="font-bold text-brand-950">{currentSavingsRate.toFixed(1)}%</span>. Maintain an emergency fund covering 3-6 months of fixed expenses ({formatCurrency(currentStats.monthlyLivingCost * 3, currencyCode)}).</li>
                  </>
                ) : (
                  <>
                    <li>Your monthly net deficit is <span className="font-bold text-red-600">{formatCurrency(Math.abs(currentStats.net), currencyCode)}</span>. Review top non-essential categories to adjust budget allocations.</li>
                    <li>Audit active subscriptions in the Expenses Planner to eliminate recurring cost leaks.</li>
                  </>
                )}
                {scope === 'all' && bizSales.length > 0 && (
                  <li>Your business sales contribute active cash flow. Keep business accounts separate for accurate tax and profit tracking.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Expense Category Breakdown Pie */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-gray-900 font-bold text-base w-full mb-6">Expense Category Breakdown</h2>
            
            {chartData.length > 0 ? (
              <div className="w-full h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip formatter={(val: any) => formatCurrency(val, currencyCode)} />
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <span className="block text-xl font-black text-gray-900">{formatCurrency(currentStats.expense, currencyCode)}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
                No expense records found for {format(activeMonthDate, 'MMM yyyy')}.
              </div>
            )}
            
            <div className="w-full mt-6 space-y-3">
              {chartData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-gray-700 truncate">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">{formatCurrency(item.value, currencyCode)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Transaction Reports */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-3">
            <h4 className="text-xs font-bold text-gray-900">View Detailed Reports</h4>
            <div className="flex flex-wrap gap-2">
              <Link to="/history/all" className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-100 px-3.5 py-2 rounded-xl hover:bg-gray-100 transition-colors">All Personal Transactions</Link>
              <Link to="/expenses-planner" className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-3.5 py-2 rounded-xl hover:bg-brand-100 transition-colors">Expenses Planner</Link>
              <Link to="/goals" className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-xl hover:bg-emerald-100 transition-colors">Goals & Strategy</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
