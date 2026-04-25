import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions, deleteTransaction, updateTransaction } from '../services/db';
import { formatCurrency } from '../lib/currency';

export default function HistoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', category: '', note: '' });

  const currencyCode = userProfile?.currency || 'USD';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const txs = await fetchTransactions(user.uid);
    if (txs) {
      setTransactions(txs.filter(t => t.type === type));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user, type]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      await deleteTransaction(id);
      loadData();
    }
  };

  const startEdit = (tx: any) => {
    setEditingId(tx.id);
    setEditForm({
      amount: tx.amount.toString(),
      category: tx.category,
      note: tx.note || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string, originalTx: any) => {
    if (!editForm.amount || !editForm.category) return;
    await updateTransaction(id, {
      ...originalTx,
      amount: parseFloat(editForm.amount),
      category: editForm.category,
      note: editForm.note
    });
    setEditingId(null);
    loadData();
  };

  const total = transactions.reduce((acc, t) => acc + t.amount, 0);

  const titles: Record<string, string> = {
    income: 'Total Income',
    expense: 'Total Expenses',
    debt: 'Total Debts'
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc] pb-8 tracking-tight px-6 pt-12">
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 capitalize">{type} History</h1>
        <div className="w-4"></div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center mb-8">
        <h2 className="text-gray-500 font-medium text-sm mb-2">{titles[type || ''] || 'Total'}</h2>
        <div className="text-3xl font-bold text-gray-900">{formatCurrency(total, currencyCode)}</div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Records</h2>
        {loading ? (
           <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : transactions.length === 0 ? (
           <div className="text-center text-gray-400 py-8 bg-white rounded-2xl border border-gray-50">No {type} records found.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex flex-col justify-center min-h-[80px]">
                {editingId === tx.id ? (
                   <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                          className="w-1/3 p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder="Amount"
                        />
                        <input 
                          type="text"
                          value={editForm.category}
                          onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                          className="flex-1 p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder="Category"
                        />
                      </div>
                      <input 
                        type="text"
                        value={editForm.note}
                        onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                        className="w-full p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="Note"
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={cancelEdit} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                           <X size={16} />
                        </button>
                        <button onClick={() => saveEdit(tx.id, tx)} className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
                           <Check size={16} />
                        </button>
                      </div>
                   </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 capitalize">{tx.category} {tx.note && <span className="font-normal text-gray-500">- {tx.note}</span>}</h4>
                      <p className="text-xs text-gray-400 font-medium mt-1">{new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold mr-2 ${tx.type === 'income' ? 'text-success-500' : 'text-danger-500'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), currencyCode)}
                      </span>
                      <button 
                        onClick={() => startEdit(tx)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(tx.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
