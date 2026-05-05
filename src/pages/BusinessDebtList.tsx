import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, CreditCard, 
  Search, Calendar, CheckCircle2, AlertCircle, Trash2, Edit2, X
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../services/dbErrorHandler';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

export default function BusinessDebtList() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<any>(null);
  const [editingDebt, setEditingDebt] = useState<any>(null);
  const [formData, setFormData] = useState({ lender: '', amount: '', dueDate: '', status: 'unpaid' });
  
  useEffect(() => {
    if (location.search.includes('add=true')) {
       setShowModal(true);
    }
  }, [location.search]);

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
      const q = query(collection(db, 'businessDebts'), where('businessId', '==', businessId), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      setDebts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    try {
      if (editingDebt) {
        await updateDoc(doc(db, 'businessDebts', editingDebt.id), {
          ...formData,
          amount
        });
      } else {
        await addDoc(collection(db, 'businessDebts'), {
          ...formData,
          amount,
          businessId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }
      
      setShowModal(false);
      setEditingDebt(null);
      setFormData({ lender: '', amount: '', dueDate: '', status: 'unpaid' });
      fetchDebts();
    } catch (error) {
      if (editingDebt) {
        handleFirestoreError(error, OperationType.UPDATE, `businessDebts/${editingDebt.id}`);
      } else {
        handleFirestoreError(error, OperationType.CREATE, `businessDebts`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!debtToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'businessDebts', debtToDelete.id));
      setShowDeleteModal(false);
      setDebtToDelete(null);
      fetchDebts();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businessDebts/${debtToDelete.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (debt: any) => {
    setEditingDebt(debt);
    setFormData({
      lender: debt.lender,
      amount: debt.amount.toString(),
      dueDate: debt.dueDate || '',
      status: debt.status
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingDebt(null);
    setFormData({ lender: '', amount: '', dueDate: '', status: 'unpaid' });
    setShowModal(true);
  };

  const toggleDebtStatus = async (debt: any) => {
    const newStatus = debt.status === 'paid' ? 'unpaid' : 'paid';
    try {
       await updateDoc(doc(db, 'businessDebts', debt.id), { status: newStatus });
       fetchDebts();
    } catch (err) {
       console.error("Error updating debt status:", err);
       handleFirestoreError(err, OperationType.UPDATE, `businessDebts/${debt.id}`);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(val);
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
      // Use createdAt if available, otherwise just count it generally or skip
      let dStr = '';
      if (d.createdAt && d.createdAt.toDate) {
         dStr = new Date(d.createdAt.toDate().getTime() - (d.createdAt.toDate().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      } else {
         return; // If no date, skip in time-based totals
      }

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
           {debts.map((d) => (
              <div key={d.id} className={`bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm transition-opacity ${d.status === 'paid' ? 'opacity-60' : 'opacity-100'}`}>
                 <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleDebtStatus(d)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center ${d.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}
                    >
                       {d.status === 'paid' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    </button>
                    <div>
                       <h4 className="font-bold text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{d.lender}</h4>
                       <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                             <Calendar size={10} /> {d.dueDate || 'No due date'}
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${d.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {d.status}
                          </span>
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="text-right">
                       <div className="font-extrabold text-gray-900 text-sm">{formatCurrency(d.amount)}</div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                       <div className="flex-row gap-1">
                          <button onClick={() => handleEdit(d)} className="p-1 text-gray-400 hover:text-brand-600 transition-colors">
                             <Edit2 size={16} />
                          </button>
                          <button onClick={() => { setDebtToDelete(d); setShowDeleteModal(true); }} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                             <Trash2 size={18} />
                          </button>
                       </div>
                       <button 
                           onClick={() => toggleDebtStatus(d)}
                           className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${d.status === 'paid' ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                           {d.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDebtToDelete(null); }}
        onConfirm={handleDelete}
        itemName={debtToDelete ? debtToDelete.lender : undefined}
      />

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
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Due Date (Optional)</label>
                     <input 
                       type="date"
                       value={formData.dueDate}
                       onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                     />
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
    </div>
  );
}
