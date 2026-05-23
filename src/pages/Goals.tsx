import React, { useEffect, useState, useMemo } from 'react';
import { Target, Plus, Flag, Briefcase, CalendarCheck, CheckSquare, Sparkles, X, Loader2, ChevronDown, ChevronUp, CheckCircle, Circle, Trash2, Edit2 } from 'lucide-react';
import { getGoals, addGoal, updateGoal, deleteGoal, getPlans, addPlan, updatePlan, deletePlan, fetchTransactions } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/currency';
import { GoogleGenAI, Type } from '@google/genai';
import { motivationQuotes } from '../lib/quotes';

// Removed client-side GoogleGenAI

export default function Goals() {
  const { user, userProfile } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'goals' | 'plans'>('goals');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  
  // Goal Form State
  const [newGoal, setNewGoal] = useState({ title: '', targetAmount: '', deadline: '', emoji: '🎯', frequency: 'monthly' });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Plan Form State
  const [newPlan, setNewPlan] = useState<{title: string, description: string, deadline: string, tasks: string[]}>({ title: '', description: '', deadline: '', tasks: [''] });
  
  const currencyCode = userProfile?.currency || 'USD';

  const dailyQuote = useMemo(() => {
     const now = new Date();
     const start = new Date(now.getFullYear(), 0, 0);
     const diff = now.getTime() - start.getTime();
     const oneDay = 1000 * 60 * 60 * 24;
     const dayOfYear = Math.floor(diff / oneDay);
     return motivationQuotes[dayOfYear % motivationQuotes.length];
  }, []);

  const loadData = async () => {
    if (user) {
        const [g, p] = await Promise.all([getGoals(user.id), getPlans(user.id)]);
        if (g) setGoals(g);
        if (p) setPlans(p);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const generateMilestones = (target: number, deadlineStr: string, freq: string, startDateStr?: string) => {
    const milestones = [];
    const now = startDateStr ? new Date(startDateStr) : new Date();
    const deadline = new Date(deadlineStr);
    const timeDiff = deadline.getTime() - now.getTime();
    if (timeDiff <= 0) return [];

    let numPeriods = 1;
    let periodMs = 1000 * 3600 * 24;
    if (freq === 'monthly') {
        numPeriods = Math.ceil(timeDiff / (1000 * 3600 * 24 * 30));
        periodMs = 1000 * 3600 * 24 * 30;
    } else if (freq === 'weekly') {
        numPeriods = Math.ceil(timeDiff / (1000 * 3600 * 24 * 7));
        periodMs = 1000 * 3600 * 24 * 7;
    } else if (freq === 'daily') {
        numPeriods = Math.ceil(timeDiff / (1000 * 3600 * 24));
        periodMs = 1000 * 3600 * 24;
    }
    
    if (numPeriods <= 0) numPeriods = 1;
    if (numPeriods > 104) numPeriods = 104; // capped at 104 (2 years weekly) to prevent too many milestones

    const amountPerPeriod = target / numPeriods;
    for (let i = 1; i <= numPeriods; i++) {
        const milestoneDate = new Date(now.getTime() + periodMs * i);
        const isLast = i === numPeriods;
        const displayDate = isLast ? deadline : milestoneDate;

        milestones.push({
             id: Math.random().toString(36).substring(7),
             title: `${freq === 'monthly' ? 'Month' : freq === 'weekly' ? 'Week' : 'Day'} ${i}`,
             amount: amountPerPeriod,
             date: displayDate.toISOString(),
             completed: false
        });
    }
    return milestones;
  };

  const handleAddGoal = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      const targetAmount = Number(newGoal.targetAmount);
      
      if (editingGoalId) {
          // Keep existing completed milestones if possible, or regenerate
          const goalToUpdate = goals.find(g => g.id === editingGoalId);
          let newMilestones = goalToUpdate?.milestones || [];
          let savedAmount = goalToUpdate?.saved_amount || 0;
          
          if (goalToUpdate && (goalToUpdate.target_amount !== targetAmount || goalToUpdate.deadline !== newGoal.deadline || goalToUpdate.frequency !== newGoal.frequency)) {
               // Must regenerate milestones if target, deadline, or freq changes. We'll reset progress for simplicity or try to carry over.
               // Carrying over completed amount is complex if frequency changes. Let's just reset uncompleted ones.
               newMilestones = generateMilestones(targetAmount, newGoal.deadline, newGoal.frequency);
               savedAmount = 0; // Reset saved amount if terms change significantly to ensure accuracy
          }

          await updateGoal(editingGoalId, {
              title: newGoal.title,
              target_amount: targetAmount,
              saved_amount: savedAmount,
              deadline: newGoal.deadline,
              emoji: newGoal.emoji,
              frequency: newGoal.frequency,
              milestones: newMilestones
          });
      } else {
          const milestones = generateMilestones(targetAmount, newGoal.deadline, newGoal.frequency);
          await addGoal({
              title: newGoal.title,
              target_amount: targetAmount,
              saved_amount: 0,
              deadline: newGoal.deadline,
              emoji: newGoal.emoji,
              frequency: newGoal.frequency,
              milestones
          });
      }
      
      setIsAddingGoal(false);
      setEditingGoalId(null);
      setNewGoal({ title: '', targetAmount: '', deadline: '', emoji: '🎯', frequency: 'monthly' });
      loadData();
  };

  const toggleMilestone = async (goal: any, milestoneId: string) => {
      const updatedMilestones = goal.milestones.map((m: any) => {
          if (m.id === milestoneId) {
              return { ...m, completed: !m.completed };
          }
          return m;
      });
      
      const newSavedAmount = updatedMilestones.filter((m: any) => m.completed).reduce((sum: number, m: any) => sum + m.amount, 0);
      
      const updatedGoals = goals.map(g => g.id === goal.id ? { ...g, milestones: updatedMilestones, saved_amount: newSavedAmount } : g);
      setGoals(updatedGoals);

      await updateGoal(goal.id, {
          milestones: updatedMilestones,
          saved_amount: newSavedAmount
      });
  };

  const handleDeleteGoal = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm('Are you sure you want to delete this goal?')) {
          await deleteGoal(id);
          loadData();
      }
  };

  const startEditGoal = (goal: any, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingGoalId(goal.id);
      setNewGoal({
          title: goal.title,
          targetAmount: String(goal.target_amount),
          deadline: goal.deadline,
          emoji: goal.emoji || '🎯',
          frequency: goal.frequency || 'monthly'
      });
      setIsAddingGoal(true);
  };

  const togglePlanTask = async (plan: any, taskId: string) => {
      if (!plan.plan_data?.tasksList) return;
      const updatedTasks = plan.plan_data.tasksList.map((t: any) => {
          if (t.id === taskId) {
              return { ...t, completed: !t.completed };
          }
          return t;
      });
      const completedCount = updatedTasks.filter((t: any) => t.completed).length;
      const totalCount = updatedTasks.length;
      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
      const status = progress === 100 ? 'completed' : 'active';
      
      const newPlanData = {
          ...plan,
          plan_data: { ...plan.plan_data, tasksList: updatedTasks },
          completed_tasks: completedCount,
          progress,
          status
      };
      
      setPlans(plans.map(p => p.id === plan.id ? newPlanData : p));
      
      await updatePlan(plan.id, {
          plan_data: newPlanData.plan_data,
          completed_tasks: completedCount,
          progress,
          status
      });
  };

  const handleAddPlanTask = () => setNewPlan(prev => ({...prev, tasks: [...prev.tasks, '']}));
  const handleRemovePlanTask = (index: number) => setNewPlan(prev => ({...prev, tasks: prev.tasks.filter((_, i) => i !== index)}));
  const handleTaskTitleChange = (index: number, val: string) => {
    const updated = [...newPlan.tasks];
    updated[index] = val;
    setNewPlan(prev => ({...prev, tasks: updated}));
  };

  const handleManualAddPlan = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      const validTasks = newPlan.tasks.filter(t => t.trim().length > 0);
      
      if (editingPlanId) {
          const planToUpdate = plans.find(p => p.id === editingPlanId);
          const existingTasks = planToUpdate?.plan_data?.tasksList || [];
          const tasksList = validTasks.map(t => {
              const existing = existingTasks.find((et: any) => et.title === t.trim());
              return { id: existing ? existing.id : Math.random().toString(36).substring(7), title: t.trim(), completed: existing ? existing.completed : false };
          });
          const completedCount = tasksList.filter(t => t.completed).length;
          const progress = tasksList.length > 0 ? (completedCount / tasksList.length) * 100 : 0;
          
          await updatePlan(editingPlanId, {
              title: newPlan.title,
              description: newPlan.description,
              status: progress === 100 ? 'completed' : 'active',
              progress,
              tasks: tasksList.length,
              completed_tasks: completedCount,
              plan_data: { tasksList, ...(newPlan.deadline ? { deadline: newPlan.deadline } : {}) }
          });
      } else {
          const tasksList = validTasks.map(t => ({ id: Math.random().toString(36).substring(7), title: t.trim(), completed: false }));
          await addPlan({
              title: newPlan.title,
              description: newPlan.description,
              status: 'active',
              progress: 0,
              tasks: tasksList.length,
              completed_tasks: 0,
              plan_data: { tasksList, ...(newPlan.deadline ? { deadline: newPlan.deadline } : {}) }
          });
      }
      
      setIsAddingPlan(false);
      setEditingPlanId(null);
      setNewPlan({ title: '', description: '', deadline: '', tasks: [''] });
      loadData();
  };

  const startEditPlan = (plan: any, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingPlanId(plan.id);
      setNewPlan({
          title: plan.title,
          description: plan.description || '',
          deadline: plan.plan_data?.deadline || '',
          tasks: plan.plan_data?.tasksList?.map((t: any) => t.title) || ['']
      });
      setIsAddingPlan(true);
  };

  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm('Are you sure you want to delete this plan?')) {
          await deletePlan(id);
          loadData();
      }
  };

  return (
    <div className="flex flex-col tracking-tight pt-4">
      <div className="flex items-center justify-between mb-8 pr-18">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
           <Flag className="text-brand-600" />
           Future & Strategy
        </h1>
        <button 
            onClick={() => activeTab === 'goals' ? setIsAddingGoal(true) : setIsAddingPlan(true)}
            className="w-10 h-10 bg-brand-600 text-white shadow-md rounded-full flex items-center justify-center transition-transform active:scale-95">
            <Plus size={20} />
        </button>
      </div>

      <div className="mb-8 p-5 bg-gradient-to-br from-brand-50 to-white border border-brand-100/50 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -top-4 -right-4 text-brand-100 opacity-50 transform rotate-12">
            <Sparkles size={80} />
        </div>
        <p className="text-brand-800 text-sm italic font-medium leading-relaxed relative z-10">
          {dailyQuote}
        </p>
      </div>

      {/* Segmented Control */}
      <div className="bg-white p-1 rounded-2xl flex items-center shadow-sm border border-gray-100 mb-8 relative z-10 w-full max-w-[300px]">
         <div 
           className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-brand-50 rounded-xl transition-all duration-300 ease-out border border-brand-100 ${activeTab === 'plans' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} 
         />
         <button 
           onClick={() => setActiveTab('goals')}
           className={`flex-1 py-2 text-sm font-bold z-10 transition-colors ${activeTab === 'goals' ? 'text-brand-700' : 'text-gray-500'}`}
         >
           Savings Goals
         </button>
         <button 
           onClick={() => setActiveTab('plans')}
           className={`flex-1 py-2 text-sm font-bold z-10 transition-colors ${activeTab === 'plans' ? 'text-brand-700' : 'text-gray-500'}`}
         >
           Plans & Strategy
         </button>
      </div>
      
      {activeTab === 'goals' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {goals.length > 0 && (
             <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex justify-around mb-2">
                <div className="text-center">
                   <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Total Saved</p>
                   <p className="text-lg font-bold text-brand-600">{formatCurrency(goals.reduce((sum, g) => sum + (Number(g.saved_amount) || 0), 0), currencyCode)}</p>
                </div>
                <div className="w-px bg-gray-100"></div>
                <div className="text-center">
                   <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Total Target</p>
                   <p className="text-lg font-bold text-gray-900">{formatCurrency(goals.reduce((sum, g) => sum + (Number(g.target_amount) || 0), 0), currencyCode)}</p>
                </div>
             </div>
          )}
          {goals.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                      <Target size={30} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">No Goals Yet</h3>
                  <p className="text-sm text-gray-500 max-w-[200px] mx-auto mb-6">Create a savings goal to start tracking your future.</p>
                  <button onClick={() => setIsAddingGoal(true)} className="bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm shadow-sm active:scale-95 transition-transform inline-flex items-center gap-2">
                     <Plus size={16} /> Create Goal
                  </button>
              </div>
          ) : goals.map(goal => {
              const progress = Math.min((goal.saved_amount / goal.target_amount) * 100, 100);
              return (
                  <div key={goal.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group transition-all duration-300">
                      <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl pointer-events-none transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                          {goal.emoji || '🎯'}
                      </div>
                      
                      <div className="flex items-start justify-between mb-6 cursor-pointer relative z-10" onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}>
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-xl shadow-sm">
                                 {goal.emoji || '🎯'}
                             </div>
                             <div>
                               <h3 className="font-bold text-gray-900 leading-tight flex items-center gap-2">
                                   {goal.title}
                                   {expandedGoalId === goal.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                               </h3>
                               <p className="text-xs text-gray-500 font-medium mt-1">Due {new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', year: 'numeric'})}</p>
                             </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                             <span className="text-xs font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">
                                 {Math.round(progress)}%
                             </span>
                             {expandedGoalId === goal.id && (
                               <div className="flex items-center gap-2 mt-1">
                                 <button onClick={(e) => startEditGoal(goal, e)} className="text-gray-400 hover:text-brand-600 transition-colors p-1">
                                    <Edit2 size={14} />
                                 </button>
                                 <button onClick={(e) => handleDeleteGoal(goal.id, e)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                    <Trash2 size={14} />
                                 </button>
                               </div>
                             )}
                          </div>
                      </div>
                      
                      <div className="flex justify-between items-end mb-3 relative z-10">
                          <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
                              <p className="text-xl font-bold text-gray-900">{formatCurrency(goal.saved_amount, currencyCode)}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target</p>
                              <p className="text-sm font-bold text-gray-500">{formatCurrency(goal.target_amount, currencyCode)}</p>
                          </div>
                      </div>

                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative z-10 mb-2">
                          <div className="bg-gradient-to-r from-brand-400 to-brand-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                      </div>
                      
                      {(() => {
                         let createdAtTime = Date.now();
                         if (goal.createdAt) {
                            createdAtTime = new Date(goal.createdAt).getTime();
                         }
                         const timeElapsed = Date.now() - createdAtTime;
                         const totalTime = new Date(goal.deadline).getTime() - createdAtTime;
                         const timeProgress = totalTime > 0 ? (timeElapsed / totalTime) * 100 : 100;
                         const isLagging = progress < (timeProgress - 5) && timeProgress > 5; // 5% grace padding, only warn after 5% time elapsed
                         
                         return isLagging ? (
                             <p className="text-[10px] font-bold text-red-500 mt-2 flex items-center justify-end gap-1">
                                <Flag size={10} /> You are lagging behind your schedule!
                             </p>
                         ) : null;
                      })()}
                      
                      {expandedGoalId === goal.id && goal.milestones && goal.milestones.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 relative z-10">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Funding Milestones ({goal.frequency})</h4>
                                <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                                  {goal.milestones.filter((m: any) => m.completed).length} / {goal.milestones.length}
                                </span>
                              </div>
                              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                  {goal.milestones.map((milestone: any, index: number) => (
                                      <div 
                                          key={milestone.id} 
                                          onClick={(e) => { e.stopPropagation(); toggleMilestone(goal, milestone.id); }}
                                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${milestone.completed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                                      >
                                          <div className="flex items-center gap-3">
                                              {milestone.completed ? <CheckCircle size={18} className="text-green-500" /> : <Circle size={18} className="text-gray-300" />}
                                              <span className="text-sm font-bold opacity-90">
                                                  {milestone.title}
                                                  {milestone.date && <span className="text-[10px] text-gray-400 block font-medium mt-0.5">{new Date(milestone.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>}
                                              </span>
                                          </div>
                                          <span className="text-sm font-bold opacity-90">
                                              {formatCurrency(milestone.amount, currencyCode)}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )
          })}
          {goals.length > 0 && (
             <button onClick={() => setIsAddingGoal(true)} className="w-full bg-white border border-dashed border-gray-300 text-gray-500 font-bold py-4 rounded-3xl mt-4 active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-gray-50 hover:text-gray-900 shadow-sm">
                <Plus size={18} /> Add Another Goal
             </button>
          )}
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           
           {plans.length === 0 ? (
               <div className="text-center py-10 bg-white rounded-3xl border border-gray-100 shadow-sm">
                   <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-600">
                       <Briefcase size={30} />
                   </div>
                   <h3 className="font-bold text-gray-900 mb-2">No Plans Yet</h3>
                   <p className="text-sm text-gray-500 max-w-[200px] mx-auto mb-6">You don't have any active plans. Create one to stay on track.</p>
                   <button onClick={() => setIsAddingPlan(true)} className="bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm shadow-sm active:scale-95 transition-transform inline-flex items-center gap-2">
                       <Plus size={16} /> Create Plan
                   </button>
               </div>
           ) : plans.map(plan => (
             <div key={plan.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 transition-all duration-300">
                <div 
                   className="flex items-center gap-3 mb-3 cursor-pointer" 
                   onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                >
                   <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                       <Briefcase size={18} />
                   </div>
                   <div className="flex-1">
                     <h3 className="font-bold text-gray-900 text-sm flex items-center justify-between">
                         {plan.title}
                         {expandedPlanId === plan.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                     </h3>
                     <div className="flex gap-2 items-center mt-1">
                         <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${plan.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-brand-600 bg-brand-50'}`}>
                            {plan.status}
                         </span>
                         {plan.planData?.deadline && (
                             <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                                 Due {new Date(plan.planData.deadline).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                             </span>
                         )}
                         {expandedPlanId === plan.id && (
                             <div className="flex items-center gap-1 ml-2">
                               <button onClick={(e) => startEditPlan(plan, e)} className="text-gray-400 hover:text-brand-600 transition-colors p-1">
                                  <Edit2 size={12} />
                               </button>
                               <button onClick={(e) => handleDeletePlan(plan.id, e)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                  <Trash2 size={12} />
                               </button>
                             </div>
                         )}
                     </div>
                   </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  {plan.description}
                </p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-4">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${plan.progress === 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${plan.progress || 0}%` }}></div>
                </div>
                
                {expandedPlanId === plan.id && plan.planData?.tasksList && (
                    <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col gap-2">
                            {plan.planData.tasksList.map((task: any) => (
                                <div 
                                    key={task.id} 
                                    onClick={() => togglePlanTask(plan, task.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${task.completed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                                >
                                    {task.completed ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" /> : <Circle size={18} className="text-gray-300 flex-shrink-0" />}
                                    <span className={`text-sm font-medium ${task.completed ? 'line-through opacity-70' : ''}`}>{task.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
             </div>
           ))}
           {plans.length > 0 && (
              <button onClick={() => setIsAddingPlan(true)} className="w-full bg-white border border-dashed border-gray-300 text-gray-500 font-bold py-4 rounded-3xl mt-4 active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-gray-50 hover:text-gray-900 shadow-sm">
                 <Plus size={18} /> Add Another Plan
              </button>
           )}
        </div>
      )}

      {/* Add Goal Modal */}
      {isAddingGoal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-white w-full max-w-sm rounded-[32px] sm:rounded-[32px] rounded-b-none p-6 shadow-2xl animate-in slide-in-from-bottom-full max-h-[85vh] overflow-y-auto pb-32 sm:pb-12">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">{editingGoalId ? 'Edit Savings Goal' : 'New Savings Goal'}</h2>
                      <button onClick={() => { setIsAddingGoal(false); setEditingGoalId(null); }} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                          <X size={18} />
                      </button>
                  </div>
                  <form onSubmit={handleAddGoal} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Goal Name</label>
                          <input type="text" required value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-medium border border-gray-100 focus:outline-none focus:border-brand-500" placeholder="E.g. Vacation Fund" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Amount</label>
                          <input type="number" required value={newGoal.targetAmount} onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-bold border border-gray-100 focus:outline-none focus:border-brand-500" placeholder="0.00" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Date</label>
                          <input type="date" required value={newGoal.deadline} onChange={e => setNewGoal({...newGoal, deadline: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-medium border border-gray-100 focus:outline-none focus:border-brand-500" />
                      </div>
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Frequency</label>
                              <select required value={newGoal.frequency} onChange={e => setNewGoal({...newGoal, frequency: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-medium border border-gray-100 focus:outline-none focus:border-brand-500 appearance-none">
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Emoji</label>
                              <input type="text" value={newGoal.emoji} onChange={e => setNewGoal({...newGoal, emoji: e.target.value})} className="w-16 text-center bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-xl border border-gray-100 focus:outline-none focus:border-brand-500" />
                          </div>
                      </div>
                      <button type="submit" className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl mt-4 active:scale-95 transition-transform">
                          {editingGoalId ? 'Save Changes' : 'Create Goal'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* Add Plan Modal */}
      {isAddingPlan && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-white w-full max-w-sm rounded-[32px] sm:rounded-[32px] rounded-b-none p-6 shadow-2xl animate-in slide-in-from-bottom-full max-h-[85vh] overflow-y-auto pb-32 sm:pb-12">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">{editingPlanId ? 'Edit Strategy Plan' : 'New Strategy Plan'}</h2>
                      <button onClick={() => { setIsAddingPlan(false); setEditingPlanId(null); }} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                          <X size={18} />
                      </button>
                  </div>
                  <form onSubmit={handleManualAddPlan} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Plan Title</label>
                          <input type="text" required value={newPlan.title} onChange={e => setNewPlan({...newPlan, title: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-medium border border-gray-100 focus:outline-none focus:border-brand-500" placeholder="E.g. Pay off Student Loans" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                          <textarea required value={newPlan.description} onChange={e => setNewPlan({...newPlan, description: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-medium border border-gray-100 focus:outline-none focus:border-brand-500 min-h-[80px]" placeholder="Briefly describe the strategy..." />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Date (Optional)</label>
                          <input type="date" value={newPlan.deadline} onChange={e => setNewPlan({...newPlan, deadline: e.target.value})} className="w-full bg-gray-50 text-gray-900 px-4 py-3 rounded-2xl text-sm font-medium border border-gray-100 focus:outline-none focus:border-brand-500" />
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tasks / Steps</label>
                          <div className="space-y-3 mb-4">
                              {newPlan.tasks.map((task, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                          {index + 1}
                                      </div>
                                      <input 
                                          type="text" 
                                          required={index === 0}
                                          value={task} 
                                          onChange={e => handleTaskTitleChange(index, e.target.value)} 
                                          className="flex-1 bg-gray-50 text-gray-900 px-3 py-2 rounded-xl text-sm border border-gray-100 focus:outline-none focus:border-brand-500" 
                                          placeholder={`Step ${index + 1}`} 
                                      />
                                      {newPlan.tasks.length > 1 && (
                                          <button type="button" onClick={() => handleRemovePlanTask(index)} className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors">
                                              <Trash2 size={16} />
                                          </button>
                                      )}
                                  </div>
                              ))}
                          </div>
                          <button type="button" onClick={handleAddPlanTask} className="flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors px-2 py-1">
                              <Plus size={16} /> Add Another Step
                          </button>
                      </div>
                      <button type="submit" className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl mt-6 active:scale-95 transition-transform">
                          {editingPlanId ? 'Save Changes' : 'Save Plan'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
