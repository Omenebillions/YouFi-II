import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, CreditCard, Sparkles,
  Search, Calendar, CheckCircle2, AlertCircle, Trash2, Edit2, X, RotateCw, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../hooks/useNativeBridge';
import UpgradePrompt from '../components/UpgradePrompt';
import { motion, AnimatePresence } from 'motion/react';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { generateRecurringPayments } from '../lib/debt';
import { ModalTracker } from '../components/ModalTracker';

import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';

const parseLenderRecurrence = (fullLenderStr: string) => {
  if (!fullLenderStr) return { lender: '', isRecurring: false, frequency: '', duration: '', recurringAmount: 0, payments: [] as any[] };
  
  const trimmed = fullLenderStr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        lender: parsed.lender || parsed.name || parsed.note || 'Lender',
        isRecurring: parsed.isRecurring || false,
        frequency: parsed.frequency || '',
        duration: parsed.duration || '',
        recurringAmount: parsed.recurringAmount || 0,
        payments: parsed.payments || []
      };
    } catch {
      // fallback
    }
  }

  const parts = fullLenderStr.split(" | recurring: ");
  if (parts.length > 1) {
    const subParts = parts[1].split(" | duration: ");
    const freq = subParts[0];
    let duration = subParts[1] || '';
    let recurringAmount = 0;
    let payments: any[] = [];

    if (duration.includes(" | recAmount: ")) {
      const recParts = duration.split(" | recAmount: ");
      duration = recParts[0];
      const remaining = recParts[1] || '';
      if (remaining.includes(" | payments: ")) {
        const payParts = remaining.split(" | payments: ");
        recurringAmount = parseFloat(payParts[0]) || 0;
        try {
          payments = JSON.parse(payParts[1]);
        } catch (e) {
          payments = [];
        }
      } else {
        recurringAmount = parseFloat(remaining) || 0;
      }
    }

    return {
      lender: parts[0],
      isRecurring: freq !== 'none' && freq !== '',
      frequency: freq || '',
      duration: duration,
      recurringAmount: recurringAmount,
      payments: payments
    };
  }
  return { lender: fullLenderStr, isRecurring: false, frequency: '', duration: '', recurringAmount: 0, payments: [] as any[] };
};

export default function BusinessDebtList() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { bridge, isPremium, refreshPremiumStatus } = useNativeBridge();
  
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<any>(null);
  const [editingDebt, setEditingDebt] = useState<any>(null);
  
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Sync to Calendar');

  const [formData, setFormData] = useState({ 
    lender: '', 
    amount: '', 
    dueDate: '', 
    status: 'unpaid',
    isRecurring: false,
    frequency: 'monthly',
    duration: '',
    recurringAmount: '',
    payments: [] as any[]
  });
  
  useEffect(() => {
    if (location.search.includes('add=true')) {
       setShowModal(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (formData.isRecurring) {
      const parsedAmount = parseFloat(formData.amount) || 0;
      const parsedRecAmt = parseFloat(formData.recurringAmount) || parsedAmount;
      if (parsedAmount > 0) {
        if (formData.payments.length === 0) {
          const generated = generateRecurringPayments(
            formData.dueDate || new Date().toISOString().split('T')[0],
            formData.frequency,
            formData.duration || '3 months',
            parsedRecAmt
          );
          setFormData(prev => ({ ...prev, payments: generated }));
        }
      }
    } else {
      setFormData(prev => ({ ...prev, payments: [] }));
    }
  }, [formData.isRecurring, formData.dueDate, formData.frequency, formData.duration, formData.amount]);

  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (businessId && user) {
      fetchDebts();
    }
  }, [businessId, user]);

  const fetchDebts = async () => {
    if (!businessId || !user) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('business_debts')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setDebts(data);
    } catch (error) {
      console.error("Error fetching debts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const amount = parseFloat(formData.amount);
    if (!user || !businessId || !formData.lender || isNaN(amount) || amount <= 0) return;

    setLoading(true);
    const serializedPayments = formData.isRecurring && formData.payments.length > 0
      ? ` | recAmount: ${formData.recurringAmount || amount} | payments: ${JSON.stringify(formData.payments)}`
      : '';
    const finalLender = formData.isRecurring
      ? `${formData.lender} | recurring: ${formData.frequency}${formData.duration ? ` | duration: ${formData.duration}` : ''}${serializedPayments}`
      : formData.lender;

    try {
      let savedRow: any = null;
      if (editingDebt) {
        const { data } = await supabase.from('business_debts').update({
          lender: finalLender,
          amount: amount,
          due_date: formData.dueDate,
          status: formData.status
        }).eq('id', editingDebt.id).select().single();
        savedRow = data;
      } else {
        const { data } = await supabase.from('business_debts').insert({
          lender: finalLender,
          amount: amount,
          due_date: formData.dueDate,
          status: formData.status,
          business_id: businessId,
          user_id: user.id
        }).select().single();
        savedRow = data;
      }
      
      if (savedRow && bridge?.schedulePaymentNotifications) {
        try {
          const recurrence = parseLenderRecurrence(savedRow.lender);
          if (recurrence.isRecurring && recurrence.payments && recurrence.payments.length > 0) {
            const instancesToSchedule = recurrence.payments.map((p: any) => ({
              id: `${savedRow.id}_install_${p.id}`,
              dueDate: p.dueDate,
              amount: p.amount,
              status: p.status
            }));
            await bridge.schedulePaymentNotifications(instancesToSchedule, recurrence.lender);
          } else {
            await bridge.schedulePaymentNotifications([{
              id: savedRow.id,
              dueDate: savedRow.due_date,
              amount: savedRow.amount,
              status: savedRow.status
            }], recurrence.lender);
          }
          console.log('[Native App]: Scheduled business debt reminders');
        } catch (err) {
          console.error('[Native App] Error scheduling business reminders:', err);
        }
      }

      setShowModal(false);
      setEditingDebt(null);
      setFormData({ 
        lender: '', 
        amount: '', 
        dueDate: '', 
        status: 'unpaid', 
        isRecurring: false, 
        frequency: 'monthly', 
        duration: '',
        recurringAmount: '',
        payments: []
      });
      fetchDebts();
    } catch (error) {
       console.error("Error saving debt:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!debtToDelete) return;
    setLoading(true);
    try {
       if (bridge?.cancelNotification) {
         try {
           const recurrence = parseLenderRecurrence(debtToDelete.lender);
           if (recurrence.isRecurring && recurrence.payments) {
             for (const p of recurrence.payments) {
               try {
                 await bridge.cancelNotification(`${debtToDelete.id}_install_${p.id}`);
               } catch (e) {}
             }
           } else {
             try {
               await bridge.cancelNotification(debtToDelete.id);
             } catch (e) {}
           }
         } catch (cancelErr) {
           console.error('[Native App] Error removing scheduled alerts during delete:', cancelErr);
         }
       }

       await supabase.from('business_debts').delete().eq('id', debtToDelete.id);
       setShowDeleteModal(false);
       setDebtToDelete(null);
       fetchDebts();
    } catch (err) {
       console.error("Error deleting debt:", err);
    } finally {
       setLoading(false);
    }
  };

  const handleEdit = (debt: any) => {
    setEditingDebt(debt);
    const recurrence = parseLenderRecurrence(debt.lender);
    setFormData({
      lender: recurrence.lender,
      amount: debt.amount.toString(),
      dueDate: debt.due_date || '',
      status: debt.status,
      isRecurring: recurrence.isRecurring,
      frequency: recurrence.frequency || 'monthly',
      duration: recurrence.duration || '',
      recurringAmount: recurrence.recurringAmount ? recurrence.recurringAmount.toString() : '',
      payments: recurrence.payments || []
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingDebt(null);
    setFormData({ 
      lender: '', 
      amount: '', 
      dueDate: '', 
      status: 'unpaid', 
      isRecurring: false, 
      frequency: 'monthly', 
      duration: '',
      recurringAmount: '',
      payments: []
    });
    setShowModal(true);
  };

  const toggleDebtStatus = async (debt: any) => {
    const newStatus = debt.status === 'paid' ? 'unpaid' : 'paid';
    const recurrence = parseLenderRecurrence(debt.lender);
    
    const updatedPayments = recurrence.payments?.map((pw: any) => ({
      ...pw,
      status: newStatus
    })) || [];
    
    const serializedPayments = recurrence.isRecurring && updatedPayments.length > 0
      ? ` | recAmount: ${recurrence.recurringAmount || debt.amount} | payments: ${JSON.stringify(updatedPayments)}`
      : '';
    const updatedLender = recurrence.isRecurring
      ? `${recurrence.lender} | recurring: ${recurrence.frequency}${recurrence.duration ? ` | duration: ${recurrence.duration}` : ''}${serializedPayments}`
      : debt.lender;

    // Bridge notification sync
    if (bridge) {
      if (newStatus === 'paid') {
        if (recurrence.isRecurring && recurrence.payments) {
          for (const p of recurrence.payments) {
            try {
              await bridge.cancelNotification(`${debt.id}_install_${p.id}`);
            } catch (e) {}
          }
        } else {
          try {
            await bridge.cancelNotification(debt.id);
          } catch (e) {}
        }
      } else {
        // Reschedule
        if (bridge.schedulePaymentNotifications) {
          try {
             if (recurrence.isRecurring && updatedPayments.length > 0) {
               const instancesToSchedule = updatedPayments.map((p: any) => ({
                 id: `${debt.id}_install_${p.id}`,
                 dueDate: p.dueDate,
                 amount: p.amount,
                 status: 'unpaid'
               }));
               await bridge.schedulePaymentNotifications(instancesToSchedule, recurrence.lender);
             } else {
               await bridge.schedulePaymentNotifications([{
                 id: debt.id,
                 dueDate: debt.due_date,
                 amount: debt.amount,
                 status: 'unpaid'
               }], recurrence.lender);
             }
          } catch (err) {
             console.error('[Native Bridge] Error rescheduling during toggle:', err);
          }
        }
      }
    }

    try {
       await supabase.from('business_debts').update({ status: newStatus, lender: updatedLender }).eq('id', debt.id);
       fetchDebts();
    } catch (err) {
       console.error("Error updating debt status:", err);
    }
  };

  const handleToggleBusinessPaymentInstanceStatus = async (debt: any, instanceId: string) => {
    const recurrence = parseLenderRecurrence(debt.lender);
    if (!recurrence.payments) return;
    
    const updatedPayments = recurrence.payments.map((p: any) => {
      if (p.id === instanceId) {
        return { ...p, status: p.status === 'paid' ? 'unpaid' : 'paid' };
      }
      return p;
    });

    const toggledInstance = updatedPayments.find((p: any) => p.id === instanceId);
    
    // Bridge notifications sync
    if (toggledInstance && bridge) {
      if (toggledInstance.status === 'paid') {
        try {
          await bridge.cancelNotification(`${debt.id}_install_${instanceId}`);
        } catch (e) {}
      } else if (bridge.schedulePaymentNotifications) {
        try {
          await bridge.schedulePaymentNotifications([{
            id: `${debt.id}_install_${instanceId}`,
            dueDate: toggledInstance.dueDate,
            amount: toggledInstance.amount,
            status: 'unpaid'
          }], recurrence.lender);
        } catch (err) {
          console.error('[Native Bridge] Error rescheduling instance during toggle:', err);
        }
      }
    }

    const allPaid = updatedPayments.every((p: any) => p.status === 'paid');
    const updatedStatus = allPaid ? 'paid' : 'unpaid';

    const serializedPayments = recurrence.isRecurring && updatedPayments.length > 0
      ? ` | recAmount: ${recurrence.recurringAmount || debt.amount} | payments: ${JSON.stringify(updatedPayments)}`
      : '';
    const updatedLender = recurrence.isRecurring
      ? `${recurrence.lender} | recurring: ${recurrence.frequency}${recurrence.duration ? ` | duration: ${recurrence.duration}` : ''}${serializedPayments}`
      : debt.lender;

    try {
      await supabase.from('business_debts').update({
        status: updatedStatus,
        lender: updatedLender
      }).eq('id', debt.id);
      fetchDebts();
    } catch (err) {
      console.error("Error toggling business payment instance:", err);
    }
  };

  const handleSyncToCalendar = async (debt: any) => {
    if (!isPremium) {
      setUpgradeFeature('Calendar Sync');
      setShowUpgradeModal(true);
      return;
    }

    if (bridge?.syncToCalendar) {
      try {
        const recurrence = parseLenderRecurrence(debt.lender);
        const instances = recurrence.isRecurring && recurrence.payments && recurrence.payments.length > 0
          ? recurrence.payments.map((p: any) => ({
              id: `${debt.id}_install_${p.id}`,
              dueDate: p.dueDate,
              amount: p.amount
            }))
          : [{
              id: debt.id,
              dueDate: debt.due_date,
              amount: debt.amount
            }];

        const success = await bridge.syncToCalendar(instances, recurrence.lender);
        if (success) {
          alert(`Successfully synced "${recurrence.lender}" to calendar!`);
        } else {
          alert('Could not sync to device calendar. Verify calendar app permissions.');
        }
      } catch (err) {
        console.error('[Calendar Sync Error] failed native bridge call:', err);
      }
    }
  };

  const handleScanReceipt = async () => {
    if (!isPremium) {
      setUpgradeFeature('Receipt Scanning OCR');
      setShowUpgradeModal(true);
      return;
    }

    if (bridge?.scanReceipt) {
      try {
        setLoading(true);
        const result = await bridge.scanReceipt();
        if (result) {
          setFormData(prev => ({
            ...prev,
            lender: result.merchant || prev.lender,
            amount: result.amount ? result.amount.toString() : prev.amount,
            dueDate: result.date || prev.dueDate
          }));
          alert(`OCR Read Success! Auto-filled lender "${result.merchant || 'N/A'}" and amount: ${result.amount || 'N/A'}.`);
        } else {
          alert('Could not auto-fill details from receipt text. Please input values manually.');
        }
      } catch (err) {
        console.error('[Receipt OCR Error]: Exception calling bridge:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, currencyCode);
  };

  const getTotals = () => {
    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);
    const startOfWeekStr = new Date(startOfWeek.getTime() - (startOfWeek.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const startOfQuarterStr = new Date(startOfQuarter.getTime() - (startOfQuarter.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const startOfYearStr = new Date(startOfYear.getTime() - (startOfYear.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let tToday = 0;
    let tWeek = 0;
    let tQuarter = 0;
    let tYear = 0;

    debts.forEach(d => {
      let dStr = new Date(new Date(d.created_at).getTime() - (new Date(d.created_at).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      if (dStr === todayStr) tToday += d.amount;
      if (dStr >= startOfWeekStr && dStr <= todayStr) tWeek += d.amount;
      if (dStr >= startOfQuarterStr && dStr <= todayStr) tQuarter += d.amount;
      if (dStr >= startOfYearStr && dStr <= todayStr) tYear += d.amount;
    });

    return { today: tToday, week: tWeek, quarter: tQuarter, year: tYear };
  };

  const totals = getTotals();

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pr-12">
        <button onClick={() => navigate(`/business/${businessId}`)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
           <CreditCard className="text-red-500" /> Business Debts
        </h1>
        <div className="w-4"></div>
      </div>

      {/* Summary Totals */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
           <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Today</p>
           <h3 className="text-lg font-black text-red-500">{formatCurrency(totals.today)}</h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
           <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Week</p>
           <h3 className="text-lg font-black text-red-500">{formatCurrency(totals.week)}</h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
           <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Quarter</p>
           <h3 className="text-lg font-black text-red-500">{formatCurrency(totals.quarter)}</h3>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
           <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Year</p>
           <h3 className="text-lg font-black text-red-500">{formatCurrency(totals.year)}</h3>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
         <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex items-center px-4 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input 
              className="w-full bg-transparent border-none p-3 text-sm focus:ring-0" 
              placeholder="Search debts..." 
            />
         </div>
         <button onClick={handleAddClick} className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {loading && debts.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading debts...</div>
      ) : debts.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
              <CreditCard size={32} />
           </div>
           <h2 className="text-lg font-bold text-gray-900 mb-2">No debts recorded</h2>
           <p className="text-xs text-gray-500 mb-8 max-w-xs mx-auto">Track what your business owes to suppliers or banks here.</p>
           <button onClick={handleAddClick} className="bg-gray-900 text-white font-bold py-3 px-6 rounded-xl text-sm">Record First Debt</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
            {debts.map((d) => {
               const recurrence = parseLenderRecurrence(d.lender);
               return (
                  <div key={d.id} className={`bg-white p-5 rounded-3xl border border-gray-50 flex flex-col gap-2 shadow-sm transition-opacity ${d.status === 'paid' ? 'opacity-70' : 'opacity-100'}`}>
                     <div className="flex items-center justify-between gap-4">
                        <div 
                          onClick={() => {
                            if (recurrence.isRecurring) {
                              setExpandedDebtId(expandedDebtId === d.id ? null : d.id);
                            }
                          }}
                          className={`flex items-center gap-4 flex-1 min-w-0 ${recurrence.isRecurring ? 'cursor-pointer hover:bg-gray-50/50 p-1.5 -ml-1.5 rounded-2xl transition-all' : ''}`}
                        >
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               toggleDebtStatus(d);
                             }}
                             className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${d.status === 'paid' ? 'bg-green-50 text-green-600 shadow-sm shadow-green-100' : 'bg-red-50 text-red-500'}`}
                           >
                              {d.status === 'paid' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                           </button>
                           <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-gray-900 text-sm truncate max-w-[200px]" title={recurrence.lender}>
                                {recurrence.lender}
                              </h4>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                 <div className="flex items-center gap-2 select-none flex-wrap">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                                       <Calendar size={10} /> {d.due_date || 'No due date'}
                                    </span>
                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${d.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                       {d.status}
                                    </span>
                                 </div>
                                 {recurrence.isRecurring && (
                                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
                                       <RotateCw size={10} className="animate-spin-slow-less" /> 
                                       Recurring ({recurrence.frequency}{recurrence.duration ? `, for ${recurrence.duration}` : ''})
                                       {expandedDebtId === d.id ? <ChevronUp size={12} className="text-gray-500 ml-1 inline" /> : <ChevronDown size={12} className="text-gray-500 ml-1 inline" />}
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                              <div className="font-extrabold text-gray-900 text-sm">{formatCurrency(d.amount)}</div>
                           </div>
                           <div className="flex flex-col gap-1 items-end">
                              <div className="flex gap-1.5">
                                 <button onClick={() => handleEdit(d)} className="p-1.5 bg-gray-50 rounded-lg text-gray-400 hover:text-brand-600 active:scale-95 transition-all">
                                    <Edit2 size={16} />
                                 </button>
                                 <button onClick={() => { setDebtToDelete(d); setShowDeleteModal(true); }} className="p-1.5 bg-gray-50 rounded-lg text-gray-300 hover:text-red-500 active:scale-95 transition-all">
                                    <Trash2 size={18} />
                                 </button>
                              </div>
                              <div className="flex gap-1.5 justify-end">
                                <button type="button" onClick={() => handleSyncToCalendar(d)} className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 flex items-center gap-1 transition-colors">
                                  Sync
                                </button>
                                <button 
                                   onClick={() => toggleDebtStatus(d)}
                                   className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${d.status === 'paid' ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                >
                                   {d.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                </button>
                              </div>
                           </div>
                        </div>
                     </div>

                     {recurrence.isRecurring && expandedDebtId === d.id && (
                        <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/55 flex flex-col gap-2">
                          <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex justify-between">
                            <span>Dynamic Installments Timeline</span>
                            <span>Tap installment to check off</span>
                          </div>
                          {(!recurrence.payments || recurrence.payments.length === 0) ? (
                            <div className="flex flex-col gap-1.5 items-center py-4 bg-white rounded-xl border border-dashed border-gray-200">
                              <p className="text-xs text-gray-400 italic font-medium">No installment schedule generated yet.</p>
                              <button 
                                type="button"
                                onClick={() => {
                                  // Auto generate schedule for old database rows that have isRecurring but no instals
                                  const parsedAmount = recurrence.recurringAmount || d.amount;
                                  const generated = generateRecurringPayments(d.due_date || new Date().toISOString().split('T')[0], recurrence.frequency || 'monthly', recurrence.duration || '3 months', parsedAmount);
                                  const serializedPayments = ` | recAmount: ${recurrence.recurringAmount || d.amount} | payments: ${JSON.stringify(generated)}`;
                                  const updatedLender = `${recurrence.lender} | recurring: ${recurrence.frequency}${recurrence.duration ? ` | duration: ${recurrence.duration}` : ''}${serializedPayments}`;
                                  supabase.from('business_debts').update({
                                    lender: updatedLender
                                  }).eq('id', d.id).then(() => fetchDebts());
                                }}
                                className="text-xs font-bold text-brand-600 hover:underline"
                              >
                                Generate Schedule
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5 mt-1">
                              {recurrence.payments.map((p: any, idx: number) => (
                                <div 
                                  key={p.id} 
                                  onClick={() => handleToggleBusinessPaymentInstanceStatus(d, p.id)}
                                  className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer select-none shadow-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${p.status === 'paid' ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200' : 'border-gray-300'}`}>
                                      {p.status === 'paid' && <Check size={12} strokeWidth={4} />}
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-800 font-bold block">Installment #{idx + 1}</span>
                                      <span className="text-[10px] text-gray-400 font-semibold">{new Date(p.dueDate).toLocaleDateString('en-GB')}</span>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-3">
                                    <span className="text-xs font-black text-gray-800">
                                       {formatCurrency(p.amount || d.amount)}
                                    </span>
                                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${p.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                       {p.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                     )}
                  </div>
               );
            })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDebtToDelete(null); }}
        onConfirm={handleDelete}
        itemName={debtToDelete ? debtToDelete.lender : undefined}
      />

      <ModalTracker isOpen={showModal || showDeleteModal} />
      {/* Debt Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setEditingDebt(null); }}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3 text-red-600">
                     <CreditCard /> {editingDebt ? 'Edit' : 'Record'} Business Debt
                  </h2>
                  <button 
                    onClick={() => { setShowModal(false); setEditingDebt(null); }}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Premium OCR Receipt Reader */}
                  <button
                    type="button"
                    onClick={handleScanReceipt}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500/10 to-amber-600/5 hover:from-amber-500/15 hover:to-amber-500/10 text-amber-800 hover:text-amber-900 font-bold text-xs py-3.5 px-4 rounded-2xl border border-dashed border-amber-300 w-full transition-all duration-300 cursor-pointer"
                  >
                    <Sparkles size={14} className="text-amber-600 shrink-0" />
                    <span>Auto-Fill From Bill / Receipt Scan</span>
                  </button>

                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Lender / Source</label>
                     <input 
                       required
                       value={formData.lender}
                       onChange={(e) => setFormData({...formData, lender: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="e.g. Acme Bank, Supplier X"
                     />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount Owed</label>
                     <input 
                       required
                       type="number"
                       value={formData.amount}
                       onChange={(e) => setFormData({...formData, amount: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="0.00"
                     />
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Repayment Date (Optional)</label>
                     <input 
                       type="date"
                       value={formData.dueDate}
                       onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                     />
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl flex flex-col gap-3 border border-gray-100/10">
                     <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={formData.isRecurring}
                          onChange={(e) => setFormData({...formData, isRecurring: e.target.checked})}
                          className="w-5 h-5 rounded-md text-brand-600 focus:ring-brand-500"
                        />
                        <div>
                           <div className="text-xs font-bold text-gray-800 uppercase">Is Repayment Recurring?</div>
                           <div className="text-[10px] text-gray-500 font-medium">Do you have multiple repayment dates?</div>
                        </div>
                     </label>

                     {formData.isRecurring && (
                        <div className="flex flex-col gap-3 pl-8">
                           <div className="flex flex-col gap-1.5 pl-0">
                              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Frequency</label>
                              <select
                                value={formData.frequency}
                                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                                className="bg-white border border-gray-100 rounded-xl p-3 text-sm text-gray-800 font-bold focus:ring-2 focus:ring-brand-500"
                              >
                                 <option value="weekly">Weekly</option>
                                 <option value="monthly">Monthly</option>
                                 <option value="yearly">Yearly</option>
                              </select>
                           </div>

                           <div className="flex flex-col gap-1.5 pl-0">
                              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Duration / Limit</label>
                              <input 
                                type="text"
                                value={formData.duration || ''}
                                onChange={(e) => setFormData({...formData, duration: e.target.value})}
                                placeholder="e.g. 3 months, 6 weeks, until paid"
                                className="bg-white border border-gray-100 rounded-xl p-3 text-sm text-gray-800 font-semibold focus:ring-2 focus:ring-brand-500"
                              />
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {['3 weeks', '6 weeks', '3 months', '6 months', '1 year'].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setFormData({...formData, duration: preset})}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                                      formData.duration === preset 
                                        ? 'bg-red-500 text-white border-red-500' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                           </div>

                           <div className="flex flex-col gap-1.5 pl-0">
                             <label className="text-xs font-bold text-gray-500 uppercase ml-1">Payment Amount per Cycle</label>
                             <input 
                               type="number"
                               step="0.01"
                               value={formData.recurringAmount}
                               onChange={(e) => setFormData({...formData, recurringAmount: e.target.value})}
                               placeholder="Defaults to total amount"
                               className="bg-white border border-gray-100 rounded-xl p-3 text-sm text-gray-800 font-bold focus:ring-2 focus:ring-brand-500"
                             />
                           </div>

                           {formData.payments.length > 0 && (
                             <div className="p-3 bg-white border border-gray-200 rounded-2xl flex flex-col gap-2 mt-2">
                               <div className="flex justify-between items-center mb-1">
                                 <span className="text-[10px] font-bold text-gray-500 uppercase">Installments List ({formData.payments.length})</span>
                                 <button 
                                   type="button" 
                                   onClick={() => {
                                     const parsedTotal = parseFloat(formData.amount) || 0;
                                     const parsedRecAmt = parseFloat(formData.recurringAmount) || parsedTotal;
                                     setFormData({
                                       ...formData,
                                       payments: generateRecurringPayments(formData.dueDate || new Date().toISOString().split('T')[0], formData.frequency, formData.duration, parsedRecAmt)
                                     });
                                   }} 
                                   className="text-[9px] font-extrabold text-brand-600 hover:text-brand-700"
                                 >
                                   Reset List
                                 </button>
                               </div>
                               <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                 {formData.payments.map((p, idx) => (
                                   <div key={p.id} className="flex gap-2 items-center justify-between border-b border-gray-50 pb-2 last:border-none last:pb-0">
                                     <span className="text-xs text-gray-400 font-bold">#{idx + 1}</span>
                                     <input 
                                       type="date"
                                       value={p.dueDate}
                                       onChange={(e) => {
                                         const updated = [...formData.payments];
                                         updated[idx] = { ...updated[idx], dueDate: e.target.value };
                                         setFormData({ ...formData, payments: updated });
                                       }}
                                       className="bg-gray-50 p-1 px-1.5 border border-gray-100 rounded text-[11px] font-bold outline-none text-gray-700 w-[110px]"
                                     />
                                     <div className="flex items-center gap-0.5">
                                       <span className="text-[11px] text-gray-400 font-bold">{currencyCode}</span>
                                       <input 
                                         type="number"
                                         value={p.amount}
                                         onChange={(e) => {
                                           const updated = [...formData.payments];
                                           updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                                           setFormData({ ...formData, payments: updated });
                                         }}
                                         className="bg-gray-50 p-1 px-1.5 border border-gray-100 rounded text-[11px] font-bold outline-none w-16 text-right text-gray-700"
                                       />
                                     </div>
                                     <select
                                       value={p.status}
                                        onChange={(e) => {
                                          const updated = [...formData.payments];
                                          updated[idx] = { ...updated[idx], status: e.target.value as any };
                                          setFormData({ ...formData, payments: updated });
                                        }}
                                        className="bg-gray-50 p-1 border border-gray-100 rounded text-[10px] font-extrabold outline-none text-gray-600"
                                      >
                                        <option value="unpaid">Unpaid</option>
                                        <option value="paid">Paid</option>
                                      </select>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                        </div>
                     )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="mt-4 bg-gray-900 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg"
                  >
                    {loading ? 'Saving...' : editingDebt ? 'Update Record' : 'Record Debt'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <UpgradePrompt 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        featureName={upgradeFeature}
        onSuccess={() => refreshPremiumStatus()}
      />
    </div>
  );
}
