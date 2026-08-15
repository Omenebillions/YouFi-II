import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Trash2, Edit2, Check, X, CheckCircle2, AlertCircle, 
  ChevronDown, ChevronUp, RotateCw, FileText, Search, Calendar, 
  ArrowUpDown, Filter, SlidersHorizontal, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions, deleteTransaction, updateTransaction, moveToTrash } from '../services/db';
import { formatCurrency } from '../lib/currency';
import { parsePersonalDebt, serializePersonalDebt, getCleanNote, generateRecurringPayments, RecurringPaymentInstance } from '../lib/debt';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import CsvImportModal from '../components/CsvImportModal';

export default function HistoryPage() {
  const { type: urlType } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Filtering and Search State
  const initialType = (urlType && ['debt', 'expense', 'income', 'all'].includes(urlType.toLowerCase())) 
    ? (urlType.toLowerCase() === 'expenses' ? 'expense' : urlType.toLowerCase()) 
    : 'all';

  const [activeType, setActiveType] = useState<string>(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  
  const urlParams = new URLSearchParams(window.location.search);
  const urlPeriod = urlParams.get('period');

  const initialPreset = urlPeriod === 'weekly' ? 'this_week' 
    : urlPeriod === 'monthly' ? 'this_month' 
    : urlPeriod === 'yearly' ? 'this_year' 
    : 'all';

  const [datePreset, setDatePreset] = useState<string>(initialPreset);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [txToDelete, setTxToDelete] = useState<any>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ 
    amount: '', 
    category: '', 
    note: '', 
    date: '', 
    type: 'expense',
    repaymentDate: '',
    isRecurring: false,
    frequency: 'monthly',
    duration: '',
    status: 'unpaid',
    recurringAmount: '',
    payments: [] as RecurringPaymentInstance[]
  });

  const currencyCode = userProfile?.currency || 'USD';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const txs = await fetchTransactions(user.id);
    if (txs) {
      setAllTransactions(txs);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (urlType) {
      const parsed = urlType.toLowerCase() === 'expenses' ? 'expense' : urlType.toLowerCase();
      if (['debt', 'expense', 'income', 'all'].includes(parsed)) {
        setActiveType(parsed);
      }
    }
  }, [urlType]);

  // Client-side Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let result = allTransactions.filter(tx => {
      // 1. Type Filter
      if (activeType !== 'all') {
        if (activeType === 'expense' && tx.type !== 'expense') return false;
        if (activeType === 'income' && tx.type !== 'income') return false;
        if (activeType === 'debt' && tx.type !== 'debt') return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const isDebt = tx.type === 'debt';
        const debtMeta = isDebt ? parsePersonalDebt(tx) : null;
        const cleanNote = getCleanNote(tx, debtMeta);

        const catMatch = tx.category?.toLowerCase().includes(q);
        const noteMatch = (cleanNote?.toLowerCase().includes(q)) || (tx.note?.toLowerCase().includes(q));
        const amtMatch = tx.amount?.toString().includes(q);
        const dateMatch = tx.date?.includes(q);
        const statusMatch = isDebt && debtMeta?.status?.toLowerCase().includes(q);

        if (!catMatch && !noteMatch && !amtMatch && !dateMatch && !statusMatch) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (tx.date) {
        const txDateStr = tx.date.split('T')[0];
        const txDate = new Date(txDateStr);

        if (datePreset === 'today') {
          if (txDateStr !== todayStr) return false;
        } else if (datePreset === 'this_week') {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0,0,0,0);
          if (txDate < startOfWeek) return false;
        } else if (datePreset === 'this_month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (txDate < startOfMonth) return false;
        } else if (datePreset === 'last_month') {
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
          if (txDate < startOfLastMonth || txDate > endOfLastMonth) return false;
        } else if (datePreset === 'this_year') {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          if (txDate < startOfYear) return false;
        } else if (datePreset === 'custom') {
          if (startDate && txDateStr < startDate) return false;
          if (endDate && txDateStr > endDate) return false;
        }
      }

      return true;
    });

    // 4. Sorting
    return result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      if (sortBy === 'date_asc') return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount);
      if (sortBy === 'amount_asc') return Number(a.amount) - Number(b.amount);
      return 0;
    });
  }, [allTransactions, activeType, searchQuery, datePreset, startDate, endDate, sortBy]);

  // Category counts for quick badges
  const counts = useMemo(() => {
    return {
      all: allTransactions.length,
      income: allTransactions.filter(t => t.type === 'income').length,
      expense: allTransactions.filter(t => t.type === 'expense').length,
      debt: allTransactions.filter(t => t.type === 'debt').length
    };
  }, [allTransactions]);

  // Calculations for filtered result set
  const filteredMoneyIn = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
  const filteredExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
  const filteredUnpaidDebts = filteredTransactions.filter(t => t.type === 'debt' && parsePersonalDebt(t).status !== 'paid').reduce((acc, t) => acc + Number(t.amount), 0);
  const filteredMoneyOut = filteredExpenses;
  const filteredNetBalance = filteredMoneyIn - filteredMoneyOut;

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
    const isDebt = tx.type === 'debt';
    const debtMeta = isDebt ? parsePersonalDebt(tx) : null;
    
    setEditForm({
      amount: tx.amount.toString(),
      category: tx.category,
      note: getCleanNote(tx, debtMeta),
      date: tx.date || new Date().toISOString().split('T')[0],
      type: tx.type || 'expense',
      repaymentDate: isDebt ? (debtMeta?.repaymentDate || '') : '',
      isRecurring: isDebt ? (debtMeta?.isRecurring || false) : false,
      frequency: isDebt ? (debtMeta?.frequency || 'monthly') : 'monthly',
      duration: isDebt ? (debtMeta?.duration || '') : '',
      status: isDebt ? (debtMeta?.status || 'unpaid') : 'unpaid',
      recurringAmount: isDebt ? (debtMeta?.recurringAmount?.toString() || '') : '',
      payments: isDebt ? (debtMeta?.payments || []) : []
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string, originalTx: any) => {
    if (!editForm.amount || !editForm.category) return;
    
    const isDebt = editForm.type === 'debt';
    const finalNote = isDebt ? serializePersonalDebt({
      repaymentDate: editForm.repaymentDate || editForm.date,
      isRecurring: editForm.isRecurring,
      frequency: editForm.isRecurring ? editForm.frequency : '',
      duration: editForm.isRecurring ? editForm.duration : '',
      status: editForm.status as any || 'unpaid',
      note: editForm.note,
      recurringAmount: editForm.isRecurring ? parseFloat(editForm.recurringAmount) : 0,
      payments: editForm.isRecurring ? editForm.payments : []
    }) : editForm.note;

    await updateTransaction(id, {
      amount: parseFloat(editForm.amount),
      category: editForm.category,
      note: finalNote,
      date: editForm.date,
      type: editForm.type
    });
    setEditingId(null);
    loadData();
  };

  const togglePersonalDebtStatus = async (tx: any) => {
    const debtMeta = parsePersonalDebt(tx);
    const newStatus = debtMeta.status === 'paid' ? 'unpaid' : 'paid';
    
    const updatedPayments = debtMeta.payments?.map(p => ({
      ...p,
      status: newStatus as 'unpaid' | 'paid'
    })) || [];

    const updatedNote = serializePersonalDebt({
      ...debtMeta,
      status: newStatus,
      payments: updatedPayments
    });
    await updateTransaction(tx.id, {
      ...tx,
      note: updatedNote
    });
    loadData();
  };

  const handleTogglePaymentInstanceStatus = async (tx: any, instanceId: string) => {
    const isDebt = tx.type === 'debt';
    if (!isDebt) return;
    
    const debtMeta = parsePersonalDebt(tx);
    if (!debtMeta.payments) return;
    
    const updatedPayments = debtMeta.payments.map((p: any) => {
      if (p.id === instanceId) {
        return { ...p, status: p.status === 'paid' ? 'unpaid' : 'paid' };
      }
      return p;
    });

    const allPaid = updatedPayments.every((p: any) => p.status === 'paid');
    const updatedStatus = allPaid ? 'paid' : 'unpaid';

    const finalNote = serializePersonalDebt({
      ...debtMeta,
      payments: updatedPayments,
      status: updatedStatus as any
    });

    await updateTransaction(tx.id, {
      ...tx,
      note: finalNote
    });
    
    loadData();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setActiveType('all');
  };

  const isFiltered = searchQuery.trim() !== '' || datePreset !== 'all' || activeType !== 'all' || startDate !== '' || endDate !== '';

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-20">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-xs transition-transform active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900">Transaction History</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Searchable Records & Analysis</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCsvImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold border border-brand-100 active:scale-95 transition-transform hover:bg-brand-100"
        >
          <FileText size={14} /> Import CSV
        </button>
      </div>

      {/* Primary Category Selector Tabs */}
      <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-6 gap-1 overflow-x-auto">
        {[
          { id: 'all', label: 'All History', count: counts.all },
          { id: 'expense', label: 'Expenses', count: counts.expense },
          { id: 'income', label: 'Income', count: counts.income },
          { id: 'debt', label: 'Debts', count: counts.debt },
        ].map(tab => {
          const isActive = activeType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveType(tab.id)}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isActive 
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-gray-100 text-gray-900' : 'bg-gray-200/60 text-gray-600'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Robust Search & Date Range Filters Box */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search size={18} className="absolute left-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, notes, categories, amounts..."
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-gray-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Presets Row */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <Calendar size={12} /> Date Range Filter
            </span>
            {isFiltered && (
              <button 
                onClick={resetFilters}
                className="text-[10px] font-bold text-brand-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={10} /> Reset Filters
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${
                  datePreset === p.id 
                    ? 'bg-gray-900 text-white border-gray-900 shadow-xs' 
                    : 'bg-gray-50 text-gray-600 border-gray-200/80 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Inputs if Custom Selected */}
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        )}

        {/* Sorting Dropdown */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
            <ArrowUpDown size={12} /> Sort By
          </span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold text-gray-800 outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Filtered Financial Summary Metrics Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtered Result Overview</h2>
          <span className="bg-gray-100 text-gray-800 text-[10px] font-black px-2.5 py-1 rounded-full">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total In</p>
            <p className="text-xs font-black text-emerald-600 mt-0.5">{formatCurrency(filteredMoneyIn, currencyCode)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Out</p>
            <p className="text-xs font-black text-rose-600 mt-0.5">{formatCurrency(filteredMoneyOut, currencyCode)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Net Total</p>
            <p className={`text-xs font-black mt-0.5 ${filteredNetBalance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {formatCurrency(filteredNetBalance, currencyCode)}
            </p>
          </div>
        </div>
        {filteredUnpaidDebts > 0 && (
          <div className="mt-2.5 text-center text-[10px] font-bold text-amber-700 bg-amber-50/90 py-1.5 px-3 rounded-xl border border-amber-200/60 flex items-center justify-center gap-1.5">
            <AlertCircle size={12} className="text-amber-600 shrink-0" />
            <span>Active Debts Balance: {formatCurrency(filteredUnpaidDebts, currencyCode)} (tracked separately from expenses)</span>
          </div>
        )}
      </div>

      {/* Transaction Records List */}
      <div>
        <h2 className="text-sm font-black text-gray-900 mb-3 px-1 uppercase tracking-wider">Records</h2>
        {loading ? (
          <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-gray-50">Loading records...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl border border-gray-100 space-y-3">
            <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <Search size={22} />
            </div>
            <p className="text-sm font-bold text-gray-800">No matching records found</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">Try adjusting your search keywords, active category filter, or date range.</p>
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-brand-600 text-white font-bold text-xs rounded-xl hover:bg-brand-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTransactions.map(tx => {
              const isDebt = tx.type === 'debt';
              const debtMeta = isDebt ? parsePersonalDebt(tx) : null;
              
              return (
              <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-col justify-center transition-all hover:border-gray-200">
                {editingId === tx.id ? (
                   <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                          className="p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                          <option value="debt">Debt</option>
                        </select>
                        <input 
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                          className="w-1/3 p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                          placeholder="Amount"
                        />
                        <input 
                          type="text"
                          value={editForm.category}
                          onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                          className="flex-1 p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                          placeholder="Category"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                          className="p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                        />
                        <input 
                          type="text"
                          value={editForm.note}
                          onChange={(e) => setEditForm({...editForm, note: e.target.value})}
                          className="flex-1 p-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500"
                          placeholder="Note"
                        />
                      </div>

                      {editForm.type === 'debt' && (
                        <div className="flex flex-col gap-2 p-3 bg-red-50/20 rounded-xl border border-red-100/30">
                          <div className="flex gap-2 items-center flex-wrap">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Repayment Date:</span>
                            <input 
                              type="date"
                              value={editForm.repaymentDate}
                              onChange={(e) => setEditForm({...editForm, repaymentDate: e.target.value})}
                              className="p-1 px-2 bg-white border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                            />
                            
                            <span className="text-[10px] font-bold text-gray-500 uppercase ml-2">Status:</span>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                              className="p-1 bg-white border border-gray-200 rounded text-xs outline-none font-bold"
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                            </select>
                          </div>
                          
                          <div className="flex gap-3 items-center mt-1">
                            <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                              <input 
                                type="checkbox"
                                checked={editForm.isRecurring}
                                onChange={(e) => setEditForm({...editForm, isRecurring: e.target.checked})}
                                className="rounded text-brand-600 focus:ring-brand-500"
                              />
                              Is Recurring
                            </label>
                            
                            {editForm.isRecurring && (
                              <div className="flex flex-col gap-2 mt-2 w-full">
                                <div className="flex gap-2 items-center flex-wrap">
                                  <select
                                    value={editForm.frequency}
                                    onChange={(e) => setEditForm({...editForm, frequency: e.target.value})}
                                    className="p-1 bg-white border border-gray-200 rounded text-xs outline-none font-bold"
                                  >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                  </select>
                                  
                                  <input 
                                    type="text"
                                    value={editForm.duration}
                                    onChange={(e) => setEditForm({...editForm, duration: e.target.value})}
                                    placeholder="Duration (e.g. 3 months)"
                                    className="p-1 px-2 w-[160px] bg-white border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                  />
                                </div>
                                
                                <div className="flex flex-col gap-1 mt-1">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase">Payment Amount per Cycle:</span>
                                  <input 
                                    type="number"
                                    value={editForm.recurringAmount}
                                    onChange={(e) => setEditForm({...editForm, recurringAmount: e.target.value})}
                                    placeholder="Defaults to total amount"
                                    className="p-1 px-2 w-full bg-white border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                  />
                                </div>

                                <div className="p-2 bg-white/50 border border-gray-200/50 rounded-lg flex flex-col gap-1.5 mt-1 shadow-inner">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase">Instalments List ({editForm.payments?.length || 0})</span>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const parsedAmount = parseFloat(editForm.recurringAmount) || parseFloat(editForm.amount) || 0;
                                        setEditForm({
                                          ...editForm,
                                          payments: generateRecurringPayments(editForm.repaymentDate || editForm.date, editForm.frequency, editForm.duration, parsedAmount)
                                        });
                                      }} 
                                      className="text-[9px] font-extrabold text-brand-600 hover:text-brand-700"
                                    >
                                      Generate
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                    {(editForm.payments || []).map((p, idx) => (
                                      <div key={p.id} className="flex gap-2 items-center justify-between border-b border-gray-100 pb-1.5 last:border-none last:pb-0">
                                        <span className="text-[10px] text-gray-500 font-bold">#{idx + 1}</span>
                                        <input 
                                          type="date"
                                          value={p.dueDate}
                                          onChange={(e) => {
                                            const updated = [...editForm.payments];
                                            updated[idx] = { ...updated[idx], dueDate: e.target.value };
                                            setEditForm({ ...editForm, payments: updated });
                                          }}
                                          className="bg-gray-50 p-0.5 border border-gray-200 rounded text-[10px] focus:ring-1 focus:ring-brand-500 font-bold text-gray-700 w-[95px]"
                                        />
                                        <input 
                                          type="number"
                                          value={p.amount}
                                          onChange={(e) => {
                                            const updated = [...editForm.payments];
                                            updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                                            setEditForm({ ...editForm, payments: updated });
                                          }}
                                          className="bg-gray-50 p-0.5 border border-gray-200 rounded text-[10px] text-right focus:ring-1 focus:ring-brand-500 font-bold text-gray-700 w-[55px]"
                                        />
                                        <select
                                          value={p.status}
                                          onChange={(e) => {
                                            const updated = [...editForm.payments];
                                            updated[idx] = { ...updated[idx], status: e.target.value as any };
                                            setEditForm({ ...editForm, payments: updated });
                                          }}
                                          className="bg-gray-50 p-0.5 border border-gray-200 rounded text-[9px] font-extrabold outline-none text-gray-650"
                                        >
                                          <option value="unpaid">Unpaid</option>
                                          <option value="paid">Paid</option>
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

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
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div 
                        className={`flex-1 min-w-0 ${isDebt && debtMeta?.isRecurring ? 'cursor-pointer hover:bg-gray-50/50 p-1.5 -ml-1.5 rounded-xl transition-colors' : ''}`}
                        onClick={() => {
                          if (isDebt && debtMeta?.isRecurring) {
                            setExpandedTxId(expandedTxId === tx.id ? null : tx.id);
                          }
                        }}
                      >
                        <h4 className="text-sm font-bold text-gray-900 capitalize flex items-center gap-2 flex-wrap">
                          <span>{tx.category}</span>
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            tx.type === 'income' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            tx.type === 'debt' ? (debtMeta?.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100') :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {tx.type === 'debt' ? (debtMeta?.status || 'unpaid') : tx.type}
                          </span>
                        </h4>
                        
                        {(() => {
                          const cleanNote = getCleanNote(tx, debtMeta);
                          return cleanNote ? <p className="text-xs font-medium text-gray-500 mt-0.5">{cleanNote}</p> : null;
                        })()}
                        <div className="flex flex-col gap-1 mt-1">
                          {tx.date && (() => {
                              const d = new Date(tx.date);
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              const yyyy = d.getFullYear();
                              return <p className="text-xs text-gray-400 font-medium">{mm}/{dd}/{yyyy}</p>;
                          })()}
                          {isDebt && debtMeta?.repaymentDate && (
                            <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
                              Repayment: {debtMeta.repaymentDate} {debtMeta.isRecurring ? `(Recurring: ${debtMeta.frequency}${debtMeta.duration ? `, for ${debtMeta.duration}` : ''})` : ''}
                              {debtMeta.isRecurring && (expandedTxId === tx.id ? <ChevronUp size={12} className="inline ml-1 text-gray-550" /> : <ChevronDown size={12} className="inline ml-1 text-gray-550" />)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDebt && (
                          <button 
                            onClick={() => togglePersonalDebtStatus(tx)}
                            className={`mr-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${debtMeta?.status === 'paid' ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          >
                            {debtMeta?.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                          </button>
                        )}
                        <span className={`text-sm font-black mr-1 ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), currencyCode)}
                        </span>
                        <button 
                          onClick={() => startEdit(tx)}
                          className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit transaction"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => { setTxToDelete(tx); setShowDeleteModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {isDebt && debtMeta?.isRecurring && expandedTxId === tx.id && (
                      <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/55 flex flex-col gap-2">
                        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex justify-between">
                          <span>Dynamic Installment Schedule</span>
                          <span>Tap instance to toggle status</span>
                        </div>
                        {(!debtMeta.payments || debtMeta.payments.length === 0) ? (
                          <div className="flex flex-col gap-1.5 items-center py-4 bg-white rounded-xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400 italic font-medium">No installment schedule generated yet.</p>
                            <button 
                              type="button"
                              onClick={() => {
                                const parsedAmount = debtMeta.recurringAmount || tx.amount;
                                const generated = generateRecurringPayments(debtMeta.repaymentDate || tx.date, debtMeta.frequency || 'monthly', debtMeta.duration || '3 months', parsedAmount);
                                updateTransaction(tx.id, {
                                  ...tx,
                                  note: serializePersonalDebt({
                                    ...debtMeta,
                                    payments: generated
                                  })
                                }).then(() => loadData());
                              }}
                              className="text-xs font-bold text-brand-600 hover:underline"
                            >
                              Generate Schedule
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {debtMeta.payments.map((p: any, idx: number) => (
                              <div 
                                key={p.id} 
                                onClick={() => handleTogglePaymentInstanceStatus(tx, p.id)}
                                className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer select-none shadow-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${p.status === 'paid' ? 'bg-green-500 border-green-500 text-white shadow-xs shadow-green-200' : 'border-gray-300'}`}>
                                    {p.status === 'paid' && <Check size={12} strokeWidth={4} />}
                                  </div>
                                  <div>
                                    <span className="text-xs text-gray-800 font-bold block">Installment #{idx + 1}</span>
                                    <span className="text-[10px] text-gray-400 font-semibold">{new Date(p.dueDate).toLocaleDateString('en-GB')}</span>
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                  <span className="text-xs font-black text-gray-800">
                                     {formatCurrency(p.amount || tx.amount, currencyCode)}
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
                )}
              </div>
            )})}
          </div>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setTxToDelete(null); }}
        onConfirm={handleDelete}
        itemName={txToDelete ? `${txToDelete.category} - ${formatCurrency(txToDelete.amount, currencyCode)}` : undefined}
      />

      <CsvImportModal 
        isOpen={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onImportSuccess={() => {
          setShowCsvImport(false);
          loadData();
        }}
      />
    </div>
  );
}
