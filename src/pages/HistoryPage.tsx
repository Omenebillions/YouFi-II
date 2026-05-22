import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions, deleteTransaction, updateTransaction, moveToTrash } from '../services/db';
import { formatCurrency } from '../lib/currency';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

export default function HistoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [txToDelete, setTxToDelete] = useState<any>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', category: '', note: '', date: '', type: 'expense' });

  const currencyCode = userProfile?.currency || 'USD';

  const urlParams = new URLSearchParams(window.location.search);
  const period = urlParams.get('period');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const txs = await fetchTransactions(user.id);
    if (txs) {
      let filteredTxs = txs;
      
      if (type && type !== 'all' && type !== 'all_transactions') {
        filteredTxs = filteredTxs.filter(t => t.type === type);
      }

      const now = new Date();
      if (period === 'weekly') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filteredTxs = filteredTxs.filter(t => t.date && new Date(t.date) >= oneWeekAgo);
      } else if (period === 'monthly') {
          const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          filteredTxs = filteredTxs.filter(t => t.date && new Date(t.date) >= oneMonthAgo);
      } else if (period === 'yearly') {
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          filteredTxs = filteredTxs.filter(t => t.date && new Date(t.date) >= oneYearAgo);
      }

      setTransactions(filteredTxs);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user, type]);

  const handleDelete = async () => {
    if (!txToDelete) return;
    const tx = txToDelete;
    await moveToTrash('transactions', tx.id, tx);
    await deleteTransaction(tx.id);
    setTxToDelete(null);
    setShowDeleteModal(false);
    loadData();
  };

  const startEdit = (tx: any) => {
    setEditingId(tx.id);
    setEditForm({
      amount: tx.amount.toString(),
      category: tx.category,
      note: tx.note || '',
      date: tx.date || new Date().toISOString().split('T')[0],
      type: tx.type || 'expense'
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string, originalTx: any) => {
    if (!editForm.amount || !editForm.category) return;
    await updateTransaction(id, {
      amount: parseFloat(editForm.amount),
      category: editForm.category,
      note: editForm.note,
      date: editForm.date,
      type: editForm.type
    });
    setEditingId(null);
    loadData();
  };

  const total = transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

  const titles: Record<string, string> = {
    income: 'Total Income',
    expense: 'Total Expenses',
    debt: 'Total Debts',
    all: 'Net Balance',
    all_transactions: 'Net Balance'
  };

  const periodDisplay = period ? ` (${period})` : '';

  return (
    <div className="flex flex-col tracking-tight pt-4">
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 capitalize">{(!type || type === 'all' || type === 'all_transactions') ? 'All' : type} History{periodDisplay}</h1>
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
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                          className="p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
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
                      <div className="flex gap-2">
                        <input 
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                          className="p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <input 
                          type="text"
                          value={editForm.note}
                          onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                          className="flex-1 p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder="Note"
                        />
                      </div>
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
                      {tx.date && (() => {
                          const d = new Date(tx.date);
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          const yyyy = d.getFullYear();
                          return <p className="text-xs text-gray-400 font-medium mt-1">{mm}/{dd}/{yyyy}</p>;
                      })()}
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
                        onClick={() => { setTxToDelete(tx); setShowDeleteModal(true); }}
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

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setTxToDelete(null); }}
        onConfirm={handleDelete}
        itemName={txToDelete ? `${txToDelete.category} - ${formatCurrency(txToDelete.amount, currencyCode)}` : undefined}
      />
    </div>
  );
}
