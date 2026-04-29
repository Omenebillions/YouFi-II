import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, TrendingUp, TrendingDown,
  Search, Calendar, ShoppingCart, Trash2, Edit2, X
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, increment, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../services/dbErrorHandler';

export default function BusinessTransactionList() {
  const { businessId, type } = useParams(); // type: 'income' or 'expense'
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [formData, setFormData] = useState({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '' });

  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (!businessId || !type || !user) return;

    setLoading(true);
    const q = query(
      collection(db, 'businessTransactions'), 
      where('businessId', '==', businessId), 
      where('userId', '==', user.uid),
      where('type', '==', type),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching transactions:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [businessId, type, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!user || !businessId || !type || isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      if (editingTx) {
        const diff = amount - editingTx.amount;
        // Update Transaction
        await updateDoc(doc(db, 'businessTransactions', editingTx.id), {
          ...formData,
          amount
        });

        // Sync Balance
        if (diff !== 0) {
          await updateDoc(doc(db, 'businesses', businessId), {
            balance: increment(type === 'income' ? diff : -diff)
          });
        }
      } else {
        // Record New Transaction
        await addDoc(collection(db, 'businessTransactions'), {
          ...formData,
          amount,
          type,
          businessId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });

        // Update Business Balance
        await updateDoc(doc(db, 'businesses', businessId), {
          balance: increment(type === 'income' ? amount : -amount)
        });
      }

      setShowModal(false);
      setEditingTx(null);
      setFormData({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '' });
    } catch (error) {
      console.error("Error saving transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tx: any) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'businessTransactions', tx.id));
      // Revert Balance
      await updateDoc(doc(db, 'businesses', businessId!), {
        balance: increment(type === 'income' ? -tx.amount : tx.amount)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `businessTransactions/${tx.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tx: any) => {
    setEditingTx(tx);
    setFormData({
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date,
      note: tx.note || ''
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingTx(null);
    setFormData({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '' });
    setShowModal(true);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(val);
  };

  const title = type === 'income' ? 'Business Income' : 'Business Expenses';
  const icon = type === 'income' ? <TrendingUp className="text-green-600" /> : <TrendingDown className="text-red-500" />;

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(`/business/${businessId}`)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
           {icon} {title}
        </h1>
        <div className="w-4"></div>
      </div>

      <div className="flex gap-3 mb-6">
         <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex items-center px-4 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input 
              className="w-full bg-transparent border-none p-3 text-sm focus:ring-0" 
              placeholder={`Search ${type}s...`} 
            />
         </div>
         <button onClick={handleAddClick} className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {loading && transactions.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading history...</div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {type === 'income' ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
           </div>
           <h2 className="text-lg font-bold text-gray-900 mb-2">No {type}s found</h2>
           <p className="text-xs text-gray-500 mb-8 max-w-xs mx-auto">Track your business {type}s here to maintain accurate records.</p>
           <button onClick={handleAddClick} className="bg-gray-900 text-white font-bold py-3 px-6 rounded-xl text-sm">Add First {type}</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
           {transactions.map((tx) => (
              <div key={tx.id} className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                       {type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div>
                       <h4 className="font-bold text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{tx.category}</h4>
                       <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 flex items-center gap-1">
                          <Calendar size={10} /> {tx.date}
                       </p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="text-right">
                       <div className={`font-bold text-sm ${type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                          {type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                       </div>
                       {tx.note && <p className="text-[10px] text-gray-400 mt-0.5 max-w-[80px] truncate">{tx.note}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                       <button onClick={() => handleEdit(tx)} className="p-1 text-gray-400 hover:text-brand-600 transition-colors">
                          <Edit2 size={16} />
                       </button>
                       <button onClick={() => handleDelete(tx)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                       </button>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setEditingTx(null); }}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                     {icon} {editingTx ? 'Edit' : 'Add'} {type === 'income' ? 'Income' : 'Expense'}
                  </h2>
                  <button 
                    onClick={() => { setShowModal(false); setEditingTx(null); }}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount</label>
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
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Category</label>
                     <input 
                       required
                       value={formData.category}
                       onChange={(e) => setFormData({...formData, category: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="e.g. Raw Materials, Rent, Consulting"
                     />
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Date</label>
                     <input 
                       required
                       type="date"
                       value={formData.date}
                       onChange={(e) => setFormData({...formData, date: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                     />
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Note (Optional)</label>
                     <input 
                       value={formData.note}
                       onChange={(e) => setFormData({...formData, note: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="Details..."
                     />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className={`mt-4 ${type === 'income' ? 'bg-green-600' : 'bg-red-500'} text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2`}
                  >
                    {loading ? 'Saving...' : editingTx ? 'Update Record' : `Add ${type}`}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
