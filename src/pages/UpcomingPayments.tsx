import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Calendar, Clock, RotateCw, X, CheckCircle2, ChevronRight, CalendarDays
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/dbErrorHandler';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/currency';
import { format, isSameDay, isSameMonth, isSameYear, addDays, addWeeks, addMonths, addYears, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';

export default function UpcomingPayments() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const currencyCode = userProfile?.currency || 'USD';
  
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    isRecurring: false,
    frequency: 'monthly' // daily, weekly, monthly, yearly
  });

  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'upcomingPayments'),
      where('userId', '==', user.uid),
      orderBy('dueDate', 'asc') // This will break if we don't have the index, but let's see. If error, I'll catch it. Actually it's simple orderBy.
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'upcomingPayments');
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'upcomingPayments'), {
        userId: user.uid,
        title: formData.title,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate,
        isRecurring: formData.isRecurring,
        frequency: formData.isRecurring ? formData.frequency : null,
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
      setFormData({
        title: '', amount: '', dueDate: format(new Date(), 'yyyy-MM-dd'), isRecurring: false, frequency: 'monthly'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'upcomingPayments');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (payment: any) => {
    setLoading(true);
    try {
      if (payment.isRecurring && payment.frequency) {
        // Calculate next due date
        const currentDueDate = new Date(payment.dueDate);
        let nextDueDate;
        switch(payment.frequency) {
            case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
            case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
            case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
            case 'yearly': nextDueDate = addYears(currentDueDate, 1); break;
            default: nextDueDate = addMonths(currentDueDate, 1);
        }
        
        await updateDoc(doc(db, 'upcomingPayments', payment.id), {
            dueDate: format(nextDueDate, 'yyyy-MM-dd')
        });
      } else {
        // Not recurring, delete or mark as completed. We'll simply delete it for simplicity.
        await deleteDoc(doc(db, 'upcomingPayments', payment.id));
      }
    } catch(err) {
       handleFirestoreError(err, OperationType.UPDATE, `upcomingPayments/${payment.id}`);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      setLoading(true);
      try {
          await deleteDoc(doc(db, 'upcomingPayments', id));
      } catch(err) {
          handleFirestoreError(err, OperationType.DELETE, `upcomingPayments/${id}`);
      } finally {
          setLoading(false);
      }
  }

  // Group by month
  const groupedPayments: { [month: string]: typeof payments } = {};
  payments.forEach(p => {
      if (!p.dueDate) return;
      const monthStr = format(new Date(p.dueDate), 'MMMM yyyy');
      if (!groupedPayments[monthStr]) groupedPayments[monthStr] = [];
      groupedPayments[monthStr].push(p);
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-2 pr-14">
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
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${new Date(payment.dueDate) < new Date() ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                                       {payment.isRecurring ? <RotateCw size={20} /> : <Calendar size={20} />}
                                   </div>
                                   <div>
                                       <h4 className="font-bold text-gray-900">{payment.title}</h4>
                                       <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                           <Clock size={12} /> {format(new Date(payment.dueDate), 'MMM d, yyyy')}
                                           {payment.isRecurring && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded uppercase">{payment.frequency}</span>}
                                       </p>
                                   </div>
                               </div>
                               <div className="flex flex-col items-end">
                                   <p className="font-bold text-gray-900">{formatCurrency(payment.amount, currencyCode)}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                       <button onClick={() => handleDelete(payment.id)} className="text-[10px] text-gray-400 hover:text-red-500 font-bold uppercase tracking-wider">Cancel</button>
                                       <button onClick={() => handleMarkPaid(payment)} className="text-[10px] text-brand-600 font-bold uppercase tracking-wider bg-brand-50 px-2 py-1 rounded">Mark Paid</button>
                                   </div>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
           ))
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="fixed inset-0 bg-black/40 z-[60]" />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }} 
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Add Payment Reminder</h2>
                  <button onClick={() => setShowModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600"><X size={18} /></button>
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

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl mt-2 cursor-pointer transition-colors" onClick={() => setFormData({...formData, isRecurring: !formData.isRecurring})}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${formData.isRecurring ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                          {formData.isRecurring && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                      <span className="font-bold text-gray-700">This is a recurring payment</span>
                  </div>

                  {formData.isRecurring && (
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
