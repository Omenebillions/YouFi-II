import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Target, Plus, Flag, Briefcase, ChevronDown, ChevronUp, 
  CheckCircle, Circle, Trash2, Edit2, X, Sparkles, TrendingUp, 
  ArrowLeft, Users, ShieldAlert, PackageCheck, Lightbulb
} from 'lucide-react';
import { 
  getGoals, addGoal, updateGoal, deleteGoal, 
  getPlans, addPlan, updatePlan, deletePlan,
  getBusinesses
} from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';
import { motion, AnimatePresence } from 'motion/react';
import { ModalTracker } from '../components/ModalTracker';

const businessQuotes = [
  "Structure follows strategy. Align your capital to your business vision.",
  "Good tactics can save even the worst strategy. Bad tactics will ruin even the best strategy.",
  "The best way to predict your business future is to build its strategy.",
  "Concentrate your energy, your funding, and your team on where you can win.",
  "Metrics are for action, not just tracking. Focus on what grows customer value.",
  "Revenue is vanity, profit is sanity, but cash flow is reality. Strategize for cash flow.",
  "An SME's greatest weapon is speed. Plan quickly, execute decively."
];

export default function BusinessGoals() {
  const { businessId } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [goals, setGoals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'goals' | 'plans'>('goals');
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Goal Form State
  const [newGoal, setNewGoal] = useState({ 
    title: '', 
    targetAmount: '', 
    category: 'custom', 
    deadline: '', 
    emoji: '🎯', 
    frequency: 'monthly' 
  });

  // Plan Form State
  const [newPlan, setNewPlan] = useState<{
    title: string;
    description: string;
    deadline: string;
    tasks: string[];
  }>({ 
    title: '', 
    description: '', 
    deadline: '', 
    tasks: [''] 
  });

  const currencyCode = userProfile?.currency || 'USD';

  const randomQuote = useMemo(() => {
    const idx = Math.floor(Math.random() * businessQuotes.length);
    return businessQuotes[idx];
  }, [businessId]);

  const activeBusiness = useMemo(() => {
    return businesses.find(b => b.id === businessId);
  }, [businesses, businessId]);

  const loadData = async () => {
    if (!user || !businessId) return;
    setLoading(true);
    try {
      const [g, p, b] = await Promise.all([
        getGoals(user.id),
        getPlans(user.id),
        getBusinesses(user.id)
      ]);

      if (b) setBusinesses(b);

      // Filter goals & plans matching this business
      // Business goals have a frequency format of 'business:BUSINESS_ID:frequency'
      if (g) {
        const filteredG = g.filter((item: any) => 
          item.frequency?.startsWith(`business:${businessId}:`)
        );
        setGoals(filteredG);
      }

      // Business plans store business_id in plan_data
      if (p) {
        const filteredP = p.filter((item: any) => 
          item.plan_data?.business_id === businessId
        );
        setPlans(filteredP);
      }
    } catch (err) {
      console.error("Error loading business goals / plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, businessId]);

  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, currencyCode);
  };

  const generateMilestones = (target: number, deadlineStr: string, freq: string) => {
    const milestones = [];
    const now = new Date();
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
    } else if (freq === 'quarterly') {
      numPeriods = Math.ceil(timeDiff / (1000 * 3600 * 24 * 90));
      periodMs = 1000 * 3600 * 24 * 90;
    } else if (freq === 'daily') {
      numPeriods = Math.ceil(timeDiff / (1000 * 3600 * 24));
      periodMs = 1000 * 3600 * 24;
    }
    
    if (numPeriods <= 0) numPeriods = 1;
    if (numPeriods > 52) numPeriods = 52; // Safety cap

    const amountPerPeriod = target / numPeriods;
    for (let i = 1; i <= numPeriods; i++) {
      const milestoneDate = new Date(now.getTime() + periodMs * i);
      const isLast = i === numPeriods;
      const displayDate = isLast ? deadline : milestoneDate;

      milestones.push({
        id: Math.random().toString(36).substring(7),
        title: `${freq === 'monthly' ? 'Month' : freq === 'weekly' ? 'Week' : freq === 'quarterly' ? 'Quarter' : 'Day'} ${i}`,
        amount: amountPerPeriod,
        date: displayDate.toISOString(),
        completed: false
      });
    }
    return milestones;
  };

  // Adjust default emoji based on business category selected
  const handleCategoryChange = (cat: string) => {
    let emoji = '🎯';
    if (cat === 'revenue') emoji = '📈';
    else if (cat === 'profit') emoji = '💰';
    else if (cat === 'customers') emoji = '👥';
    else if (cat === 'marketing') emoji = '🚀';
    else if (cat === 'expenses') emoji = '🛡️';
    else if (cat === 'inventory') emoji = '📦';

    setNewGoal(prev => ({ ...prev, category: cat, emoji }));
  };

  const handleAddGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessId) return;
    const targetAmount = Number(newGoal.targetAmount);
    
    // Store original frequency suffix, prefixing with business specs
    const dbFreq = `business:${businessId}:${newGoal.frequency}`;

    try {
      if (editingGoalId) {
        const goalToUpdate = goals.find(g => g.id === editingGoalId);
        let newMilestones = goalToUpdate?.milestones || [];
        let savedAmount = goalToUpdate?.saved_amount || 0;
        
        // Recalculate milestones if targets evolved
        const oldFreqArg = goalToUpdate?.frequency?.split(':').pop() || 'monthly';
        if (goalToUpdate && (goalToUpdate.target_amount !== targetAmount || goalToUpdate.deadline !== newGoal.deadline || oldFreqArg !== newGoal.frequency)) {
          newMilestones = generateMilestones(targetAmount, newGoal.deadline, newGoal.frequency);
          savedAmount = 0;
        }

        await updateGoal(editingGoalId, {
          title: newGoal.title,
          target_amount: targetAmount,
          saved_amount: savedAmount,
          deadline: newGoal.deadline,
          emoji: newGoal.emoji,
          frequency: dbFreq,
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
          frequency: dbFreq,
          milestones
        });
      }
      
      setIsAddingGoal(false);
      setEditingGoalId(null);
      setNewGoal({ title: '', targetAmount: '', category: 'custom', deadline: '', emoji: '🎯', frequency: 'monthly' });
      loadData();
    } catch (err) {
      console.error("Error submitting goal:", err);
    }
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
    if (window.confirm('Delete this business goal? Progress tracker will be deleted.')) {
      await deleteGoal(id);
      loadData();
    }
  };

  const startEditGoal = (goal: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGoalId(goal.id);
    
    const freqParts = goal.frequency?.split(':') || [];
    const freqVal = freqParts.length > 2 ? freqParts[2] : 'monthly';

    setNewGoal({
      title: goal.title,
      targetAmount: String(goal.target_amount),
      category: 'custom',
      deadline: goal.deadline,
      emoji: goal.emoji || '🎯',
      frequency: freqVal
    });
    setIsAddingGoal(true);
  };

  // Plan actions
  const handleAddPlanTask = () => setNewPlan(prev => ({ ...prev, tasks: [...prev.tasks, ''] }));
  const handleRemovePlanTask = (index: number) => setNewPlan(prev => ({ ...prev, tasks: prev.tasks.filter((_, i) => i !== index) }));
  const handleTaskTitleChange = (index: number, val: string) => {
    const updated = [...newPlan.tasks];
    updated[index] = val;
    setNewPlan(prev => ({ ...prev, tasks: updated }));
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessId) return;
    
    const validTasks = newPlan.tasks.filter(t => t.trim().length > 0);
    
    try {
      if (editingPlanId) {
        const planToUpdate = plans.find(p => p.id === editingPlanId);
        const existingTasks = planToUpdate?.plan_data?.tasksList || [];
        const tasksList = validTasks.map(t => {
          const existing = existingTasks.find((et: any) => et.title === t.trim());
          return { 
            id: existing ? existing.id : Math.random().toString(36).substring(7), 
            title: t.trim(), 
            completed: existing ? existing.completed : false 
          };
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
          plan_data: { 
            business_id: businessId, 
            tasksList, 
            ...(newPlan.deadline ? { deadline: newPlan.deadline } : {}) 
          }
        });
      } else {
        const tasksList = validTasks.map(t => ({ 
          id: Math.random().toString(36).substring(7), 
          title: t.trim(), 
          completed: false 
        }));
        
        await addPlan({
          title: newPlan.title,
          description: newPlan.description,
          status: 'active',
          progress: 0,
          tasks: tasksList.length,
          completed_tasks: 0,
          plan_data: { 
            business_id: businessId, 
            tasksList, 
            ...(newPlan.deadline ? { deadline: newPlan.deadline } : {}) 
          }
        });
      }
      
      setIsAddingPlan(false);
      setEditingPlanId(null);
      setNewPlan({ title: '', description: '', deadline: '', tasks: [''] });
      loadData();
    } catch (err) {
      console.error("Error submitting plan:", err);
    }
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
    if (window.confirm('Delete this tactical business plan?')) {
      await deletePlan(id);
      loadData();
    }
  };

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-36">
      {/* Back Header */}
      <div className="flex items-center justify-between mb-6 pr-12 animate-in fade-in slide-in-from-top-1">
        <button 
          onClick={() => navigate(`/business/${businessId}`)} 
          className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95"
          id="goals_back_btn"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
           <Target className="text-brand-600" /> Goals & Strategy
        </h1>
        <div className="w-4"></div>
      </div>

      {/* Inspirational SME Banner */}
      <div className="mb-8 p-5 bg-gradient-to-br from-brand-950 to-brand-900 border border-brand-800 rounded-3xl shadow-md relative overflow-hidden text-brand-100 flex gap-4 items-start">
        <div className="p-3 rounded-2xl bg-brand-800/50 text-brand-400 shrink-0">
          <Lightbulb size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest mb-1">AI Tactical Thought</p>
          <p className="text-sm italic font-medium leading-relaxed">
            "{randomQuote}"
          </p>
        </div>
        <div className="absolute -bottom-4 -right-4 text-brand-800 opacity-20 pointer-events-none transform rotate-12">
          <Sparkles size={110} />
        </div>
      </div>

      {/* Segmented Control / Dynamic Tabs */}
      <div className="flex items-center justify-between mb-8">
        <div className="bg-white p-1 rounded-2xl flex items-center shadow-sm border border-gray-100 relative z-10 w-full max-w-[340px]">
          <div 
            className={`absolute top-1 bottom-1 w-[calc(52%-4px)] bg-brand-50 rounded-xl transition-all duration-300 ease-out border border-brand-100 ${
              activeTab === 'plans' ? 'translate-x-[calc(92%-4px)]' : 'translate-x-0'
            }`} 
          />
          <button 
            onClick={() => setActiveTab('goals')}
            className={`flex-1 py-2 px-3 text-xs font-bold z-10 transition-colors whitespace-nowrap ${activeTab === 'goals' ? 'text-brand-700' : 'text-gray-500'}`}
          >
            SME Targets
          </button>
          <button 
            onClick={() => setActiveTab('plans')}
            className={`flex-1 py-2 px-3 text-xs font-bold z-10 transition-colors whitespace-nowrap ${activeTab === 'plans' ? 'text-brand-700' : 'text-gray-500'}`}
          >
            Tactics & Strategy
          </button>
        </div>
        
        <button 
          onClick={() => activeTab === 'goals' ? setIsAddingGoal(true) : setIsAddingPlan(true)}
          className="h-10 px-4 bg-brand-600 text-white shadow-md rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-transform active:scale-95"
          id="add_business_goal_btn"
        >
          <Plus size={16} /> Add {activeTab === 'goals' ? 'Target' : 'Plan'}
        </button>
      </div>

      {loading && goals.length === 0 && plans.length === 0 ? (
        <div className="py-20 text-center text-gray-400 flex items-center justify-center gap-2">
          <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing planning board...</span>
        </div>
      ) : null}

      {/* Targets Tab */}
      {activeTab === 'goals' && !loading && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {goals.length > 0 && (
             <div className="grid grid-cols-2 gap-4 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-2">
                <div className="text-center">
                   <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Business Targets Setup</p>
                   <p className="text-xl font-black text-brand-600">{goals.length}</p>
                </div>
                <div className="text-center border-l border-gray-100">
                   <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Consolidated Value</p>
                   <p className="text-xl font-black text-gray-900">{formatCurrency(goals.reduce((sum, g) => sum + (Number(g.target_amount) || 0), 0))}</p>
                </div>
             </div>
          )}

          {goals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm px-6">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                <Target size={30} />
              </div>
              <h3 className="font-bold text-gray-900 mb-1 text-base">No SME Targets Set</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto mb-6">Create structural revenue, expansion, or cost-saving targets for {activeBusiness?.name || 'your business'}.</p>
              <button 
                onClick={() => setIsAddingGoal(true)} 
                className="bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-md active:scale-95 transition-transform inline-flex items-center gap-2"
              >
                <Plus size={14} /> Establish SME Target
              </button>
            </div>
          ) : (
            goals.map(goal => {
              const progress = Math.min((goal.saved_amount / goal.target_amount) * 100, 100);
              const freqSuff = goal.frequency?.split(':').pop() || 'monthly';
              return (
                <div key={goal.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group transition-all duration-300">
                  <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl pointer-events-none transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                    {goal.emoji || '🎯'}
                  </div>
                  
                  <div className="flex items-start justify-between mb-6 cursor-pointer relative z-10" onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-xl shadow-sm shrink-0">
                        {goal.emoji || '🎯'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 leading-tight flex items-center gap-2 text-sm md:text-base">
                          <span className="truncate">{goal.title}</span>
                          {expandedGoalId === goal.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                        </h3>
                        <p className="text-xs text-gray-500 font-semibold mt-1 flex items-center gap-1">
                          <span className="capitalize bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{freqSuff}</span>
                          <span>Due {new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs font-black text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-xl">
                        {Math.round(progress)}%
                      </span>
                      {expandedGoalId === goal.id && (
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={(e) => startEditGoal(goal, e)} className="text-gray-400 hover:text-brand-600 transition-colors p-1" title="Edit goal">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={(e) => handleDeleteGoal(goal.id, e)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete goal">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end mb-3 relative z-10">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Achieved Progress</p>
                      <p className="text-xl font-black text-gray-900">{formatCurrency(goal.saved_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target</p>
                      <p className="text-sm font-bold text-gray-500">{formatCurrency(goal.target_amount)}</p>
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative z-10 mb-2">
                    <div className="bg-gradient-to-r from-brand-400 to-brand-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                  </div>
                  
                  {(() => {
                    let createdAtTime = Date.now();
                    if (goal.created_at) {
                      createdAtTime = new Date(goal.created_at).getTime();
                    }
                    const timeElapsed = Date.now() - createdAtTime;
                    const totalTime = new Date(goal.deadline).getTime() - createdAtTime;
                    const timeProgress = totalTime > 0 ? (timeElapsed / totalTime) * 100 : 100;
                    const isLagging = progress < (timeProgress - 5) && timeProgress > 5;
                    
                    return isLagging ? (
                      <p className="text-[10px] font-bold text-rose-600 mt-2 flex items-center justify-end gap-1">
                        <ShieldAlert size={12} /> Target timeline lag! Accelerate tactics to match schedule.
                      </p>
                    ) : null;
                  })()}
                  
                  <AnimatePresence>
                    {expandedGoalId === goal.id && goal.milestones && goal.milestones.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 relative z-10 overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Sub-milestones checklist</h4>
                          <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">
                            {goal.milestones.filter((m: any) => m.completed).length} / {goal.milestones.length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {goal.milestones.map((milestone: any) => (
                            <div 
                              key={milestone.id} 
                              onClick={(e) => { e.stopPropagation(); toggleMilestone(goal, milestone.id); }}
                              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                                milestone.completed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {milestone.completed ? <CheckCircle size={18} className="text-green-500" /> : <Circle size={18} className="text-gray-300" />}
                                <span className="text-sm font-semibold opacity-90">
                                  {milestone.title}
                                  {milestone.date && (
                                    <span className="text-[10px] text-gray-400 block font-medium mt-0.5">
                                      {new Date(milestone.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  )}
                                </span>
                              </div>
                              <span className="text-sm font-bold opacity-90">
                                {formatCurrency(milestone.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Strategies Tab */}
      {activeTab === 'plans' && !loading && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           {plans.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm px-6">
                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                  <Briefcase size={30} />
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-base">No Strategic Plans Yet</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mb-6">Create step-by-step business campaigns, operational setups, or marketing plans.</p>
                <button 
                  onClick={() => setIsAddingPlan(true)} 
                  className="bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl text-xs shadow-md active:scale-95 transition-transform inline-flex items-center gap-2"
                >
                  <Plus size={14} /> Design Strategic Plan
                </button>
              </div>
           ) : (
             plans.map(plan => (
               <div key={plan.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 transition-all duration-300">
                  <div 
                     className="flex items-start gap-4 mb-3 cursor-pointer" 
                     onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                  >
                     <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Briefcase size={18} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-gray-900 text-sm md:text-base flex items-center justify-between">
                          <span className="truncate">{plan.title}</span>
                          {expandedPlanId === plan.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                       </h3>
                       <div className="flex gap-2 items-center mt-1 flex-wrap">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${
                            plan.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-brand-600 bg-brand-50'
                          }`}>
                            {plan.status}
                          </span>
                          {plan.plan_data?.deadline && (
                            <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">
                              Due {new Date(plan.plan_data.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                          {expandedPlanId === plan.id && (
                            <div className="flex items-center gap-1 ml-2">
                              <button onClick={(e) => startEditPlan(plan, e)} className="text-gray-400 hover:text-brand-600 transition-colors p-1" title="Edit strategy">
                                <Edit2 size={12} />
                              </button>
                              <button onClick={(e) => handleDeletePlan(plan.id, e)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete strategy">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                       </div>
                     </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4 pl-14">
                    {plan.description}
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-4 pl-14">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      plan.progress === 100 ? 'bg-green-500' : 'bg-brand-500'
                    }`} style={{ width: `${plan.progress || 0}%` }}></div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedPlanId === plan.id && plan.plan_data?.tasksList && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 overflow-hidden"
                      >
                        <div className="flex flex-col gap-2">
                          {plan.plan_data.tasksList.map((task: any) => (
                            <div 
                              key={task.id} 
                              onClick={() => togglePlanTask(plan, task.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                task.completed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {task.completed ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" /> : <Circle size={18} className="text-gray-300 flex-shrink-0" />}
                              <span className={`text-sm font-semibold ${task.completed ? 'line-through opacity-70' : ''}`}>{task.title}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
             ))
           )}
        </div>
      )}

      {/* Target Setup Modal */}
      <ModalTracker isOpen={isAddingGoal || isAddingPlan} />
      {isAddingGoal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto pb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-gray-900">{editingGoalId ? 'Modify Business Target' : 'Create Business Target'}</h2>
              <button 
                onClick={() => { setIsAddingGoal(false); setEditingGoalId(null); }} 
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddGoalSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Target Name</label>
                <input 
                  type="text" 
                  required 
                  value={newGoal.title} 
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })} 
                  className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-sans" 
                  placeholder="E.g. Double monthly inventory sales" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Category</label>
                  <select 
                    value={newGoal.category} 
                    onChange={e => handleCategoryChange(e.target.value)} 
                    className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-sans"
                  >
                    <option value="custom">Custom</option>
                    <option value="revenue">Revenue Target</option>
                    <option value="profit">Profit Target</option>
                    <option value="customers">Customers Target</option>
                    <option value="expenses">Expenses Limit</option>
                    <option value="inventory">Inventory Setup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Target Emoji</label>
                  <input 
                    type="text" 
                    value={newGoal.emoji} 
                    onChange={e => setNewGoal({ ...newGoal, emoji: e.target.value })} 
                    className="w-full text-center bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Financial Value</label>
                  <input 
                    type="number" 
                    required 
                    value={newGoal.targetAmount} 
                    onChange={e => setNewGoal({ ...newGoal, targetAmount: e.target.value })} 
                    className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono" 
                    placeholder="0.00" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Interval</label>
                  <select 
                    value={newGoal.frequency} 
                    onChange={e => setNewGoal({ ...newGoal, frequency: e.target.value })} 
                    className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-sans"
                  >
                    <option value="daily">Daily Target</option>
                    <option value="weekly">Weekly Target</option>
                    <option value="monthly">Monthly Target</option>
                    <option value="quarterly">Quarterly Target</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Target Deadline</label>
                <input 
                  type="date" 
                  required 
                  value={newGoal.deadline} 
                  onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })} 
                  className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono" 
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl mt-4 shadow-lg active:scale-95 transition-transform"
              >
                {editingGoalId ? 'Save SME Target' : 'Establish SME Target'}
              </button>
              <div className="h-6" />
            </form>
          </div>
        </div>
      )}

      {/* Strategic Plan Setup Modal */}
      {isAddingPlan && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto pb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-gray-900">{editingPlanId ? 'Edit Strategic Plan' : 'Create Strategic Plan'}</h2>
              <button 
                onClick={() => { setIsAddingPlan(false); setEditingPlanId(null); }} 
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Strategy Title</label>
                <input 
                  type="text" 
                  required 
                  value={newPlan.title} 
                  onChange={e => setNewPlan({ ...newPlan, title: e.target.value })} 
                  className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" 
                  placeholder="E.g. Q4 Instagram Ads Campaign" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Strategy Overview</label>
                <textarea 
                  required 
                  value={newPlan.description} 
                  onChange={e => setNewPlan({ ...newPlan, description: e.target.value })} 
                  className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[80px]" 
                  placeholder="Summarize the core tactic and goals..." 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Strategic Milestone Deadline</label>
                <input 
                  type="date" 
                  value={newPlan.deadline} 
                  onChange={e => setNewPlan({ ...newPlan, deadline: e.target.value })} 
                  className="w-full bg-gray-50 text-gray-900 px-4 py-3 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono" 
                />
              </div>
              
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-3">Tactic Steps Checklist</label>
                <div className="space-y-3 mb-4 max-h-[180px] overflow-y-auto pr-1">
                  {newPlan.tasks.map((task, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold leading-none shrink-0 border border-gray-200">
                        {index + 1}
                      </div>
                      <input 
                        type="text" 
                        required={index === 0}
                        value={task} 
                        onChange={e => handleTaskTitleChange(index, e.target.value)} 
                        className="flex-1 bg-gray-50 text-gray-900 px-3 py-2 border border-gray-100 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" 
                        placeholder={`Tactic Step ${index + 1}`} 
                      />
                      {newPlan.tasks.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemovePlanTask(index)} 
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button 
                  type="button" 
                  onClick={handleAddPlanTask} 
                  className="flex items-center gap-2 text-xs font-black text-brand-600 hover:text-brand-700 transition-all px-2 py-1.5 bg-brand-50 rounded-xl border border-brand-100"
                >
                  <Plus size={14} /> Add Another Step
                </button>
              </div>

              <button 
                type="submit" 
                className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl mt-6 shadow-md active:scale-95 transition-transform"
              >
                {editingPlanId ? 'Save Changes' : 'Design Strategic Plan'}
              </button>
              <div className="h-6" />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
