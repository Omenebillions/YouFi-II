import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, TrendingUp, TrendingDown,
  Search, Calendar, Trash2, Edit2, X, AlertTriangle, Play, Sparkles
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../hooks/useNativeBridge';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { moveToTrash } from '../services/db';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';
import { parseBusinessTxCategory, serializeBusinessTxCategory } from '../lib/business';

export default function BusinessTransactionList() {
  const { businessId, type } = useParams(); // type: 'income' or 'expense'
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txToDelete, setTxToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const { isPremium, bridge } = useNativeBridge();
  const [transactionLimit, setTransactionLimit] = useState(() => {
    return Number(localStorage.getItem(`youfi_limit_${businessId}`)) || 5;
  });
  const [adLoading, setAdLoading] = useState(false);

  const fetchTransactionsForUI = async () => {
    if (!businessId || !type || !user) return;
    let query = supabase.from('business_transactions').select('*').eq('business_id', businessId).eq('user_id', user.id);
    if (type !== 'all') {
      query = query.eq('type', type);
    }
    const { data } = await query.order('date', { ascending: false });
    if (data) {
      setTransactions(data.map((row: any) => {
        const meta = parseBusinessTxCategory(row.category);
        return {
          ...row,
          category: meta.category,
          note: meta.note || ''
        };
      }));
    }
  };
  
  useEffect(() => {
    if (location.search.includes('add=true')) {
       setShowModal(true);
    }
  }, [location.search]);
  
  const [formData, setFormData] = useState({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', txType: type === 'all' ? 'expense' : type });

  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (!businessId || !type || !user) return;

    setLoading(true);
    fetchTransactionsForUI().then(() => setLoading(false));

    const channel = supabase.channel(`biz-tx-${businessId}-${type}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_transactions', filter: `business_id=eq.${businessId}` }, () => {
        fetchTransactionsForUI();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, type, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmitting) return;
    const amount = parseFloat(formData.amount);
    if (!user || !businessId || !type || isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const actualType = formData.txType || type;
      const serializedCategory = serializeBusinessTxCategory(formData.category, formData.note);
      if (editingTx) {
        const diff = amount - editingTx.amount;
        // Update Transaction
        await supabase.from('business_transactions').update({
          amount,
          category: serializedCategory,
          date: formData.date,
          type: actualType
        }).eq('id', editingTx.id);

        // Sync Balance
        let balanceChange = 0;
        if (editingTx.type === actualType) {
           balanceChange = actualType === 'income' ? diff : -diff;
        } else {
           const revertOld = editingTx.type === 'income' ? -editingTx.amount : editingTx.amount;
           const applyNew = actualType === 'income' ? amount : -amount;
           balanceChange = revertOld + applyNew;
        }

        if (balanceChange !== 0) {
            const { data: biz } = await supabase.from('businesses').select('balance').eq('id', businessId).single();
            await supabase.from('businesses').update({ balance: (biz?.balance || 0) + balanceChange }).eq('id', businessId);
        }
      } else {
        // Record New Transaction
        await supabase.from('business_transactions').insert({
          amount,
          category: serializedCategory,
          date: formData.date,
          type: actualType,
          business_id: businessId,
          user_id: user.id
        });

        // Update Business Balance
        const { data: biz } = await supabase.from('businesses').select('balance').eq('id', businessId).single();
        await supabase.from('businesses').update({ balance: (biz?.balance || 0) + (actualType === 'income' ? amount : -amount) }).eq('id', businessId);
      }

      await fetchTransactionsForUI();
      setShowModal(false);
      setEditingTx(null);
      setFormData({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', txType: type === 'all' ? 'expense' : type });
    } catch (error) {
       console.error("Error saving transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWatchAd = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      if (bridge?.showRewardedAd) {
        const result = await bridge.showRewardedAd();
        if (result && result.reward > 0) {
          const nextLimit = transactionLimit + result.reward;
          setTransactionLimit(nextLimit);
          localStorage.setItem(`youfi_limit_${businessId}`, String(nextLimit));
          alert(`Congratulations! You earned +${result.reward} transactions limit! Total allowed: ${nextLimit}`);
        } else {
          alert("Ad was cancelled. Finish watching the video to secure extra transactions.");
        }
      } else {
        const watchSuccess = window.confirm("Watch simulated video ad to gain +15 free SME transaction logs?");
        if (watchSuccess) {
          const nextLimit = transactionLimit + 15;
          setTransactionLimit(nextLimit);
          localStorage.setItem(`youfi_limit_${businessId}`, String(nextLimit));
          alert(`Congratulations! Sim completed. You earned +15 transactions limit! Total allowed: ${nextLimit}`);
        }
      }
    } catch (err) {
      console.error("[Ad Reward Error]:", err);
    } finally {
      setAdLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!txToDelete) return;
    const tx = txToDelete;
    setIsSubmitting(true);
    try {
      await moveToTrash('business_transactions', tx.id, tx);
      await supabase.from('business_transactions').delete().eq('id', tx.id);
      
      // Revert Balance
      const { data: biz } = await supabase.from('businesses').select('balance').eq('id', businessId!).single();
      await supabase.from('businesses').update({ balance: (biz?.balance || 0) + (tx.type === 'income' ? -tx.amount : tx.amount) }).eq('id', businessId!);
      
      await fetchTransactionsForUI();
      setShowDeleteModal(false);
      setTxToDelete(null);
    } catch (error) {
       console.error("Error deleting transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (tx: any) => {
    setEditingTx(tx);
    setFormData({
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date,
      note: tx.note || '',
      txType: tx.type || (type === 'all' ? 'expense' : type)
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingTx(null);
    setFormData({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', txType: type === 'all' ? 'expense' : type });
    setShowModal(true);
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, currencyCode);
  };

   const title = type === 'all' ? 'Business History' : type === 'income' ? 'Business Income' : 'Business Expenses';
   const icon = type === 'income' ? <TrendingUp className="text-green-600" /> : type === 'expense' ? <TrendingDown className="text-red-500" /> : <Calendar className="text-brand-600" />;

  const getTotals = () => {
    const today = new Date();
    // Use local date string instead of UTC to avoid timezone issues
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // Week boundaries
    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);
    const startOfWeekStr = new Date(startOfWeek.getTime() - (startOfWeek.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // Quarter boundaries
    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const startOfQuarterStr = new Date(startOfQuarter.getTime() - (startOfQuarter.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // Year boundaries
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const startOfYearStr = new Date(startOfYear.getTime() - (startOfYear.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let tToday = 0;
    let tWeek = 0;
    let tQuarter = 0;
    let tYear = 0;

    transactions.forEach(tx => {
      const d = tx.date;
      const amt = type === 'all' ? (tx.type === 'income' ? tx.amount : -tx.amount) : tx.amount;
      if (d === todayStr) tToday += amt;
      // We check if date is >= boundaries. Assuming dates are YYYY-MM-DD
      if (d >= startOfWeekStr && d <= todayStr) tWeek += amt;
      if (d >= startOfQuarterStr && d <= todayStr) tQuarter += amt;
      if (d >= startOfYearStr && d <= todayStr) tYear += amt;
    });

    return { today: tToday, week: tWeek, quarter: tQuarter, year: tYear };
  };

  const totals = getTotals();

  const filteredTransactions = transactions.filter(tx => {
     const searchTerms = searchTerm.toLowerCase().split(',').map(s => s.trim()).filter(s => s);
     const matchesSearch = searchTerms.length === 0 || searchTerms.some(term => 
        tx.category.toLowerCase().includes(term) || (tx.note && tx.note.toLowerCase().includes(term))
     );
     const matchesDate = dateFilter ? tx.date === dateFilter : true;
     return matchesSearch && matchesDate;
  });

  const getChartData = () => {
    const chartMap: Record<string, any> = {};
    filteredTransactions.forEach(tx => {
       const dateStr = tx.date;
       if (dateStr) {
          const monthStr = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          const sortKey = dateStr.substring(0, 7); 
          if (!chartMap[sortKey]) {
             chartMap[sortKey] = { name: monthStr, sortKey, income: 0, expense: 0 };
          }
          if (tx.type === 'income') chartMap[sortKey].income += tx.amount;
          else chartMap[sortKey].expense += tx.amount;
       }
    });

    return Object.values(chartMap)
       .sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey))
       .slice(-6); // last 6 months
  };

  const chartData = getChartData();

  const searchTotal = filteredTransactions.reduce((acc, tx) => {
     const amt = type === 'all' ? (tx.type === 'income' ? tx.amount : -tx.amount) : tx.amount;
     return acc + amt;
  }, 0);

  const getColorClass = (val: number, sectionType: string) => {
     if (sectionType === 'income') return 'text-green-600';
     if (sectionType === 'expense') return 'text-red-500';
     return val >= 0 ? 'text-green-600' : 'text-red-500';
  };

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pr-12">
        <button onClick={() => navigate(`/business/${businessId}`)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
           {icon} {title}
        </h1>
        <div className="w-4"></div>
      </div>

      {/* Summary Totals or Search Totals */}
      {(searchTerm || dateFilter) ? (
         <div className="bg-brand-50 border border-brand-100 p-5 rounded-3xl mb-6 shadow-sm">
            <p className="text-xs font-bold text-brand-600 uppercase mb-2">Search Results Total</p>
            <h3 className={`text-2xl font-black ${getColorClass(searchTotal, type!)}`}>
               {formatCurrency(Math.abs(searchTotal))}
            </h3>
         </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Today</p>
             <h3 className={`text-lg font-black ${getColorClass(totals.today, type!)}`}>{formatCurrency(Math.abs(totals.today))}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Week</p>
             <h3 className={`text-lg font-black ${getColorClass(totals.week, type!)}`}>{formatCurrency(Math.abs(totals.week))}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Quarter</p>
             <h3 className={`text-lg font-black ${getColorClass(totals.quarter, type!)}`}>{formatCurrency(Math.abs(totals.quarter))}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Year</p>
             <h3 className={`text-lg font-black ${getColorClass(totals.year, type!)}`}>{formatCurrency(Math.abs(totals.year))}</h3>
          </div>
        </div>
      )}

      {/* Income vs Expenses Chart */}
      {chartData.length > 0 && (
         <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-6">Trends (Monthly)</h3>
            <div className="h-48 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                     <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#F3F4F6' }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '4px' }}
                     />
                     {(type === 'all' || type === 'income') && (
                        <Bar dataKey="income" name="Income" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={40} />
                     )}
                     {(type === 'all' || type === 'expense') && (
                        <Bar dataKey="expense" name="Expense" fill="#FB7185" radius={[4, 4, 0, 0]} maxBarSize={40} />
                     )}
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      )}

      {/* Search Filters */}
      <div className="flex gap-2 mb-6">
         <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex items-center px-4 shadow-sm">
            <Search className="text-gray-400 w-5 h-5 mr-2 shrink-0" />
            <input 
               type="text" 
               placeholder="Search (use commas for multiple items)..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full py-3 bg-transparent text-sm font-medium outline-none placeholder-gray-400 flex-1 min-w-0"
            />
            {searchTerm && (
               <button onClick={() => setSearchTerm('')} className="p-1 shrink-0">
                  <X size={16} className="text-gray-400" />
               </button>
            )}
         </div>
         <div className="bg-white border border-gray-100 rounded-2xl flex items-center px-3 shadow-sm relative shrink-0">
            <Calendar className="text-gray-400 w-5 h-5" />
            <input 
               type="date" 
               value={dateFilter}
               onChange={(e) => setDateFilter(e.target.value)}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {dateFilter && (
               <button onClick={() => setDateFilter('')} className="p-1 relative ml-1 z-10">
                  <X size={16} className="text-gray-400" />
               </button>
            )}
         </div>
      </div>

      <div className="flex justify-end mb-6">
         <button onClick={handleAddClick} className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {loading && transactions.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading history...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${type === 'all' ? 'bg-brand-50 text-brand-600' : type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {type === 'income' ? <TrendingUp size={32} /> : type === 'expense' ? <TrendingDown size={32} /> : <Calendar size={32} />}
           </div>
           <h2 className="text-lg font-bold text-gray-900 mb-2">No {type === 'all' ? 'history' : type + 's'} found</h2>
           <p className="text-xs text-gray-500 mb-8 max-w-xs mx-auto">Track your business {type === 'all' ? 'history' : type + 's'} here to maintain accurate records.</p>
           {!searchTerm && !dateFilter && <button onClick={handleAddClick} className="bg-gray-900 text-white font-bold py-3 px-6 rounded-xl text-sm">Add First Record</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
           {filteredTransactions.map((tx) => (
              <div key={tx.id} className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                       {tx.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
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
                       <div className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                       </div>
                       {tx.note && <p className="text-[10px] text-gray-400 mt-0.5 max-w-[80px] truncate">{tx.note}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                       <button onClick={() => handleEdit(tx)} className="p-1 text-gray-400 hover:text-brand-600 transition-colors">
                          <Edit2 size={16} />
                       </button>
                       <button onClick={() => { setTxToDelete(tx); setShowDeleteModal(true); }} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                       </button>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Delete Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setTxToDelete(null); }}
        onConfirm={handleDelete}
        itemName={txToDelete ? `${txToDelete.category} - ${formatCurrency(txToDelete.amount)}` : undefined}
      />

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
                     {icon} {editingTx ? 'Edit' : 'Add'} {type === 'all' ? 'Transaction' : type === 'income' ? 'Income' : 'Expense'}
                  </h2>
                  <button 
                    onClick={() => { setShowModal(false); setEditingTx(null); }}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               {(!isPremium && transactions.length >= transactionLimit && !editingTx) ? (
                  <div className="flex flex-col items-center text-center p-6 bg-red-50/50 rounded-3xl border border-red-100 mt-2">
                     <AlertTriangle className="text-red-500 mb-3 animate-pulse" size={40} />
                     <h3 className="font-bold text-gray-900 text-lg">Transaction Limit Reached</h3>
                     <p className="text-sm text-gray-500 mt-2 max-w-sm leading-relaxed">
                        You have logged {transactions.length}/{transactionLimit} free SME transactions for this business. Financed by rewarded ads, watch a short video to unlock more entries!
                     </p>
                     
                     <div className="flex flex-col gap-3 w-full mt-6">
                        <button
                          type="button"
                          onClick={handleWatchAd}
                          disabled={adLoading}
                          className="bg-brand-600 text-white font-bold py-3.5 rounded-2xl w-full flex items-center justify-center gap-2 hover:bg-brand-700 active:scale-95 transition-all shadow-md active:bg-brand-800 disabled:opacity-50"
                        >
                           <Play size={14} fill="white" />
                           {adLoading ? 'Activating Video...' : 'Watch Video Ad (+15 Free Entries)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => { setShowModal(false); navigate('/profile'); }}
                          className="bg-amber-500 text-white font-bold py-3.5 rounded-2xl w-full flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-95 transition-all shadow-md active:bg-amber-700"
                        >
                           <Sparkles size={14} />
                           Go Unlimited with Premium
                        </button>
                     </div>
                  </div>
               ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                     {type === 'all' && (
                       <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Type</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, txType: 'income'})}
                              className={`flex-1 py-3 rounded-xl font-bold border ${formData.txType === 'income' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                            >
                              Income
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, txType: 'expense'})}
                              className={`flex-1 py-3 rounded-xl font-bold border ${formData.txType === 'expense' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                            >
                              Expense
                            </button>
                          </div>
                       </div>
                     )}

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
                       disabled={isSubmitting}
                       className={`mt-4 ${(formData.txType || type) === 'income' ? 'bg-green-600' : 'bg-red-500'} text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2`}
                     >
                       {isSubmitting 
                           ? 'Saving...' 
                           : editingTx 
                              ? 'Update Record' 
                              : `Add ${type === 'all' ? (formData.txType === 'income' ? 'Income' : 'Expense') : type as string}`}
                     </button>
                  </form>
               )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
