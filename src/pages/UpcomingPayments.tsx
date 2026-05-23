import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Calendar, Clock, RotateCw, X, CheckCircle2, Edit2, Trash2, CalendarDays
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../hooks/useNativeBridge';
import UpgradePrompt from '../components/UpgradePrompt';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/currency';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

export default function UpcomingPayments() {
  const { user, userProfile } = useAuth();
  const { bridge, isPremium, refreshPremiumStatus } = useNativeBridge();
  const navigate = useNavigate();
  const currencyCode = userProfile?.currency || 'USD';
  
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Calendar Sync');

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    is_recurring: false,
    frequency: 'monthly' // daily, weekly, monthly, yearly
  });

  const handleEdit = (payment: any) => {
    setEditingPayment(payment);
    setFormData({
      title: payment.title,
      amount: payment.amount.toString(),
      dueDate: payment.due_date,
      is_recurring: payment.is_recurring || false,
      frequency: payment.frequency || 'monthly'
    });
    setShowModal(true);
  };

  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    
    const fetchPayments = async () => {
      const { data } = await supabase.from('upcoming_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });
      if (data) setPayments(data);
      setLoading(false);
    };

    fetchPayments();

    const channel = supabase.channel('upcoming-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upcoming_payments', filter: `user_id=eq.${user.id}` }, () => {
        supabase.from('upcoming_payments').select('*').eq('user_id', user.id).order('due_date', { ascending: true }).then(({ data }) => {
          if (data) setPayments(data);
        });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;
    
    setLoading(true);
    try {
      let savedRow: any = null;
      if (editingPayment) {
        const { data } = await supabase.from('upcoming_payments').update({
          title: formData.title,
          amount: parseFloat(formData.amount),
          due_date: formData.dueDate,
          is_recurring: formData.is_recurring,
          frequency: formData.is_recurring ? formData.frequency : null,
        }).eq('id', editingPayment.id).select().single();
        savedRow = data;
      } else {
        const { data } = await supabase.from('upcoming_payments').insert({
          user_id: user.id,
          title: formData.title,
          amount: parseFloat(formData.amount),
          due_date: formData.dueDate,
          is_recurring: formData.is_recurring,
          frequency: formData.is_recurring ? formData.frequency : null,
          created_at: new Date().toISOString(),
        }).select().single();
        savedRow = data;
      }

      if (savedRow && bridge?.schedulePaymentNotifications) {
        try {
          await bridge.schedulePaymentNotifications([{
            id: savedRow.id,
            dueDate: savedRow.due_date,
            amount: savedRow.amount,
            status: 'unpaid'
          }], savedRow.title);
          console.log('[Native Bridge]: Scheduled notification reminder for', savedRow.title);
        } catch (err) {
          console.error('[Native Bridge] Error scheduling notification:', err);
        }
      }

      setShowModal(false);
      setEditingPayment(null);
      setFormData({
        title: '', amount: '', dueDate: format(new Date(), 'yyyy-MM-dd'), is_recurring: false, frequency: 'monthly'
      });
    } catch (err) {
      console.error("Error saving payment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (payment: any) => {
    setLoading(true);
    try {
      if (bridge?.cancelNotification) {
        try {
          await bridge.cancelNotification(payment.id);
        } catch (err) {
          console.error('[Native Bridge] Error cancelling notification:', err);
        }
      }

      if (payment.is_recurring && payment.frequency) {
        const currentDueDate = new Date(payment.due_date);
        let nextDueDate;
        switch(payment.frequency) {
            case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
            case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
            case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
            case 'yearly': nextDueDate = addYears(currentDueDate, 1); break;
            default: nextDueDate = addMonths(currentDueDate, 1);
        }
        
        const { data: updatedRow } = await supabase.from('upcoming_payments').update({
            due_date: format(nextDueDate, 'yyyy-MM-dd')
        }).eq('id', payment.id).select().single();

        // Reschedule notification for next occurrence
        if (updatedRow && bridge?.schedulePaymentNotifications) {
          try {
            await bridge.schedulePaymentNotifications([{
              id: updatedRow.id,
              dueDate: updatedRow.due_date,
              amount: updatedRow.amount,
              status: 'unpaid'
            }], updatedRow.title);
            console.log('[Native Bridge]: Rescheduled recurring reminder for next period on', updatedRow.due_date);
          } catch (err) {
            console.error('[Native Bridge] Error rescheduling recurring notification:', err);
          }
        }
      } else {
        await supabase.from('upcoming_payments').delete().eq('id', payment.id);
      }
    } catch(err) {
      console.error("Error marking paid:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async () => {
      if (!paymentToDelete) return;
      setLoading(true);
      try {
          if (bridge?.cancelNotification) {
            try {
              await bridge.cancelNotification(paymentToDelete.id);
            } catch (err) {
              console.error('[Native Bridge] Error cancelling notification of deleted payment:', err);
            }
          }

          await supabase.from('upcoming_payments').delete().eq('id', paymentToDelete.id);
          setShowDeleteModal(false);
          setPaymentToDelete(null);
      } catch(err) {
          console.error("Error deleting payment:", err);
      } finally {
          setLoading(false);
      }
  };

  const handleSyncToCalendar = async (payment: any) => {
    if (!isPremium) {
      setUpgradeFeature('Calendar Sync');
      setShowUpgradeModal(true);
      return;
    }

    if (bridge?.syncToCalendar) {
      try {
        const success = await bridge.syncToCalendar([{
          id: payment.id,
          dueDate: payment.due_date,
          amount: payment.amount
        }], payment.title);

        if (success) {
          alert(`Successfully synced "${payment.title}" to device calendar!`);
        } else {
          alert('Could not sync to device calendar. Verify calendar app permissions.');
        }
      } catch (err) {
        console.error('[Calendar Sync Error] failed native bridge call:', err);
      }
    }
  };

  // Group by month
  const groupedPayments: { [month: string]: typeof payments } = {};
  payments.forEach(p => {
      if (!p.due_date) return;
      const monthStr = format(new Date(p.due_date), 'MMMM yyyy');
      if (!groupedPayments[monthStr]) groupedPayments[monthStr] = [];
      groupedPayments[monthStr].push(p);
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-2 pr-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Upcoming Payments</h1>
            <p className="text-xs text-gray-500">Plan and track your bills</p>
          </div>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(85,68,232,0.3)] active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-8 pb-32">
        {Object.keys(groupedPayments).length === 0 ? (
           <div className="text-center py-10">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CalendarDays className="text-gray-400" size={28} />
              </div>
              <p className="text-gray-500 font-medium">No upcoming payments</p>
              <p className="text-xs text-gray-400 mt-1">Tap + to add a reminder</p>
           </div>
        ) : (
           Object.entries(groupedPayments).map(([month, items]) => (
               <div key={month}>
                   <h3 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3 ml-2">{month}</h3>
                   <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                       {items.map((payment, idx) => (
                           <div key={payment.id} className={`p-4 flex items-center justify-between ${idx !== items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                               <div className="flex items-center gap-3">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${new Date(payment.due_date) < new Date() ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                                       {payment.is_recurring ? <RotateCw size={20} /> : <Calendar size={20} />}
                                   </div>
                                   <div>
                                       <h4 className="font-bold text-gray-900">{payment.title}</h4>
                                       <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                           <Clock size={12} /> {format(new Date(payment.due_date), 'MMM d, yyyy')}
                                           {payment.is_recurring && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded uppercase">{payment.frequency}</span>}
                                       </p>
                                   </div>
                               </div>
                               <div className="flex flex-col items-end">
                                   <p className="font-bold text-gray-900">{formatCurrency(payment.amount, currencyCode)}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                       <button onClick={() => { setPaymentToDelete(payment); setShowDeleteModal(true); }} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={14} />
                                       </button>
                                       <button onClick={() => handleEdit(payment)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-brand-600 transition-colors">
                                            <Edit2 size={14} />
                                       </button>
                                       <button onClick={() => handleMarkPaid(payment)} className="text-[10px] text-brand-600 font-bold uppercase tracking-wider bg-brand-50 px-2 py-1 rounded">Mark Paid</button>
                                        <button type="button" onClick={() => handleSyncToCalendar(payment)} className="text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                                             <CalendarDays size={10} /> Sync
                                        </button>
                                   </div>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
           ))
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setPaymentToDelete(null); }}
        onConfirm={handleDelete}
        itemName={paymentToDelete ? paymentToDelete.title : undefined}
      />

      <UpgradePrompt 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        featureName={upgradeFeature}
        onSuccess={() => refreshPremiumStatus()}
      />

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowModal(false); setEditingPayment(null); }} className="fixed inset-0 bg-black/40 z-[60]" />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }} 
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">{editingPayment ? 'Edit Reminder' : 'Add Payment Reminder'}</h2>
                  <button onClick={() => { setShowModal(false); setEditingPayment(null); }} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"><X size={18} /></button>
               </div>
               
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Payment Title</label>
                      <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium" placeholder="E.g., Netflix, Rent" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount</label>
                      <input required type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold text-lg" placeholder="0.00" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">First/Next Due Date</label>
                      <input required type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium" />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl mt-2 cursor-pointer transition-colors" onClick={() => setFormData({...formData, is_recurring: !formData.is_recurring})}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${formData.is_recurring ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                          {formData.is_recurring && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                      <span className="font-bold text-gray-700">This is a recurring payment</span>
                  </div>

                  {formData.is_recurring && (
                      <div className="flex flex-col gap-1.5 mt-2 animate-in slide-in-from-top-2">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Frequency</label>
                          <select value={formData.frequency} onChange={(e) => setFormData({...formData, frequency: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium appearance-none">
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="yearly">Yearly</option>
                          </select>
                      </div>
                  )}

                  <button type="submit" disabled={loading} className="mt-4 bg-brand-600 text-white font-bold py-4 rounded-2xl w-full hover:bg-brand-700 active:scale-95 transition-all shadow-[0_8px_20px_-6px_rgba(85,68,232,0.6)]">
                      {loading ? 'Saving...' : 'Add Reminder'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
