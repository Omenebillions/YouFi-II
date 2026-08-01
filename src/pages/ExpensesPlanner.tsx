import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths, parseISO, startOfMonth } from 'date-fns';
import { formatCurrency } from '../lib/currency';
import { usePrivacy } from '../contexts/PrivacyContext';
import { Plus, Trash2, ChevronLeft, ChevronRight, PieChart, AlertCircle, Edit2, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { motion, AnimatePresence } from 'motion/react';

const EXPENSE_CATEGORIES = [
  'Housing', 'Food', 'Transportation', 'Utilities', 'Insurance', 
  'Healthcare', 'Debt', 'Personal', 'Savings', 'Entertainment', 'Other'
];

const CATEGORY_COLORS: Record<string, string> = {
  'Housing': 'bg-blue-500',
  'Food': 'bg-orange-500',
  'Transportation': 'bg-indigo-500',
  'Utilities': 'bg-yellow-500',
  'Insurance': 'bg-purple-500',
  'Healthcare': 'bg-pink-500',
  'Debt': 'bg-red-500',
  'Personal': 'bg-teal-500',
  'Savings': 'bg-emerald-500',
  'Entertainment': 'bg-cyan-500',
  'Other': 'bg-gray-400'
};

const CATEGORY_BG: Record<string, string> = {
  'Housing': 'bg-blue-50',
  'Food': 'bg-orange-50',
  'Transportation': 'bg-indigo-50',
  'Utilities': 'bg-yellow-50',
  'Insurance': 'bg-purple-50',
  'Healthcare': 'bg-pink-50',
  'Debt': 'bg-red-50',
  'Personal': 'bg-teal-50',
  'Savings': 'bg-emerald-50',
  'Entertainment': 'bg-cyan-50',
  'Other': 'bg-gray-50'
};

export default function ExpensesPlanner() {
  const { user, userProfile } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const currencyCode = userProfile?.currency || 'USD';
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isPromptIncomeModalOpen, setIsPromptIncomeModalOpen] = useState(false);
  
  const [newExpenseCategory, setNewExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonthStr = format(currentDate, 'yyyy-MM');

  const loadBudgets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('period', currentMonthStr);
      
      if (error) throw error;
      
      // Sort to make it deterministic
      const sorted = (data || []).sort((a, b) => b.amount - a.amount);
      setBudgets(sorted);
    } catch (err) {
      console.error("Error loading budgets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [user, currentMonthStr]);

  const expectedIncomeRow = budgets.find(b => b.category === '__EXPECTED_INCOME__');
  const expectedIncome = expectedIncomeRow ? expectedIncomeRow.amount : 0;
  
  const expensePlans = budgets.filter(b => b.category !== '__EXPECTED_INCOME__');
  const totalPlanned = expensePlans.reduce((sum, b) => sum + b.amount, 0);
  const remaining = expectedIncome - totalPlanned;
  const percentageUsed = expectedIncome > 0 ? (totalPlanned / expectedIncome) * 100 : 0;

  const handleSetIncome = async (amount: number) => {
    if (!user) return;
    if (expectedIncomeRow) {
      await supabase.from('budgets').update({ amount }).eq('id', expectedIncomeRow.id);
    } else {
      await supabase.from('budgets').insert({
        user_id: user.id,
        category: '__EXPECTED_INCOME__',
        amount,
        period: currentMonthStr
      });
    }
    loadBudgets();
  };

  const handleAddExpenseClick = () => {
    setIsAddExpenseModalOpen(true);
    setNewExpenseCategory(EXPENSE_CATEGORIES[0]);
    setNewExpenseAmount('');
    setErrorNotification(null);
  };

  const handleSaveExpense = async () => {
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    if (amount > remaining) {
       setErrorNotification(`You can't go over your expected income. You're exceeding it by ${formatCurrency(amount - remaining, currencyCode, false)}.`);
       return;
    }

    await supabase.from('budgets').insert({
      user_id: user?.id,
      category: newExpenseCategory,
      amount,
      period: currentMonthStr
    });
    
    setIsAddExpenseModalOpen(false);
    loadBudgets();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    loadBudgets();
  };

  const promptIncome = () => {
    setIsPromptIncomeModalOpen(true);
    setNewIncomeAmount(expectedIncome > 0 ? expectedIncome.toString() : '');
  };

  const handleSaveIncome = () => {
    const val = parseFloat(newIncomeAmount);
    if (!isNaN(val)) {
      handleSetIncome(val);
      setIsPromptIncomeModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-black text-gray-900 tracking-tight">Expenses Planner</h1>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
         <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
         </button>
         <h2 className="font-bold text-gray-900">{format(currentDate, 'MMMM yyyy')}</h2>
         <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight size={20} className="text-gray-600" />
         </button>
      </div>

      {/* Income & Overview Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-emerald-500" />
         
         <div className="flex justify-between items-start mb-6">
            <div>
               <div className="flex items-center gap-2 mb-1">
                 <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <TrendingUp size={12} />
                 </div>
                 <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Expected Income</p>
               </div>
               <h3 className="text-3xl font-black text-gray-900 mt-1 tracking-tight">
                  {formatCurrency(expectedIncome, currencyCode, isPrivacyMode)}
               </h3>
            </div>
            <button 
              onClick={promptIncome}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors border border-gray-100"
            >
               <Edit2 size={12} />
               {expectedIncome > 0 ? 'Edit' : 'Set Income'}
            </button>
         </div>

         <div className="space-y-4 pt-4 border-t border-gray-50">
            <div className="flex justify-between text-sm font-bold">
               <span className="text-gray-600 flex items-center gap-1.5"><TrendingDown size={14} className="text-orange-500"/> Total Planned</span>
               <span className="text-gray-900">{formatCurrency(totalPlanned, currencyCode, isPrivacyMode)}</span>
            </div>
            
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative">
               <div 
                 className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${percentageUsed >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                 style={{ width: `${Math.min(percentageUsed, 100)}%` }}
               />
               {/* Visual segments for categories */}
               {expensePlans.length > 0 && expectedIncome > 0 && (
                 <div className="absolute top-0 left-0 h-full flex w-full opacity-30">
                    {expensePlans.map((plan, i) => {
                       const width = (plan.amount / expectedIncome) * 100;
                       return (
                         <div key={i} className="h-full border-r border-white/50" style={{ width: `${width}%` }} />
                       )
                    })}
                 </div>
               )}
            </div>
            
            <div className="flex justify-between text-sm font-bold">
               <span className="text-gray-600 flex items-center gap-1.5"><Target size={14} className="text-brand-500"/> Remaining to Plan</span>
               <span className={remaining < 0 ? 'text-red-500' : 'text-emerald-600'}>
                  {formatCurrency(remaining, currencyCode, isPrivacyMode)}
               </span>
            </div>
         </div>
      </div>

      {/* Planned Expenses List */}
      <div className="flex items-center justify-between mt-8 mb-4">
         <h2 className="text-lg font-bold text-gray-900">Budget Breakdown</h2>
         {expectedIncome > 0 && remaining > 0 && (
           <button 
             onClick={handleAddExpenseClick}
             className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 px-4 py-2 rounded-xl shadow-sm hover:bg-brand-700 transition-colors active:scale-95"
           >
             <Plus size={14} /> Add Plan
           </button>
         )}
      </div>

      {expectedIncome === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center">
           <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
             <AlertCircle size={24} className="text-gray-400" />
           </div>
           <h3 className="text-gray-900 font-bold mb-2">No Income Set</h3>
           <p className="text-gray-500 text-sm font-medium mb-6 max-w-[250px]">Set your Expected Income first to start planning your budget.</p>
           <button 
              onClick={promptIncome}
              className="px-6 py-3 bg-brand-600 text-white font-bold text-sm rounded-xl shadow-sm hover:bg-brand-700 transition-colors"
            >
               Set Expected Income
            </button>
        </div>
      ) : expensePlans.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center">
           <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
             <PieChart size={24} className="text-gray-400" />
           </div>
           <h3 className="text-gray-900 font-bold mb-2">Empty Planner</h3>
           <p className="text-gray-500 text-sm font-medium mb-6 max-w-[250px]">You haven't allocated any funds yet. Let's start budgeting.</p>
           <button 
             onClick={handleAddExpenseClick}
             className="px-6 py-3 bg-brand-50 text-brand-700 font-bold text-sm rounded-xl border border-brand-100 hover:bg-brand-100 transition-colors"
           >
             + Add Planned Expense
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {expensePlans.map((plan) => {
             const planPercentage = expectedIncome > 0 ? (plan.amount / expectedIncome) * 100 : 0;
             const colorClass = CATEGORY_COLORS[plan.category] || 'bg-gray-400';
             const bgClass = CATEGORY_BG[plan.category] || 'bg-gray-50';
             
             return (
               <div key={plan.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass} opacity-80`} />
                  <div className="flex items-start justify-between">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${bgClass} ${colorClass.replace('bg-', 'text-')}`}>
                          {planPercentage.toFixed(0)}%
                        </div>
                        <div>
                           <h4 className="font-bold text-gray-900 leading-tight">{plan.category}</h4>
                           <p className="text-xs text-gray-400 font-medium mt-0.5">Allocated</p>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                        <p className="font-black text-gray-900 tracking-tight">
                          {formatCurrency(plan.amount, currencyCode, isPrivacyMode)}
                        </p>
                        <button 
                          onClick={() => handleDelete(plan.id)}
                          className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                     </div>
                  </div>
                  
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4 overflow-hidden">
                     <div 
                       className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
                       style={{ width: `${Math.min(planPercentage, 100)}%` }}
                     />
                  </div>
               </div>
             )
           })}
        </div>
      )}

      {/* Inline Modals */}
      <AnimatePresence>
        {isPromptIncomeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                    <Target size={20} />
                 </div>
                 <h2 className="text-xl font-bold">Expected Income</h2>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-6">Set your expected total income for {format(currentDate, 'MMMM yyyy')} to use as a baseline for budgeting.</p>
              
              <div className="relative mb-6">
                 <span className="absolute left-4 top-4 text-gray-400 font-bold">{currencyCode === 'USD' ? '$' : currencyCode}</span>
                 <input 
                   type="number" 
                   placeholder="0.00"
                   value={newIncomeAmount}
                   onChange={e => setNewIncomeAmount(e.target.value)}
                   className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-4 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                 />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPromptIncomeModalOpen(false)}
                  className="w-1/2 py-3.5 font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveIncome}
                  disabled={!newIncomeAmount}
                  className="w-1/2 py-3.5 font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddExpenseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                    <PieChart size={20} />
                 </div>
                 <h2 className="text-xl font-bold">Allocate Budget</h2>
              </div>
              
              <AnimatePresence>
                 {errorNotification && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                     animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                     exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                     className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-start gap-2 overflow-hidden border border-red-100"
                   >
                     <AlertCircle size={18} className="shrink-0 mt-0.5" />
                     <span>{errorNotification}</span>
                   </motion.div>
                 )}
              </AnimatePresence>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                    <select 
                      value={newExpenseCategory}
                      onChange={(e) => {
                        setNewExpenseCategory(e.target.value);
                        if (errorNotification) setErrorNotification(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none"
                    >
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div>
                    <div className="flex justify-between items-end mb-2">
                       <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</label>
                       <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                         Avail: {formatCurrency(remaining, currencyCode, false)}
                       </span>
                    </div>
                    <div className="relative">
                       <span className="absolute left-4 top-4 text-gray-400 font-bold">{currencyCode === 'USD' ? '$' : currencyCode}</span>
                       <input 
                         type="number" 
                         placeholder="0.00"
                         value={newExpenseAmount}
                         onChange={(e) => {
                           setNewExpenseAmount(e.target.value);
                           if (errorNotification) setErrorNotification(null);
                         }}
                         className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-14 pr-4 py-4 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                       />
                    </div>
                 </div>
                 <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setIsAddExpenseModalOpen(false)}
                      className="w-1/2 py-3.5 font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveExpense}
                      disabled={!newExpenseAmount}
                      className="w-1/2 py-3.5 font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      Save Plan
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
