import React, { useEffect, useState } from 'react';
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions } from '../services/db';
import { formatCurrency } from '../lib/currency';
import { isSameMonth, subMonths, format, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { LineChart, ArrowUp, ArrowDown, TrendingUp, AlertCircle, CheckCircle2, History, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Insights() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const now = new Date();
  const [activeMonthDate, setActiveMonthDate] = useState<Date>(startOfMonth(now));

  useEffect(() => {
    if (user) {
       fetchTransactions(user.uid).then(t => {
         setTransactions(t || []);
         setLoading(false);
       });
    }
  }, [user]);

  const currencyCode = userProfile?.currency || 'USD';
  
  const currentMonthTx = transactions.filter(t => t.date && isSameMonth(new Date(t.date), activeMonthDate));
  const lastMonthTx = transactions.filter(t => t.date && isSameMonth(new Date(t.date), subMonths(activeMonthDate, 1)));

  // Current Month Stats
  const currentIncome = currentMonthTx.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const currentExpense = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentSavings = currentIncome - currentExpense;
  const currentSavingsRate = currentIncome > 0 ? (currentSavings / currentIncome) * 100 : 0;

  // Last Month Stats
  const lastIncome = lastMonthTx.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const lastExpense = lastMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const lastSavings = lastIncome - lastExpense;

  const expenseChange = lastExpense > 0 ? ((currentExpense - lastExpense) / lastExpense) * 100 : 0;
  const incomeChange = lastIncome > 0 ? ((currentIncome - lastIncome) / lastIncome) * 100 : 0;

  // Group by category for current month
  const expensesByCategory = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => {
    const cat = t.category;
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const predefinedColors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

  const chartData = Object.entries(expensesByCategory).map(([name, value], idx) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: value as number,
    color: predefinedColors[idx % predefinedColors.length]
  })).sort((a, b) => (b.value as number) - (a.value as number));

  const topCategory = chartData.length > 0 ? chartData[0] : null;

  // Monthly trends from 2026 Jan onwards
  const monthlyStatsMap: Record<string, { income: number; expense: number; balance: number; monthName: string }> = {};

  transactions.forEach(t => {
     if (!t.date) return;
     const date = new Date(t.date);
     if (date.getFullYear() < 2026) return; // Starting from 2026

     const sortKey = t.date.substring(0, 7); // YYYY-MM
     if (!monthlyStatsMap[sortKey]) {
        monthlyStatsMap[sortKey] = { income: 0, expense: 0, balance: 0, monthName: format(date, 'MMM yyyy') };
     }
     if (t.type === 'income') {
        monthlyStatsMap[sortKey].income += t.amount;
        monthlyStatsMap[sortKey].balance += t.amount;
     } else {
        monthlyStatsMap[sortKey].expense += t.amount;
        monthlyStatsMap[sortKey].balance -= t.amount;
     }
  });

  const allMonthsTrend = Object.entries(monthlyStatsMap)
     .map(([key, data]) => ({ sortKey: key, ...data }))
     .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 px-1 flex items-center gap-2 pr-12">
         <LineChart className="text-brand-600" />
         Analysis & Insights
      </h1>
      
      {loading ? (
         <div className="flex items-center justify-center p-12 text-gray-400">Loading analysis...</div>
      ) : (
        <>
          {/* Trends Chart */}
          {allMonthsTrend.length > 0 && (
             <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                <h3 className="text-sm font-bold text-gray-900 mb-6">Monthly Trends (From 2026)</h3>
                <div className="h-48 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allMonthsTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                         <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                         <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                         <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#F3F4F6' }}
                            formatter={(value: number, name: string) => [formatCurrency(value, currencyCode), name.charAt(0).toUpperCase() + name.slice(1)]}
                            labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '4px' }}
                         />
                         <Bar dataKey="income" name="Income" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={30} />
                         <Bar dataKey="expense" name="Expense" fill="#FB7185" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
          )}

          {/* Month Selector */}
          <div className="flex items-center justify-between mb-4 px-1">
             <h3 className="text-lg font-bold text-gray-900">
               {isSameMonth(activeMonthDate, now) ? 'This Month (MTD)' : format(activeMonthDate, 'MMM yyyy')} Summary
             </h3>
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setActiveMonthDate(prev => subMonths(prev, 1))}
                  className="p-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50"
                  aria-label="Previous Month"
                >
                   <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setActiveMonthDate(prev => subMonths(prev, -1))}
                  disabled={isSameMonth(activeMonthDate, now)}
                  className={`p-1.5 rounded-full border border-gray-200 ${isSameMonth(activeMonthDate, now) ? 'bg-gray-50 text-gray-300 border-gray-100' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  aria-label="Next Month"
                >
                   <ChevronRight size={16} />
                </button>
             </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
               <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Monthly Income</p>
               <h3 className="text-lg font-black text-green-600 mb-2">{formatCurrency(currentIncome, currencyCode)}</h3>
               <div className="flex items-center gap-1 text-xs">
                 {incomeChange >= 0 ? <ArrowUp size={12} className="text-green-500" /> : <ArrowDown size={12} className="text-red-500" />}
                 <span className={incomeChange >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                   {Math.abs(incomeChange).toFixed(1)}% vs last mo
                 </span>
               </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
               <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Monthly Expenses</p>
               <h3 className="text-lg font-black text-red-500 mb-2">{formatCurrency(currentExpense, currencyCode)}</h3>
               <div className="flex items-center gap-1 text-xs">
                 {expenseChange <= 0 ? <ArrowDown size={12} className="text-green-500" /> : <ArrowUp size={12} className="text-red-500" />}
                 <span className={expenseChange <= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                   {Math.abs(expenseChange).toFixed(1)}% vs last mo
                 </span>
               </div>
            </div>
          </div>

          {/* Financial Health Advice */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3 px-1">Financial Health</h3>
            
            {lastSavings !== 0 && (
              <div className={`p-4 rounded-2xl border flex gap-3 mb-3 ${lastSavings < 0 ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="shrink-0 mt-0.5">
                  <History size={20} className={lastSavings < 0 ? "text-orange-500" : "text-blue-500"} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold mb-1 ${lastSavings < 0 ? 'text-orange-800' : 'text-blue-800'}`}>
                    Last Month Review
                  </h4>
                  <p className={`text-xs leading-relaxed ${lastSavings < 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                    Your previous month ended with a {lastSavings < 0 ? 'deficit' : 'surplus'} of <span className="font-bold">{formatCurrency(Math.abs(lastSavings), currencyCode)}</span>.
                    {lastSavings < 0 ? ' Use this insight to plan your expenses carefully this month.' : ' Great job keeping your finances positive!'}
                  </p>
                </div>
              </div>
            )}

            <div className={`p-4 rounded-2xl border flex gap-3 ${currentExpense > currentIncome ? 'bg-red-50 border-red-100' : 'bg-brand-50 border-brand-100'}`}>
              <div className="shrink-0 mt-0.5">
                {currentExpense > currentIncome ? (
                  <AlertCircle size={20} className="text-red-500" />
                ) : (
                  <CheckCircle2 size={20} className="text-brand-600" />
                )}
              </div>
              <div>
                <h4 className={`text-sm font-bold mb-1 ${currentExpense > currentIncome ? 'text-red-800' : 'text-brand-800'}`}>
                  {currentExpense > currentIncome ? (isSameMonth(activeMonthDate, now) ? "You're spending more than you earn" : "You spent more than you earned") : (isSameMonth(activeMonthDate, now) ? "You're on track this month!" : "You stayed on track!")}
                </h4>
                <p className={`text-xs leading-relaxed ${currentExpense > currentIncome ? 'text-red-600' : 'text-brand-600'}`}>
                  {currentExpense > currentIncome 
                    ? `Your expenses exceeded your income by ${formatCurrency(currentExpense - currentIncome, currencyCode)} in ${format(activeMonthDate, 'MMM yyyy')}. ${isSameMonth(activeMonthDate, now) ? 'Consider reviewing your top spending categories to find areas to cut back.' : ''}`
                    : `Great job! You saved ${formatCurrency(currentSavings, currencyCode)} in ${format(activeMonthDate, 'MMM yyyy')}. ${isSameMonth(activeMonthDate, now) ? 'Your savings rate is ' : 'Your savings rate was '}`}
                  {currentExpense <= currentIncome && <span className="font-bold">{currentSavingsRate.toFixed(1)}%</span>}
                  {currentExpense <= currentIncome && ". A healthy target is to save at least 20% of your income."}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center mb-6">
            <h2 className="text-gray-900 font-bold text-base w-full mb-6">Expense Breakdown</h2>
            
            {chartData.length > 0 ? (
               <div className="w-full h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip formatter={(val: number) => formatCurrency(val, currencyCode)} />
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
                     <span className="block text-xl font-black text-gray-900">{formatCurrency(currentExpense, currencyCode)}</span>
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                   </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
                  No expense data for {format(activeMonthDate, 'MMM yyyy')}.
              </div>
            )}
            
            <div className="w-full mt-6 space-y-3">
              {chartData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(item.value, currencyCode)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-2">
            <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">Spending Patterns</h3>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
               <p className="text-sm text-gray-600 leading-relaxed mb-4">
                 {topCategory ? `You spent the most on ${topCategory.name} (${Math.round((topCategory.value as number) / currentExpense * 100)}% of your expenses) in ${format(activeMonthDate, 'MMM yyyy')}. ${isSameMonth(activeMonthDate, now) ? 'Keep an eye on it to ensure you stay within your budget.' : ''}` : "We need more data to analyze your spending patterns."}
               </p>
               
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Transaction Reports</h4>
               <div className="flex flex-wrap gap-2">
                  <a href="#history/all" className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors">All Transactions</a>
                  <a href="#history/income" className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors">Income</a>
                  <a href="#history/expense" className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors">Expenses</a>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
