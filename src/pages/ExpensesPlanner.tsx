import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths, parseISO, startOfMonth } from 'date-fns';
import { formatCurrency } from '../lib/currency';
import { usePrivacy } from '../contexts/PrivacyContext';
import { Plus, Trash2, ChevronLeft, ChevronRight, PieChart, AlertCircle } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { motion, AnimatePresence } from 'motion/react';

const EXPENSE_CATEGORIES = [
  'Housing', 'Food', 'Transportation', 'Utilities', 'Insurance', 
  'Healthcare', 'Debt', 'Personal', 'Savings', 'Entertainment', 'Other'
];

export default function ExpensesPlanner() {
  const { user, userProfile } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const currencyCode = userProfile?.currency || 'USD';
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isPromptIncomeModalOpen, setIsPromptIncomeModalOpen] = useState(false);
  
  // Create refs or states for inputs if needed
  const [newExpenseCategory, setNewExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive current month string: 'YYYY-MM'
  const currentMonthStr = format(currentDate, 'yyyy-MM');

  // Load budgets for this month
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
      setBudgets(data || []);
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
       setErrorNotification(`You can't go over your expected income. You're exceeding it by ${formatCurrency(amount - remaining, currencyCode, false)}. `);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-black text-gray-900 tracking-tight">Expenses Planner</h1>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
         <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100">
            <ChevronLeft size={20} className="text-gray-600" />
         </button>
         <h2 className="font-bold text-gray-900">{format(currentDate, 'MMMM yyyy')}</h2>
         <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100">
            <ChevronRight size={20} className="text-gray-600" />
         </button>
      </div>

      {/* Income & Overview Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-emerald-500" />
         
         <div className="flex justify-between items-center mb-6">
            <div>
               <p className="text-sm font-medium text-gray-500">Expected Income</p>
               <h3 className="text-2xl font-black text-gray-900">
                  {formatCurrency(expectedIncome, currencyCode, isPrivacyMode)}
               </h3>
            </div>
            <button 
              onClick={promptIncome}
              className="px-4 py-2 bg-brand-50 text-brand-700 font-bold text-sm rounded-xl"
            >
               {expectedIncome > 0 ? 'Edit' : 'Set Income'}
            </button>
         </div>

         <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium">
               <span className="text-gray-600">Total Planned</span>
               <span className="text-gray-900">{formatCurrency(totalPlanned, currencyCode, isPrivacyMode)}</span>
            </div>
            
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
               <div 
                 className={`h-full rounded-full transition-all duration-500 ${percentageUsed >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                 style={{ width: `${Math.min(percentageUsed, 100)}%` }}
               />
            </div>
            
            <div className="flex justify-between text-sm font-medium">
               <span className="text-gray-600">Remaining to Plan</span>
               <span className={remaining < 0 ? 'text-red-500' : 'text-emerald-600'}>
                  {formatCurrency(remaining, currencyCode, isPrivacyMode)}
               </span>
            </div>
         </div>
      </div>

      {/* Planned Expenses List */}
      <div className="flex items-center justify-between mt-8 mb-4">
         <h2 className="text-lg font-bold text-gray-900">Planned Expenses</h2>
         {expectedIncome > 0 && remaining > 0 && (
           <button 
             onClick={handleAddExpenseClick}
             className="flex items-center gap-1.5 text-sm font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-xl"
           >
             <Plus size={16} /> Add 
           </button>
         )}
      </div>

      {expectedIncome === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100 border-dashed">
           <AlertCircle size={32} className="mx-auto text-gray-400 mb-2" />
           <p className="text-gray-500 font-medium">Set your Expected Income first to start planning.</p>
        </div>
      ) : expensePlans.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100 border-dashed">
           <PieChart size={32} className="mx-auto text-gray-400 mb-2" />
           <p className="text-gray-500 font-medium">No expenses planned yet.</p>
           <button 
             onClick={handleAddExpenseClick}
             className="mt-4 text-brand-600 font-bold"
           >
             + Add your first planned expense
           </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
           {expensePlans.map((plan, i) => (
             <div key={plan.id} className={`flex items-center justify-between p-5 ${i !== expensePlans.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div>
                   <h4 className="font-bold text-gray-900">{plan.category}</h4>
                </div>
                <div className="flex items-center gap-4">
                   <p className="font-bold text-gray-900">
                     {formatCurrency(plan.amount, currencyCode, isPrivacyMode)}
                   </p>
                   <button 
                     onClick={() => handleDelete(plan.id)}
                     className="text-gray-400 hover:text-red-500 transition-colors"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      {/* Inline Modals */}
      <AnimatePresence>
        {isPromptIncomeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="text-xl font-bold mb-4">Set Expected Income</h2>
              <p className="text-sm text-gray-600 mb-4">How much total income do you expect for {format(currentDate, 'MMMM yyyy')}?</p>
              <input 
                type="number" 
                placeholder="0.00"
                value={newIncomeAmount}
                onChange={e => setNewIncomeAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPromptIncomeModalOpen(false)}
                  className="w-1/2 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveIncome}
                  className="w-1/2 py-3 font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddExpenseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="text-xl font-bold mb-4">Add Planned Expense</h2>
              <AnimatePresence>
                 {errorNotification && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                     animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                     exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                     className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium flex items-start gap-2 overflow-hidden"
                   >
                     <AlertCircle size={18} className="shrink-0 mt-0.5" />
                     <span>{errorNotification}</span>
                   </motion.div>
                 )}
              </AnimatePresence>
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select 
                      value={newExpenseCategory}
                      onChange={(e) => {
                        setNewExpenseCategory(e.target.value);
                        if (errorNotification) setErrorNotification(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={newExpenseAmount}
                      onChange={(e) => {
                        setNewExpenseAmount(e.target.value);
                        if (errorNotification) setErrorNotification(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Available: {formatCurrency(remaining, currencyCode, false)}</p>
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setIsAddExpenseModalOpen(false)}
                      className="w-1/2 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveExpense}
                      className="w-1/2 py-3 font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
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
