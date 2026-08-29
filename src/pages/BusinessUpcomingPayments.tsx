import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Calendar, Clock, RotateCw, X, CheckCircle2, Edit2, Trash2, CalendarDays, Building2
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../hooks/useNativeBridge';
import UpgradePrompt from '../components/UpgradePrompt';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { ModalTracker } from '../components/ModalTracker';

export default function BusinessUpcomingPayments() {
  const { businessId } = useParams();
  const { user, userProfile } = useAuth();
  const { bridge, isPremium, refreshPremiumStatus } = useNativeBridge();
  const navigate = useNavigate();
  const currencyCode = userProfile?.currency || 'USD';
  
  const [business, setBusiness] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Calendar Sync');
  const [hasBusinessIdColumn, setHasBusinessIdColumn] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    is_recurring: false,
    frequency: 'monthly' // daily, weekly, monthly, yearly
  });

  const getCleanTitle = (fullTitle: string) => {
    if (!fullTitle) return '';
    if (fullTitle.startsWith(`[Biz:${businessId}] `)) {
      return fullTitle.replace(`[Biz:${businessId}] `, '');
    }
    return fullTitle;
  };

  const checkColumnSupport = async () => {
    try {
      const { error } = await supabase.from('upcoming_payments').select('business_id').limit(1);
      if (error) {
        console.warn('business_id column check error:', error);
        setHasBusinessIdColumn(false);
        return false;
      }
      setHasBusinessIdColumn(true);
      return true;
    } catch (err) {
      console.warn('business_id column check exception:', err);
      setHasBusinessIdColumn(false);
      return false;
    }
  };

  const handleEdit = (payment: any) => {
    setEditingPayment(payment);
    setFormData({
      title: getCleanTitle(payment.title),
      amount: payment.amount.toString(),
      dueDate: payment.due_date,
      is_recurring: payment.is_recurring || false,
      frequency: payment.frequency || 'monthly'
    });
    setShowModal(true);
  };

  useEffect(() => {
    if (!businessId || !user) return;

    // Fetch business details
    supabase.from('businesses').select('*').eq('id', businessId).single().then(({ data }) => {
      if (data) setBusiness(data);
    });

    const initAndFetch = async () => {
      setLoading(true);
      let isSupported = hasBusinessIdColumn;
      if (isSupported === null) {
        isSupported = await checkColumnSupport();
      }

      await fetchPayments(isSupported);
    };

    const fetchPayments = async (isColSupported: boolean) => {
      try {
        let query = supabase.from('upcoming_payments')
          .select('*')
          .eq('user_id', user?.id);

        if (isColSupported) {
          query = query.eq('business_id', businessId);
        }

        const { data } = await query.order('due_date', { ascending: true });
        
        if (data) {
          if (isColSupported) {
            setPayments(data);
          } else {
            // Fallback: filter prefix
            const filtered = data.filter((p: any) => p.title.startsWith(`[Biz:${businessId}] `));
            setPayments(filtered);
          }
        }
      } catch (err) {
        console.error("Error fetching payments:", err);
      } finally {
        setLoading(false);
      }
    };

    initAndFetch();

    const channel = supabase.channel(`upcoming-biz-payments-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upcoming_payments', filter: `user_id=eq.${user.id}` }, async () => {
        let isColSupported = hasBusinessIdColumn;
        if (isColSupported === null) {
          isColSupported = await checkColumnSupport();
        }
        fetchPayments(isColSupported);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, businessId, hasBusinessIdColumn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading || !businessId) return;
    
    setLoading(true);
    try {
      const isColSupported = hasBusinessIdColumn !== null ? hasBusinessIdColumn : await checkColumnSupport();
      const dbTitle = isColSupported ? formData.title : `[Biz:${businessId}] ${formData.title}`;

      let savedRow: any = null;
      if (editingPayment) {
        const updatePayload: any = {
          title: dbTitle,
          amount: parseFloat(formData.amount),
          due_date: formData.dueDate,
          is_recurring: formData.is_recurring,
          frequency: formData.is_recurring ? formData.frequency : null,
        };
        if (isColSupported) {
          updatePayload.business_id = businessId;
        }

        const { data, error } = await supabase.from('upcoming_payments')
          .update(updatePayload)
          .eq('id', editingPayment.id)
          .select()
          .single();
        if (error) console.error("Update error:", error);
        savedRow = data;
      } else {
        const insertPayload: any = {
          user_id: user?.id,
          title: dbTitle,
          amount: parseFloat(formData.amount),
          due_date: formData.dueDate,
          is_recurring: formData.is_recurring,
          frequency: formData.is_recurring ? formData.frequency : null,
          created_at: new Date().toISOString(),
          status: 'unpaid'
        };
        if (isColSupported) {
          insertPayload.business_id = businessId;
        }

        const { data, error } = await supabase.from('upcoming_payments')
          .insert(insertPayload)
          .select()
          .single();
        if (error) console.error("Insert error:", error);
        savedRow = data;
      }

      if (savedRow && bridge?.schedulePaymentNotifications) {
        try {
          await bridge.schedulePaymentNotifications([{
            id: savedRow.id,
            dueDate: savedRow.due_date,
            amount: savedRow.amount,
            status: 'unpaid'
          }], formData.title);
          console.log('[Native Bridge]: Scheduled notification reminder for', formData.title);
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

      // Record a real business expense transaction for this paid commitment
      await supabase.from('business_transactions').insert({
        user_id: user?.id,
        business_id: businessId,
        type: 'expense',
        amount: payment.amount,
        category: 'bills',
        note: `Paid commitment: ${getCleanTitle(payment.title)}`,
        date: new Date().toISOString().split('T')[0]
      });

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
        
        await supabase.from('upcoming_payments').update({
            due_date: format(nextDueDate, 'yyyy-MM-dd')
        }).eq('id', payment.id);

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
        const titleClean = getCleanTitle(payment.title);
        const success = await bridge.syncToCalendar([{
          id: payment.id,
          dueDate: payment.due_date,
          amount: payment.amount
        }], titleClean);

        if (success) {
          alert(`Successfully synced "${titleClean}" to device calendar!`);
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
      <div className="flex items-center justify-between mb-8 px-2 pr-20 pt-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm border border-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
              <Building2 className="text-orange-600" size={20} /> Operational Commitments
            </h1>
            <p className="text-xs text-gray-500">Track and schedule upcoming business bills & payables</p>
          </div>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)] active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-8 pb-32">
        {Object.keys(groupedPayments).length === 0 ? (
           <div className="text-center py-16">
              <div className="w-16 h-16 bg-orange-50/50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CalendarDays className="text-orange-500" size={28} />
              </div>
              <p className="text-gray-900 font-bold text-base">All clear!</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">No outstanding operational commitments scheduled for this business.</p>
           </div>
        ) : (
           Object.entries(groupedPayments).map(([month, items]) => (
                <div key={month}>
                    <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-3 ml-2">{month}</h3>
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                        {items.map((payment, idx) => (
                            <div key={payment.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${idx !== items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center ${new Date(payment.due_date) < new Date() ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {payment.is_recurring ? <RotateCw size={20} /> : <Calendar size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="font-bold text-gray-900 truncate">{getCleanTitle(payment.title)}</h4>
                                            <p className="font-bold text-gray-950 text-[15px] whitespace-nowrap block sm:hidden">{formatCurrencyGlobal(payment.amount, currencyCode)}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 min-w-0">
                                            <Clock size={12} className="flex-shrink-0" />
                                            <span className="truncate">{format(new Date(payment.due_date), 'MMM d, yyyy')}</span>
                                            {payment.is_recurring && <span className="ml-1 flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded uppercase font-bold text-gray-600">{payment.frequency}</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-row items-center justify-end sm:flex-col sm:items-end flex-shrink-0 sm:pl-2 w-full sm:w-auto mt-2 sm:mt-0">
                                    <p className="font-bold text-gray-950 text-sm sm:text-base whitespace-nowrap hidden sm:block">{formatCurrencyGlobal(payment.amount, currencyCode)}</p>
                                    <div className="flex items-center gap-1 sm:gap-2 mt-0 sm:mt-2 w-full sm:w-auto justify-end">
                                        <button onClick={() => { setPaymentToDelete(payment); setShowDeleteModal(true); }} className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                                             <Trash2 size={16} className="sm:w-3.5 sm:h-3.5" />
                                        </button>
                                        <button onClick={() => handleEdit(payment)} className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center text-gray-400 hover:text-orange-600 transition-colors">
                                             <Edit2 size={16} className="sm:w-3.5 sm:h-3.5" />
                                        </button>
                                        <button onClick={() => handleMarkPaid(payment)} className="text-xs sm:text-[10px] text-orange-600 font-extrabold uppercase tracking-wider bg-orange-50 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-xl transition-all ml-1">Mark Paid</button>
                                         <button type="button" onClick={() => handleSyncToCalendar(payment)} className="text-xs sm:text-[10px] text-amber-600 font-extrabold uppercase tracking-wider bg-amber-50 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-xl flex items-center gap-1 transition-all ml-2 sm:ml-0">
                                              <CalendarDays size={14} className="sm:w-2.5 sm:h-2.5" /> Sync
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
        itemName={paymentToDelete ? getCleanTitle(paymentToDelete.title) : undefined}
      />

      <UpgradePrompt 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        featureName={upgradeFeature}
        onSuccess={() => refreshPremiumStatus()}
      />

      <ModalTracker isOpen={showModal || showDeleteModal || showUpgradeModal} />
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
                  <h2 className="text-lg font-black text-gray-900">{editingPayment ? 'Edit Commitment' : 'Add Commitment'}</h2>
                  <button onClick={() => { setShowModal(false); setEditingPayment(null); }} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"><X size={18} /></button>
               </div>
               
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">Commitment Title</label>
                      <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold" placeholder="E.g., Supplier Bill, Host Server, Office Rent" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">Amount</label>
                      <input required type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-extrabold text-lg" placeholder="0.00" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">First/Next Due Date</label>
                      <input required type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold" />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl mt-2 cursor-pointer transition-colors" onClick={() => setFormData({...formData, is_recurring: !formData.is_recurring})}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${formData.is_recurring ? 'bg-orange-600 border-orange-600' : 'border-gray-300'}`}>
                          {formData.is_recurring && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                      <span className="font-black text-gray-800 text-sm">This is a recurring commitment</span>
                  </div>

                  {formData.is_recurring && (
                      <div className="flex flex-col gap-1.5 mt-2 animate-in slide-in-from-top-2">
                          <label className="text-xs font-bold text-gray-400 uppercase ml-1">Frequency</label>
                          <select value={formData.frequency} onChange={(e) => setFormData({...formData, frequency: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold appearance-none">
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="yearly">Yearly</option>
                          </select>
                      </div>
                  )}

                  <button type="submit" disabled={loading} className="mt-4 bg-orange-600 text-white font-black py-4 rounded-xl w-full active:scale-95 transition-all shadow-lg shadow-orange-500/10">
                      {loading ? 'Saving...' : editingPayment ? 'Save Changes' : 'Establish Commitment'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
