import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions } from '../services/db';
import { Bell, ShoppingBag, HeartPulse, Wallet, ArrowDown, CreditCard, BarChart3, TrendingUp } from 'lucide-react';
import { isSameMonth } from 'date-fns';
import { formatCurrency } from '../lib/currency';

export default function Dashboard() {
  const { userProfile, user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);
  
  const loadData = async () => {
    setLoading(true);
    const data = await fetchTransactions(user!.uid);
    setTransactions(data || []);
    setLoading(false);
  };
  
  const currencyCode = userProfile?.currency || 'USD';

  // Dynamic Balance Calculations
  const allIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const allExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
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
  const debtsTotal = transactions.filter(t => t.type === 'debt').reduce((acc, t) => acc + t.amount, 0);

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
    ? `Highest spend this month: ${topExpenseCategory[0].charAt(0).toUpperCase() + topExpenseCategory[0].slice(1)} (${formatCurrency(topExpenseCategory[1] as number, currencyCode)})` 
    : "Track your expenses to see insights!";

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc] pb-8 tracking-tight px-6 pt-12 relative overflow-x-hidden">
      {/* Header Context */}
      <div className="flex justify-between items-center mb-8 pr-12">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
                <TrendingUp size={22} />
             </div>
             <div>
               <p className="text-gray-500 font-medium text-xs mb-0.5">Good Morning</p>
               <h1 className="text-xl font-bold text-gray-900">{userProfile?.name?.split(' ')[0] || 'John'}</h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
              <Bell size={18} />
            </button>
          </div>
      </div>
      
      {/* Dark Balance Card */}
      <div className="bg-[#21232c] rounded-[24px] p-6 text-white shadow-xl relative overflow-hidden mb-6">
        <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-bl-full pointer-events-none -mt-4 -mr-4 blur-xl"></div>
        <div className="absolute top-6 right-6 flex gap-1">
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
        
        <div className="relative z-10">
          <h2 className="text-[32px] font-bold tracking-tight mb-1">
            {formatCurrency(totalBalance, currencyCode)}
          </h2>
          <p className="text-gray-400 text-sm font-medium mb-6">Balance</p>
          
          {/* Progress / Status line */}
          <div className="h-1.5 w-full bg-white/10 rounded-full mb-6 overflow-hidden">
             <div className="h-full w-1/2 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full"></div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm font-medium tracking-widest">**** **** 302</p>
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-red-500 opacity-80 mix-blend-multiply"></div>
              <div className="w-6 h-6 rounded-full bg-yellow-500 opacity-80 mix-blend-multiply"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Current Month Overview */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">This Month's Flow</h2>
      </div>

      {/* Mini Insight */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-start gap-3">
         <div className="mt-0.5 text-blue-500">
            <BarChart3 size={16} />
         </div>
         <p className="text-xs font-medium text-blue-800 leading-relaxed">
            {insightMessage}
         </p>
      </div>

      {/* Income / Expense Cards */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 bg-[#ede9fe] rounded-[20px] p-4 flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center mb-4">
             <ArrowDown size={18} className="rotate-180" />
          </div>
          <div>
             <p className="text-gray-600 text-xs font-medium mb-1">Income</p>
             <h3 className="text-xl font-bold text-gray-900">{formatCurrency(incomeTotal, currencyCode)}</h3>
          </div>
        </div>
        <div className="flex-1 bg-[#fff0e6] rounded-[20px] p-4 flex flex-col justify-between">
          <div className="w-10 h-10 rounded-xl bg-orange-400 text-white flex items-center justify-center mb-4">
             <ArrowDown size={18} />
          </div>
          <div>
             <p className="text-gray-600 text-xs font-medium mb-1">Expense</p>
             <h3 className="text-xl font-bold text-gray-900">{formatCurrency(expenseTotal, currencyCode)}</h3>
          </div>
        </div>
      </div>

      {/* Debts Card */}
      <div className="bg-[#fee2e2] rounded-[20px] p-4 flex items-center justify-between mb-8 shadow-sm">
         <div className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-inner">
               <CreditCard size={18} />
            </div>
            <div>
              <p className="text-gray-700 text-xs font-medium mb-1">Total Debts</p>
              <h3 className="text-xl font-bold text-gray-900">{formatCurrency(debtsTotal, currencyCode)}</h3>
            </div>
         </div>
      </div>
      
      {/* Recent Transactions */}
      <div>
         <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Transaction</h2>
          <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full">View All</span>
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
              const txAmountFormatted = formatCurrency(Math.abs(tx.amount), currencyCode);
              
              return (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} ${text}`}>
                        {icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 capitalize">{tx.category}</h4>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{tx.note || (tx.type === 'debt' ? 'Debt' : 'Transaction')}</p>
                      </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${tx.type === 'income' ? 'text-success-500' : 'text-danger-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{txAmountFormatted}
                    </div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mt-1">10:35 AM</p>
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
