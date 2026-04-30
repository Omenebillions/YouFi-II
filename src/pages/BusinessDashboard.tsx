import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, TrendingUp, TrendingDown, 
  Package, ShoppingCart, ArrowRightLeft, Plus, 
  Calendar, MoreVertical, PieChart, CreditCard, AlertCircle
} from 'lucide-react';
import { doc, onSnapshot, collection, query, where, orderBy, limit, addDoc, serverTimestamp, updateDoc, increment, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

export default function BusinessDashboard() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({ revenue: 0, expenses: 0, products: 0, sales: 0, debts: 0, salesProfit: 0, chartData: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ amount: '', type: 'to-personal', note: '' });

  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (!businessId || !user) return;

    setLoading(true);

    // Business Meta Listener
    const unsubscribeBiz = onSnapshot(doc(db, 'businesses', businessId), (docSnap) => {
      if (docSnap.exists()) {
        setBusiness({ id: docSnap.id, ...docSnap.data() });
      }
    });

    // Stats Listener: Transactions
    const qTx = query(collection(db, 'businessTransactions'), where('businessId', '==', businessId), where('userId', '==', user.uid));
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      let txRev = 0;
      let txExp = 0;
      const chartMap: Record<string, any> = {};

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'income') txRev += data.amount;
        else txExp += data.amount;

        const dateStr = data.date;
        if (dateStr) {
           const monthStr = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
           // sorting key YYYY-MM
           const sortKey = dateStr.substring(0, 7); 
           if (!chartMap[sortKey]) {
              chartMap[sortKey] = { name: monthStr, sortKey, income: 0, expense: 0 };
           }
           if (data.type === 'income') chartMap[sortKey].income += data.amount;
           else chartMap[sortKey].expense += data.amount;
        }
      });
      
      const chartData = Object.values(chartMap)
         .sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey))
         .slice(-6); // last 6 months

      setStats(prev => ({ ...prev, revenue: txRev, expenses: txExp, chartData }));
      setLoading(false);
    });

    // Stats Listener: Products
    const qProd = query(collection(db, 'products'), where('businessId', '==', businessId), where('userId', '==', user.uid));
    const unsubscribeProd = onSnapshot(qProd, (snapshot) => {
      setStats(prev => ({ ...prev, products: snapshot.size }));
    });

    // Stats Listener: Sales
    const qSales = query(collection(db, 'sales'), where('businessId', '==', businessId), where('userId', '==', user.uid));
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      let salesRev = 0;
      let salesProfit = 0;
      snapshot.docs.forEach(s => {
        const data = s.data();
        salesRev += data.totalPrice;
        salesProfit += data.profit || 0;
      });
      setStats(prev => ({ ...prev, sales: snapshot.size, salesProfit }));
    });

    // Stats Listener: Debts
    const qDebt = query(collection(db, 'businessDebts'), where('businessId', '==', businessId), where('userId', '==', user.uid), where('status', '==', 'unpaid'));
    const unsubscribeDebt = onSnapshot(qDebt, (snapshot) => {
      let debtAmt = 0;
      snapshot.docs.forEach(d => debtAmt += d.data().amount);
      setStats(prev => ({ ...prev, debts: debtAmt }));
    });

    // Recent Transactions Listener
    const qRecent = query(collection(db, 'businessTransactions'), where('businessId', '==', businessId), where('userId', '==', user.uid), orderBy('date', 'desc'), limit(5));
    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      setRecentTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeBiz();
      unsubscribeTx();
      unsubscribeProd();
      unsubscribeSales();
      unsubscribeDebt();
      unsubscribeRecent();
    };
  }, [businessId, user]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferData.amount);
    if (!user || !businessId || isNaN(amount) || amount <= 0) return;

    setLoading(true);
    try {
      if (transferData.type === 'to-personal') {
        if (business.balance < amount) {
           alert("Insufficient business balance.");
           setLoading(false);
           return;
        }

        await updateDoc(doc(db, 'businesses', businessId), { balance: increment(-amount) });
        await addDoc(collection(db, 'businessTransactions'), {
           businessId, userId: user.uid, type: 'expense', amount, category: 'Transfer to Personal',
           note: transferData.note || 'Transfer to personal account',
           date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp()
        });
        await addDoc(collection(db, 'transactions'), {
           userId: user.uid, type: 'income', amount, category: 'From Business',
           note: `From ${business.name}: ${transferData.note}`,
           date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'businesses', businessId), { balance: increment(amount) });
        await addDoc(collection(db, 'businessTransactions'), {
           businessId, userId: user.uid, type: 'income', amount, category: 'Transfer from Personal',
           note: transferData.note || 'Transfer from personal account',
           date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp()
        });
        await addDoc(collection(db, 'transactions'), {
           userId: user.uid, type: 'expense', amount, category: 'To Business',
           note: `To ${business.name}: ${transferData.note}`,
           date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp()
        });
      }
      setShowTransferModal(false);
      setTransferData({ amount: '', type: 'to-personal', note: '' });
    } catch (error) {
      console.error("Error during transfer:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(val);
  };

  const netProfit = stats.salesProfit + stats.revenue - stats.expenses;

  if (!business && !loading) return <div className="p-10 text-center">Business not found.</div>;

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate('/business')} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold text-gray-900">{business?.name || 'Loading...'}</h1>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{business?.category}</span>
        </div>
        <button className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-300">
           <MoreVertical size={20} />
        </button>
      </div>

      {/* Hero Stats */}
      <div className="bg-gray-900 rounded-[32px] p-8 text-white shadow-xl mb-6 relative overflow-hidden">
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-8 text-left">
                <div>
                   <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Company Assets</p>
                   <h2 className="text-4xl font-extrabold tracking-tight leading-none">
                      {formatCurrency(business?.balance || 0)}
                   </h2>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                   <Building2 size={20} className="text-brand-400" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 pb-2">
                <div className="flex flex-col gap-1 text-left">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Income</p>
                    <p className="text-lg font-black text-emerald-400">{formatCurrency(stats.revenue)}</p>
                </div>
                <div className="flex flex-col gap-1 text-left border-l border-white/10 pl-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400"></span> Expenses</p>
                    <p className="text-lg font-black text-rose-400">{formatCurrency(stats.expenses)}</p>
                </div>
            </div>

            {/* Income vs Expense Bar */}
            <div className="flex items-center gap-1 mb-8 h-2 opacity-80 hover:opacity-100 transition-opacity">
               <div 
                 className="h-full bg-emerald-400 rounded-l-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
                 style={{ width: `${stats.revenue + stats.expenses === 0 ? 50 : (stats.revenue / (stats.revenue + stats.expenses) * 100)}%` }}
               ></div>
               <div 
                 className="h-full bg-rose-400 rounded-r-full shadow-[0_0_10px_rgba(251,113,133,0.5)]"
                 style={{ width: `${stats.revenue + stats.expenses === 0 ? 50 : (stats.expenses / (stats.revenue + stats.expenses) * 100)}%` }}
               ></div>
            </div>

            <div className="flex gap-3">
               <button onClick={() => setShowTransferModal(true)} className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95 border border-white/5">
                 <ArrowRightLeft size={16} /> Transfer
               </button>
               <button onClick={() => navigate(`/business/${businessId}/transactions/income`)} className="flex-1 bg-brand-600 rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-lg shadow-brand-500/30">
                 <Plus size={16} /> New Entry
               </button>
            </div>
         </div>
         <div className="absolute top-[-40px] right-[-40px] w-64 h-64 bg-brand-600/20 rounded-full blur-3xl shadow-inner shadow-brand-400 pointer-events-none"></div>
      </div>

      {/* SME Tools Section */}
      <div className="grid grid-cols-5 gap-2 mb-8">
         <div onClick={() => navigate(`/business/${businessId}/sales`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mx-auto mb-2">
               <ShoppingCart size={16} />
            </div>
            <p className="text-[8px] font-bold text-gray-400 uppercase">Sales</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/products`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mx-auto mb-2">
               <Package size={16} />
            </div>
            <p className="text-[8px] font-bold text-gray-400 uppercase">Items</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/transactions/income`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mx-auto mb-2">
               <TrendingUp size={16} />
            </div>
            <p className="text-[8px] font-bold text-gray-400 uppercase">Income</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/transactions/expense`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mx-auto mb-2">
               <TrendingDown size={16} />
            </div>
            <p className="text-[8px] font-bold text-gray-400 uppercase">Expenses</p>
         </div>
         <div onClick={() => navigate(`/business/${businessId}/debts`)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer active:scale-95 transition-all text-center">
            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mx-auto mb-2">
               <CreditCard size={16} />
            </div>
            <p className="text-[8px] font-bold text-gray-400 uppercase">Debts</p>
         </div>
      </div>

      {/* Profit Analysis */}
      <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6">
         <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
               <PieChart size={18} className="text-brand-600" /> Net Profit
            </h3>
            <span className={`text-[10px] font-extrabold px-2 py-1 rounded-lg ${netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
               {netProfit >= 0 ? 'Profitable' : 'Loss'}
            </span>
         </div>
         <div className="text-3xl font-extrabold text-gray-900 mb-2">{formatCurrency(netProfit)}</div>
         <p className="text-xs text-gray-500 font-medium">calculated as Sales Margins + Income minus Operating Expenses</p>
         {stats.debts > 0 && (
           <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle size={14} /> Outstanding Debt:</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(stats.debts)}</span>
           </div>
         )}
      </div>

      {/* Income vs Expenses Chart */}
      {stats.chartData.length > 0 && (
         <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8">
            <h3 className="text-sm font-bold text-gray-900 mb-6">Income vs Expenses (Monthly)</h3>
            <div className="h-48 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                     <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#F3F4F6' }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '4px' }}
                     />
                     <Bar dataKey="income" name="Income" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={40} />
                     <Bar dataKey="expense" name="Expense" fill="#FB7185" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      )}

      {/* Recent Activity */}
      <div className="flex flex-col gap-5">
         <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-gray-900">Latest History</h3>
            <span className="text-xs font-bold text-brand-600" onClick={() => navigate(`/business/${businessId}/transactions/all`)}>History</span>
         </div>

         {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm bg-white rounded-3xl border border-dashed border-gray-100">No activity recorded.</div>
         ) : (
            <div className="flex flex-col gap-3">
               {recentTransactions.map((tx) => (
                 <div key={tx.id} className="bg-white p-4 rounded-2xl border border-gray-50 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {tx.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-900 text-xs">{tx.category}</h4>
                          <p className="text-[10px] text-gray-400 font-medium">{tx.date}</p>
                       </div>
                    </div>
                    <div className={`text-xs font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                       {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                 </div>
               ))}
            </div>
         )}
      </div>

      <AnimatePresence>
        {showTransferModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTransferModal(false)} className="fixed inset-0 bg-black/40 z-[60]" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl">
               <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><ArrowRightLeft size={20} className="text-brand-600" /> Fund Transfer</h2>
               <form onSubmit={handleTransfer} className="flex flex-col gap-4">
                  <div className="bg-gray-100/50 p-1 rounded-2xl flex relative h-12">
                     <button type="button" onClick={() => setTransferData({...transferData, type: 'to-personal'})} className={`flex-1 flex items-center justify-center text-xs font-bold rounded-xl transition-all z-10 ${transferData.type === 'to-personal' ? 'text-brand-700 bg-white shadow-sm' : 'text-gray-500'}`}>Business → YouFi</button>
                     <button type="button" onClick={() => setTransferData({...transferData, type: 'to-business'})} className={`flex-1 flex items-center justify-center text-xs font-bold rounded-xl transition-all z-10 ${transferData.type === 'to-business' ? 'text-brand-700 bg-white shadow-sm' : 'text-gray-500'}`}>YouFi → Business</button>
                  </div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount</label><input required type="number" value={transferData.amount} onChange={(e) => setTransferData({...transferData, amount: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold text-lg" placeholder="0.00" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-bold text-gray-500 uppercase ml-1">Reference</label><input value={transferData.note} onChange={(e) => setTransferData({...transferData, note: e.target.value})} className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900" placeholder="Transfer notes..." /></div>
                  <button type="submit" disabled={loading} className="mt-4 bg-gray-900 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg">{loading ? 'Processing...' : 'Transfer Funds'}</button>
                  <button type="button" onClick={() => setShowTransferModal(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest text-center mt-2">Cancel Transaction</button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
