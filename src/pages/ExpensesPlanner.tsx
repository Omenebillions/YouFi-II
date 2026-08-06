import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { formatCurrency } from '../lib/currency';
import { usePrivacy } from '../contexts/PrivacyContext';
import { 
  Plus, Trash2, ChevronLeft, ChevronRight, PieChart, AlertCircle, Edit2, 
  TrendingUp, TrendingDown, Target, ChevronDown, ChevronUp, CheckSquare, Square, CheckCircle2, ListPlus, DollarSign, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  isIncomeRow, parseIncomeRow, serializeIncomeCategory, 
  parseExpensePlanRow, serializeExpensePlanCategory, 
  ParsedIncomeSource, ParsedExpensePlan, PlanSubItem 
} from '../lib/expensesPlanner';

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
  'Housing': 'bg-blue-50 text-blue-700 border-blue-100',
  'Food': 'bg-orange-50 text-orange-700 border-orange-100',
  'Transportation': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Utilities': 'bg-yellow-50 text-yellow-700 border-yellow-100',
  'Insurance': 'bg-purple-50 text-purple-700 border-purple-100',
  'Healthcare': 'bg-pink-50 text-pink-700 border-pink-100',
  'Debt': 'bg-red-50 text-red-700 border-red-100',
  'Personal': 'bg-teal-50 text-teal-700 border-teal-100',
  'Savings': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Entertainment': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  'Other': 'bg-gray-50 text-gray-700 border-gray-100'
};

export default function ExpensesPlanner() {
  const { user, userProfile } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const currencyCode = userProfile?.currency || 'USD';

  // State
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded cards state
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});

  // Inline Sub-item Editing on Card State
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubAmount, setEditSubAmount] = useState('');

  // Modal Sub-item Editing State
  const [editingModalSubId, setEditingModalSubId] = useState<string | null>(null);

  // Card Sub-item Editing Actions
  const handleStartEditingSubItem = (sub: PlanSubItem) => {
    setEditingSubId(sub.id);
    setEditSubName(sub.name);
    setEditSubAmount(sub.amount.toString());
  };

  const handleSaveSubItemEdit = async (plan: ParsedExpensePlan, subId: string) => {
    if (!editSubName.trim()) return;
    const newAmt = parseFloat(editSubAmount) || 0;
    
    const updatedSubs = plan.subItems.map(s => 
      s.id === subId ? { ...s, name: editSubName.trim(), amount: newAmt } : s
    );

    const serialized = serializeExpensePlanCategory(plan.category, plan.name, updatedSubs, plan.notes);

    await supabase
      .from('budgets')
      .update({ category: serialized })
      .eq('id', plan.id);

    setEditingSubId(null);
    setEditSubName('');
    setEditSubAmount('');
    loadBudgets();
  };

  const handleDeleteSubItemCard = async (plan: ParsedExpensePlan, subId: string) => {
    const updatedSubs = plan.subItems.filter(s => s.id !== subId);
    const serialized = serializeExpensePlanCategory(plan.category, plan.name, updatedSubs, plan.notes);

    await supabase
      .from('budgets')
      .update({ category: serialized })
      .eq('id', plan.id);

    loadBudgets();
  };

  // Modal Sub-item Editing Actions
  const handleStartEditSubItemInModal = (sub: PlanSubItem) => {
    setEditingModalSubId(sub.id);
    setNewSubName(sub.name);
    setNewSubAmount(sub.amount.toString());
  };

  const handleSaveSubItemInModal = () => {
    if (!editingModalSubId || !newSubName.trim()) return;
    const subAmount = parseFloat(newSubAmount) || 0;
    setPlanSubItems(prev => prev.map(s => 
      s.id === editingModalSubId ? { ...s, name: newSubName.trim(), amount: subAmount } : s
    ));
    setEditingModalSubId(null);
    setNewSubName('');
    setNewSubAmount('');
  };

  const handleCancelSubItemInModal = () => {
    setEditingModalSubId(null);
    setNewSubName('');
    setNewSubAmount('');
  };

  // Income Modal State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<ParsedIncomeSource | null>(null);
  const [incomeName, setIncomeName] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');

  // Plan Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ParsedExpensePlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planCategory, setPlanCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [planAmount, setPlanAmount] = useState('');
  const [planSubItems, setPlanSubItems] = useState<PlanSubItem[]>([]);
  
  // Quick sub-item input in modal
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');

  // Inline quick sub-item input on card
  const [inlineSubName, setInlineSubName] = useState<Record<string, string>>({});
  const [inlineSubAmount, setInlineSubAmount] = useState<Record<string, string>>({});

  const [errorNotification, setErrorNotification] = useState<string | null>(null);

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

  // Derived Income Sources and Expense Plans
  const incomeSources: ParsedIncomeSource[] = budgets
    .filter(b => isIncomeRow(b.category))
    .map(parseIncomeRow);

  const expectedIncome = incomeSources.reduce((sum, inc) => sum + inc.amount, 0);

  const expensePlans: ParsedExpensePlan[] = budgets
    .filter(b => b.category !== '__AI_TOKENS__' && !isIncomeRow(b.category))
    .map(parseExpensePlanRow)
    .sort((a, b) => b.amount - a.amount);

  const totalPlanned = expensePlans.reduce((sum, p) => sum + p.amount, 0);
  const remaining = expectedIncome - totalPlanned;
  const percentageUsed = expectedIncome > 0 ? (totalPlanned / expectedIncome) * 100 : 0;

  // Handlers for Income
  const handleOpenAddIncome = () => {
    setEditingIncome(null);
    setIncomeName('');
    setIncomeSource('');
    setIncomeAmount('');
    setErrorNotification(null);
    setIsIncomeModalOpen(true);
  };

  const handleOpenEditIncome = (inc: ParsedIncomeSource) => {
    setEditingIncome(inc);
    setIncomeName(inc.name);
    setIncomeSource(inc.source || '');
    setIncomeAmount(inc.amount.toString());
    setErrorNotification(null);
    setIsIncomeModalOpen(true);
  };

  const handleSaveIncome = async () => {
    const amount = parseFloat(incomeAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorNotification('Please enter a valid positive amount.');
      return;
    }
    const nameToSave = incomeName.trim() || 'Expected Income';
    const serializedCategory = serializeIncomeCategory(nameToSave, incomeSource);

    if (editingIncome) {
      await supabase
        .from('budgets')
        .update({ category: serializedCategory, amount })
        .eq('id', editingIncome.id);
    } else {
      await supabase.from('budgets').insert({
        user_id: user?.id,
        category: serializedCategory,
        amount,
        period: currentMonthStr
      });
    }

    setIsIncomeModalOpen(false);
    loadBudgets();
  };

  const handleDeleteIncome = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    loadBudgets();
  };

  // Handlers for Expense Plans
  const handleOpenAddPlan = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanCategory(EXPENSE_CATEGORIES[0]);
    setPlanAmount('');
    setPlanSubItems([]);
    setNewSubName('');
    setNewSubAmount('');
    setErrorNotification(null);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: ParsedExpensePlan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanCategory(plan.category);
    setPlanAmount(plan.amount.toString());
    setPlanSubItems(plan.subItems || []);
    setNewSubName('');
    setNewSubAmount('');
    setErrorNotification(null);
    setIsPlanModalOpen(true);
  };

  const handleAddSubItemInModal = () => {
    if (!newSubName.trim()) return;
    const subAmount = parseFloat(newSubAmount) || 0;
    const newItem: PlanSubItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name: newSubName.trim(),
      amount: subAmount,
      completed: false
    };
    setPlanSubItems(prev => [...prev, newItem]);
    setNewSubName('');
    setNewSubAmount('');
  };

  const handleRemoveSubItemInModal = (id: string) => {
    setPlanSubItems(prev => prev.filter(s => s.id !== id));
  };

  const handleAutoSetPlanAmountFromSubs = () => {
    const subTotal = planSubItems.reduce((acc, item) => acc + item.amount, 0);
    if (subTotal > 0) {
      setPlanAmount(subTotal.toString());
    }
  };

  const handleSavePlan = async () => {
    const amount = parseFloat(planAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorNotification('Please enter a valid plan amount.');
      return;
    }

    const availableForThis = remaining + (editingPlan ? editingPlan.amount : 0);
    if (amount > availableForThis) {
      setErrorNotification(
        `Amount exceeds remaining expected income by ${formatCurrency(amount - availableForThis, currencyCode, false)}.`
      );
      return;
    }

    const nameToSave = planName.trim() || planCategory;
    const serializedCategory = serializeExpensePlanCategory(planCategory, nameToSave, planSubItems);

    if (editingPlan) {
      await supabase
        .from('budgets')
        .update({ category: serializedCategory, amount })
        .eq('id', editingPlan.id);
    } else {
      await supabase.from('budgets').insert({
        user_id: user?.id,
        category: serializedCategory,
        amount,
        period: currentMonthStr
      });
    }

    setIsPlanModalOpen(false);
    loadBudgets();
  };

  const handleDeletePlan = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    loadBudgets();
  };

  // Toggle Sub-item completion directly on Plan Card
  const handleToggleSubItemCompletion = async (plan: ParsedExpensePlan, subId: string) => {
    const updatedSubs = plan.subItems.map(s => 
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    const serialized = serializeExpensePlanCategory(plan.category, plan.name, updatedSubs, plan.notes);

    await supabase
      .from('budgets')
      .update({ category: serialized })
      .eq('id', plan.id);

    loadBudgets();
  };

  // Inline Quick Add Sub-item on Card
  const handleInlineAddSubItem = async (plan: ParsedExpensePlan) => {
    const sName = (inlineSubName[plan.id] || '').trim();
    if (!sName) return;

    const sAmt = parseFloat(inlineSubAmount[plan.id] || '0') || 0;
    const newSub: PlanSubItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name: sName,
      amount: sAmt,
      completed: false
    };

    const updatedSubs = [...plan.subItems, newSub];
    const serialized = serializeExpensePlanCategory(plan.category, plan.name, updatedSubs, plan.notes);

    await supabase
      .from('budgets')
      .update({ category: serialized })
      .eq('id', plan.id);

    setInlineSubName(prev => ({ ...prev, [plan.id]: '' }));
    setInlineSubAmount(prev => ({ ...prev, [plan.id]: '' }));
    loadBudgets();
  };

  const toggleExpandPlan = (planId: string) => {
    setExpandedPlanIds(prev => ({ ...prev, [planId]: !prev[planId] }));
  };

  return (
    <div className="space-y-6 pb-36 sm:pb-48 mb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Expenses Planner</h1>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">Plan and manage monthly income allocations & expenses</p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        <button 
          onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
          className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-bold text-gray-900">{format(currentDate, 'MMMM yyyy')}</h2>
        <button 
          onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
          className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Income & Overview Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden space-y-6">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 to-emerald-500" />

        {/* Expected Income Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp size={12} />
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Expected Income</p>
            </div>
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">
              {formatCurrency(expectedIncome, currencyCode, isPrivacyMode)}
            </h3>
          </div>
          <button 
            onClick={handleOpenAddIncome}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
          >
            <Plus size={14} />
            Add Income Source
          </button>
        </div>

        {/* Income Sources List */}
        {incomeSources.length > 0 && (
          <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Wallet size={12} /> Income Sources ({incomeSources.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {incomeSources.map(inc => (
                <div key={inc.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between shadow-2xs group">
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">{inc.name}</h4>
                    {inc.source && <p className="text-[10px] text-gray-400 font-medium">{inc.source}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-emerald-600">
                      {formatCurrency(inc.amount, currencyCode, isPrivacyMode)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenEditIncome(inc)}
                        className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Edit Income Source"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={() => handleDeleteIncome(inc.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Income Source"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget Allocation Progress */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-gray-600 flex items-center gap-1.5">
              <TrendingDown size={14} className="text-orange-500"/> Total Planned
            </span>
            <span className="text-gray-900">{formatCurrency(totalPlanned, currencyCode, isPrivacyMode)}</span>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative">
            <div 
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${percentageUsed >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            />
            {expensePlans.length > 0 && expectedIncome > 0 && (
              <div className="absolute top-0 left-0 h-full flex w-full opacity-30">
                {expensePlans.map((plan, i) => {
                  const width = (plan.amount / expectedIncome) * 100;
                  return (
                    <div key={i} className="h-full border-r border-white/60" style={{ width: `${width}%` }} />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between text-sm font-bold">
            <span className="text-gray-600 flex items-center gap-1.5">
              <Target size={14} className="text-brand-500"/> Remaining to Plan
            </span>
            <span className={remaining < 0 ? 'text-red-500' : 'text-emerald-600'}>
              {formatCurrency(remaining, currencyCode, isPrivacyMode)}
            </span>
          </div>
        </div>
      </div>

      {/* Planned Expenses List Header */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Budget Breakdown</h2>
          <p className="text-xs font-medium text-gray-400">Assigned plans and sub-expenses</p>
        </div>
        {expectedIncome > 0 && (
          <button 
            onClick={handleOpenAddPlan}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 px-4 py-2.5 rounded-xl shadow-sm hover:bg-brand-700 transition-colors active:scale-95"
          >
            <Plus size={14} /> Add Plan
          </button>
        )}
      </div>

      {/* State Renderings */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 font-medium">Loading plans...</div>
      ) : expectedIncome === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-600">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-gray-900 font-bold mb-2">No Income Sources Added</h3>
          <p className="text-gray-500 text-sm font-medium mb-6 max-w-[280px]">Add your expected income source(s) first to start budgeting your expenses.</p>
          <button 
            onClick={handleOpenAddIncome}
            className="px-6 py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Add Income Source
          </button>
        </div>
      ) : expensePlans.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <PieChart size={24} className="text-gray-400" />
          </div>
          <h3 className="text-gray-900 font-bold mb-2">Empty Planner</h3>
          <p className="text-gray-500 text-sm font-medium mb-6 max-w-[280px]">You haven't allocated any budget plans yet. Create your first plan with custom subs!</p>
          <button 
            onClick={handleOpenAddPlan}
            className="px-6 py-3 bg-brand-50 text-brand-700 font-bold text-sm rounded-xl border border-brand-100 hover:bg-brand-100 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Add Budget Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {expensePlans.map((plan) => {
            const planPercentage = expectedIncome > 0 ? (plan.amount / expectedIncome) * 100 : 0;
            const colorClass = CATEGORY_COLORS[plan.category] || 'bg-gray-400';
            const bgClass = CATEGORY_BG[plan.category] || 'bg-gray-50 text-gray-700 border-gray-100';
            const isExpanded = !!expandedPlanIds[plan.id];

            const subTotal = (plan.subItems || []).reduce((sum, s) => sum + s.amount, 0);
            const completedSubsCount = (plan.subItems || []).filter(s => s.completed).length;

            return (
              <div 
                key={plan.id} 
                className="bg-white rounded-3xl border border-gray-100 shadow-xs hover:shadow-md transition-all overflow-hidden"
              >
                {/* Main Card Section */}
                <div className="p-5 relative">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass} opacity-90`} />

                  <div className="flex items-start justify-between gap-3">
                    {/* Left Details */}
                    <div className="flex items-start gap-3.5">
                      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black text-xs shrink-0 ${colorClass} text-white shadow-xs`}>
                        <span>{planPercentage.toFixed(0)}%</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-base leading-snug">{plan.name}</h3>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${bgClass}`}>
                            {plan.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-2">
                          <span>Allocated Plan</span>
                          {plan.subItems && plan.subItems.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-brand-600 font-bold flex items-center gap-1">
                                <ListPlus size={12} /> {completedSubsCount}/{plan.subItems.length} subs ({formatCurrency(subTotal, currencyCode, isPrivacyMode)})
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right Amount & Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="font-black text-lg text-gray-900 tracking-tight">
                        {formatCurrency(plan.amount, currencyCode, isPrivacyMode)}
                      </p>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleOpenEditPlan(plan)}
                          className="p-1.5 rounded-xl bg-gray-50 text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Edit Plan"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-1.5 rounded-xl bg-gray-50 text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={() => toggleExpandPlan(plan.id)}
                          className={`p-1.5 rounded-xl transition-colors ${isExpanded ? 'bg-brand-50 text-brand-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                          title="Toggle Subs Breakdown"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Allocation Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
                      style={{ width: `${Math.min(planPercentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Sub-items Section */}
                {isExpanded && (
                  <div className="bg-gray-50/70 border-t border-gray-100 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                        <ListPlus size={14} className="text-brand-600" />
                        Sub-Expenses Breakdown
                      </p>
                      {subTotal > 0 && (
                        <span className="text-xs font-bold text-gray-500">
                          Subtotal: <span className="text-gray-900">{formatCurrency(subTotal, currencyCode, isPrivacyMode)}</span> / {formatCurrency(plan.amount, currencyCode, isPrivacyMode)}
                        </span>
                      )}
                    </div>

                    {/* Sub-items List */}
                    {plan.subItems && plan.subItems.length > 0 ? (
                      <div className="space-y-1.5">
                        {plan.subItems.map((sub) => {
                          const isEditingThisSub = editingSubId === sub.id;

                          if (isEditingThisSub) {
                            return (
                              <div key={sub.id} className="p-2 bg-white rounded-xl border border-brand-300 shadow-xs flex items-center gap-2">
                                <input 
                                  type="text"
                                  value={editSubName}
                                  onChange={(e) => setEditSubName(e.target.value)}
                                  placeholder="Sub name"
                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                <input 
                                  type="number"
                                  value={editSubAmount}
                                  onChange={(e) => setEditSubAmount(e.target.value)}
                                  placeholder="Amt"
                                  className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                <button 
                                  onClick={() => handleSaveSubItemEdit(plan, sub.id)}
                                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg transition-colors"
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setEditingSubId(null)}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={sub.id} 
                              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                                sub.completed 
                                  ? 'bg-emerald-50/50 border-emerald-100 text-gray-400' 
                                  : 'bg-white border-gray-200 text-gray-900' 
                              }`}
                            >
                              <div 
                                className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                                onClick={() => handleToggleSubItemCompletion(plan, sub.id)}
                              >
                                {sub.completed ? (
                                  <CheckSquare size={16} className="text-emerald-600 shrink-0" />
                                ) : (
                                  <Square size={16} className="text-gray-400 shrink-0" />
                                )}
                                <span className={`text-xs font-bold truncate ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                  {sub.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-bold ${sub.completed ? 'text-emerald-600' : 'text-gray-900'}`}>
                                  {formatCurrency(sub.amount, currencyCode, isPrivacyMode)}
                                </span>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditingSubItem(sub);
                                  }}
                                  className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                  title="Edit Sub-expense"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubItemCard(plan, sub.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Sub-expense"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 font-medium italic">No sub-items added yet.</p>
                    )}

                    {/* Quick Inline Add Sub Item */}
                    <div className="pt-2 border-t border-gray-200/60 flex items-center gap-2">
                      <input 
                        type="text"
                        placeholder="Sub-expense name (e.g. Water Bill)"
                        value={inlineSubName[plan.id] || ''}
                        onChange={(e) => setInlineSubName({ ...inlineSubName, [plan.id]: e.target.value })}
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <input 
                        type="number"
                        placeholder="Amount"
                        value={inlineSubAmount[plan.id] || ''}
                        onChange={(e) => setInlineSubAmount({ ...inlineSubAmount, [plan.id]: e.target.value })}
                        className="w-24 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <button 
                        onClick={() => handleInlineAddSubItem(plan)}
                        disabled={!(inlineSubName[plan.id] || '').trim()}
                        className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors shrink-0"
                      >
                        + Add Sub
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Income Source Modal */}
      <AnimatePresence>
        {isIncomeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingIncome ? 'Edit Income Source' : 'Add Income Source'}
                  </h2>
                  <p className="text-xs font-medium text-gray-400">Specify income name and amount for {format(currentDate, 'MMMM yyyy')}</p>
                </div>
              </div>

              {errorNotification && (
                <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorNotification}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Income Name / Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Primary Job, Side Hustle, Rental"
                    value={incomeName}
                    onChange={e => {
                      setIncomeName(e.target.value);
                      if (errorNotification) setErrorNotification(null);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Company / Source (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Acme Corp, Etsy Shop"
                    value={incomeSource}
                    onChange={e => setIncomeSource(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Expected Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-400 font-bold">{currencyCode === 'USD' ? '$' : currencyCode}</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={incomeAmount}
                      onChange={e => {
                        setIncomeAmount(e.target.value);
                        if (errorNotification) setErrorNotification(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsIncomeModalOpen(false)}
                  className="w-1/2 py-3 font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-xs"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveIncome}
                  disabled={!incomeAmount}
                  className="w-1/2 py-3 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 text-xs"
                >
                  Save Income
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Plan Allocation & Subs Modal */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl my-8 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <PieChart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingPlan ? 'Edit Budget Plan' : 'Add Budget Plan'}
                  </h2>
                  <p className="text-xs font-medium text-gray-400">Configure plan name, category & sub-expenses</p>
                </div>
              </div>

              {errorNotification && (
                <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorNotification}</span>
                </div>
              )}

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Plan Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Plan Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Apartment Rent & Bills, Monthly Groceries"
                    value={planName}
                    onChange={(e) => {
                      setPlanName(e.target.value);
                      if (errorNotification) setErrorNotification(null);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                  <select 
                    value={planCategory}
                    onChange={(e) => {
                      setPlanCategory(e.target.value);
                      if (errorNotification) setErrorNotification(null);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Plan Total Amount */}
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Plan Total Amount</label>
                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                      Avail: {formatCurrency(remaining + (editingPlan ? editingPlan.amount : 0), currencyCode, false)}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-400 font-bold">{currencyCode === 'USD' ? '$' : currencyCode}</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={planAmount}
                      onChange={(e) => {
                        setPlanAmount(e.target.value);
                        if (errorNotification) setErrorNotification(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                  </div>
                </div>

                {/* Sub-Items / Sub-Expenses Section */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <ListPlus size={14} className="text-brand-600" />
                      Sub-Expenses ("Subs")
                    </label>
                    {planSubItems.length > 0 && (
                      <button 
                        type="button"
                        onClick={handleAutoSetPlanAmountFromSubs}
                        className="text-[10px] font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-lg transition-colors"
                      >
                        Set Total = Sum of Subs ({formatCurrency(planSubItems.reduce((a, b) => a + b.amount, 0), currencyCode, false)})
                      </button>
                    )}
                  </div>

                  {/* List of sub-items */}
                  {planSubItems.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {planSubItems.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200/80 text-xs">
                          <span className="font-bold text-gray-800 truncate mr-2">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-gray-900">{formatCurrency(s.amount, currencyCode, false)}</span>
                            <button 
                              type="button"
                              onClick={() => handleStartEditSubItemInModal(s)}
                              className="text-gray-400 hover:text-brand-600 p-0.5 rounded-md transition-colors"
                              title="Edit sub-expense"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleRemoveSubItemInModal(s.id)}
                              className="text-gray-400 hover:text-red-500 p-0.5 rounded-md transition-colors"
                              title="Delete sub-expense"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add / Edit sub-item inputs */}
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Sub name (e.g. Base Rent)"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <input 
                      type="number"
                      placeholder="Amt"
                      value={newSubAmount}
                      onChange={(e) => setNewSubAmount(e.target.value)}
                      className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    {editingModalSubId ? (
                      <div className="flex gap-1 shrink-0">
                        <button 
                          type="button"
                          onClick={handleSaveSubItemInModal}
                          disabled={!newSubName.trim()}
                          className="px-2.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-colors"
                        >
                          Update
                        </button>
                        <button 
                          type="button"
                          onClick={handleCancelSubItemInModal}
                          className="px-2 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={handleAddSubItemInModal}
                        disabled={!newSubName.trim()}
                        className="px-3 py-2 bg-gray-900 text-white hover:bg-black font-bold text-xs rounded-xl disabled:opacity-40 transition-colors shrink-0"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button 
                  onClick={() => setIsPlanModalOpen(false)}
                  className="w-1/2 py-3.5 font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-xs"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSavePlan}
                  disabled={!planAmount}
                  className="w-1/2 py-3.5 font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50 text-xs"
                >
                  Save Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
