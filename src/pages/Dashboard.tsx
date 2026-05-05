import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions } from '../services/db';
import { Bell, ShoppingBag, HeartPulse, Wallet, ArrowDown, CreditCard, BarChart3, TrendingUp, ArrowRightLeft, Building2, TrendingDown, X } from 'lucide-react';
import { isSameMonth, subMonths, format, addDays, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import { formatCurrency } from '../lib/currency';
import { collection, query, where, doc, updateDoc, increment, addDoc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
    BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function Dashboard() {
  const { userProfile, user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ amount: '', businessId: '', note: '', transferType: 'Investment' });
  const [transferLoading, setTransferLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<any[]>([]);
  
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    
    // Personal Transactions Listener (for history & chart)
    const qTx = query(
      collection(db, 'transactions'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      
      // Process Chart Data reactively
      const monthlyData: { [key: string]: { date: string, income: number, expenses: number } } = {};
      data.forEach((item: any) => {
          if (!item.date) return;
          const month = item.date.substring(0, 7);
          if (!monthlyData[month]) {
              monthlyData[month] = { date: month, income: 0, expenses: 0 };
          }
          if (item.type === 'income') monthlyData[month].income += item.amount;
          if (item.type === 'expense') monthlyData[month].expenses += item.amount;
      });
      setChartData(Object.values(monthlyData).sort((a,b) => a.date.localeCompare(b.date)));
      setLoading(false);
    }, (err) => {
      console.error("Personal transactions error:", err);
      setLoading(false);
    });

    // Businesses Listener
    const qBiz = query(collection(db, 'businesses'), where('userId', '==', user.uid));
    const unsubscribeBiz = onSnapshot(qBiz, (snapshot) => {
      setBusinesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Upcoming Payments Listener
    const qUpcoming = query(collection(db, 'upcomingPayments'), where('userId', '==', user.uid));
    const unsubscribeUpcoming = onSnapshot(qUpcoming, (snapshot) => {
      setUpcomingPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeTx();
      unsubscribeBiz();
      unsubscribeUpcoming();
    };
  }, [user]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLoading) return;
    const amount = parseFloat(transferData.amount);
    if (!user || !transferData.businessId || isNaN(amount) || amount <= 0) return;

    setTransferLoading(true);
    try {
      const targetBiz = businesses.find(b => b.id === transferData.businessId);
      
      // Personal to Business Transfer
      
      // Update business balance
      await updateDoc(doc(db, 'businesses', transferData.businessId), {
         balance: increment(amount)
      });

      const category = transferData.transferType || 'Investment';

      // Add business transaction (income)
      await addDoc(collection(db, 'businessTransactions'), {
        businessId: transferData.businessId,
        userId: user.uid,
        type: 'income',
        amount,
        category: category,
        note: transferData.note || `Transfer from personal as ${category}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });

      // If it's a loan, also record it in businessDebts
      if (category === 'Loan') {
        await addDoc(collection(db, 'businessDebts'), {
          amount,
          lender: 'Personal (Owner)',
          dueDate: '',
          status: 'unpaid',
          businessId: transferData.businessId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }

      // Add personal transaction (expense)
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'expense',
        amount,
        category: 'To Business',
        note: `To ${targetBiz.name} (${category}): ${transferData.note}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });

      setShowTransferModal(false);
      setTransferData({ amount: '', businessId: '', note: '', transferType: 'Investment' });
    } catch (error) {
      console.error("Error during transfer:", error);
    } finally {
      setTransferLoading(false);
    }
  };
  
  const currencyCode = userProfile?.currency || 'USD';

  // Dynamic Balance Calculations
  const allIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const allExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const totalBalance = (userProfile?.income || 0) + allIncome - allExpense;
  
  // Current Month Data
  const currentMonthTx = transactions.filter(t => {
    try {
      return t.date ? isSameMonth(new Date(t.date), new Date()) : false;
    } catch {
      return false;
    }
  });

  const incomeTotal = currentMonthTx.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expenseTotal = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const debtsTotal = transactions.filter(t => t.type === 'debt').reduce((acc, t) => acc + t.amount, 0);

  const getIconForCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'shopping': return { icon: <ShoppingBag size={20} />, bg: 'bg-[#eef2ff]', text: 'text-indigo-500' };
      case 'insurance':
      case 'health': return { icon: <HeartPulse size={20} />, bg: 'bg-[#ffedb5]/30', text: 'text-orange-500' };
      default: return { icon: <Wallet size={20} />, bg: 'bg-[#f0f9ff]', text: 'text-sky-500' };
    }
  };

  const expensesByCategory = currentMonthTx.filter(t => t.type === 'expense').reduce((acc, t) => {
    const cat = t.category.toLowerCase();
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const topExpenseCategory = Object.entries(expensesByCategory).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  const insightMessage = topExpenseCategory 
    ? `Highest spend this month: ${topExpenseCategory[0].charAt(0).toUpperCase() + topExpenseCategory[0].slice(1)} (${formatCurrency(topExpenseCategory[1] as number, currencyCode)})` 
    : "Track your expenses to see insights!";

  return (
    <div className="flex flex-col tracking-tight relative pt-4 overflow-x-hidden">
      {/* Header Context */}
      <div className="flex justify-between items-center mb-8 pr-14">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-200">
                <TrendingUp size={24} />
             </div>
             <div>
               <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-0.5 leading-none">Welcome back,</p>
               <h1 className="text-xl font-black text-gray-900 leading-tight">{userProfile?.name?.split(' ')[0] || 'Member'}</h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
              <Bell size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-white shadow-sm flex items-center justify-center font-bold text-brand-600 overflow-hidden">
                {userProfile?.avatar ? <img src={userProfile.avatar} alt="avatar" /> : userProfile?.name?.charAt(0) || 'U'}
            </div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Dark Balance Card */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setShowTransferModal(true)}
            className="bg-gray-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden cursor-pointer group"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-brand-500/20"></div>
            
            <div className="flex justify-between items-start mb-8">
                <div>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Personal Balance</p>
                    <h2 className="text-3xl font-black tracking-tight leading-none">
                        {formatCurrency(totalBalance, currencyCode)}
                    </h2>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Wallet size={20} className="text-brand-400" />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        className="h-full bg-gradient-to-r from-brand-400 to-indigo-400 rounded-full"
                    ></motion.div>
                </div>
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest leading-none">Ready to Transfer</span>
            </div>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500 p-5 rounded-[28px] text-white shadow-lg shadow-emerald-200">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                    <TrendingUp size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5 tracking-wider">Monthly Income</p>
                <h4 className="text-lg font-black">{formatCurrency(incomeTotal, currencyCode)}</h4>
            </div>
            <div className="bg-rose-500 p-5 rounded-[28px] text-white shadow-lg shadow-rose-200">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                    <TrendingDown size={18} />
                </div>
                <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5 tracking-wider">Monthly Spend</p>
                <h4 className="text-lg font-black">{formatCurrency(expenseTotal, currencyCode)}</h4>
            </div>
        </div>
      </div>

      {/* Upcoming Payments Widget */}
      {upcomingPayments.length > 0 && (
          <div 
             onClick={() => navigate('/upcoming-payments')}
             className="bg-brand-50 border border-brand-100 p-6 rounded-[32px] mb-8 cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand-200/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                         <Bell size={20} />
                     </div>
                     <div>
                         <h3 className="text-sm font-black text-gray-900">Upcoming Payments</h3>
                         <p className="text-[10px] uppercase font-bold tracking-widest text-brand-600">Prepare your funds</p>
                     </div>
                 </div>
                 <div className="text-right">
                     <p className="text-xs font-bold text-gray-500">Total Due</p>
                     <p className="text-sm font-black text-gray-900">{formatCurrency(upcomingPayments.reduce((acc, p) => acc + p.amount, 0), currencyCode)}</p>
                 </div>
             </div>
             
             <div className="space-y-3 mt-4 relative z-10">
                 {(() => {
                     const now = new Date();
                     const todayStr = format(now, 'yyyy-MM-dd');
                     const tmrwStr = format(addDays(now, 1), 'yyyy-MM-dd');
                     
                     // Sort by closeness
                     const sorted = [...upcomingPayments].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 3);
                     
                     return sorted.map((p, idx) => {
                         const date = new Date(p.dueDate);
                         let timeLabel = format(date, 'MMM d');
                         
                         if (p.dueDate < todayStr) timeLabel = 'Overdue';
                         else if (p.dueDate === todayStr) timeLabel = 'Today';
                         else if (p.dueDate === tmrwStr) timeLabel = 'Tomorrow';
                         else if (isThisWeek(date)) timeLabel = 'This Week';
                         else if (isThisMonth(date)) timeLabel = 'This Month';
                         else if (isThisYear(date)) timeLabel = 'This Year';
                         
                         return (
                             <div key={idx} className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm border border-gray-50">
                                 <div className="flex items-center gap-3">
                                     <div className={`w-2 h-2 rounded-full ${p.dueDate <= todayStr ? 'bg-red-500' : 'bg-brand-400'}`}></div>
                                     <p className="text-xs font-bold text-gray-800">{p.title}</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-xs font-black text-gray-900">{formatCurrency(p.amount, currencyCode)}</p>
                                     <p className={`text-[10px] font-bold ${p.dueDate <= todayStr ? 'text-red-500' : 'text-gray-400'}`}>{timeLabel}</p>
                                 </div>
                             </div>
                         )
                     })
                 })()}
             </div>
          </div>
      )}

      {chartData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8"
          >
             <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-sm font-black text-gray-900 border-l-4 border-brand-500 pl-3">Personal Growth</h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Out</span>
                    </div>
                </div>
             </div>
             
             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis 
                         dataKey="date" 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                         tickFormatter={(val) => {
                             const [y, m] = val.split('-');
                             // Return Jan, Feb, etc
                             const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                             return months[parseInt(m)-1] || val;
                         }}
                      />
                      <YAxis 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                      />
                      <Tooltip 
                         cursor={{ fill: '#f8fafc' }}
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '10px' }}
                      />
                      <Bar 
                         dataKey="income" 
                         fill="#10b981" 
                         radius={[4, 4, 0, 0]}
                         barSize={12}
                      />
                      <Bar 
                         dataKey="expenses" 
                         fill="#f43f5e" 
                         radius={[4, 4, 0, 0]}
                         barSize={12}
                      />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </motion.div>
      )}

      {/* Mini Insight */}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 mb-8 flex items-start gap-4">
         <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-brand-600 shrink-0">
            <BarChart3 size={16} />
         </div>
         <div>
            <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest mb-1">Financial Intelligence</p>
            <p className="text-xs font-bold text-gray-700 leading-tight">
                {insightMessage}
            </p>
         </div>
      </div>
      
      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTransferModal(false)}
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
                     <ArrowRightLeft className="text-brand-600" />
                     Transfer to Business
                  </h2>
                  <button 
                    onClick={() => setShowTransferModal(false)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               
               {businesses.length === 0 ? (
                  <div className="text-center py-6">
                     <p className="text-gray-500 text-sm mb-4">You haven't registered any business yet.</p>
                     <button 
                       onClick={() => navigate('/business')}
                       className="bg-gray-900 text-white font-bold py-3 px-6 rounded-2xl text-sm"
                     >
                        Register Business now
                     </button>
                  </div>
               ) : (
                  <form onSubmit={handleTransfer} className="flex flex-col gap-4">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Target Business</label>
                        <select 
                          required
                          value={transferData.businessId}
                          onChange={(e) => setTransferData({...transferData, businessId: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all appearance-none"
                        >
                           <option value="">Select a business...</option>
                           {businesses.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                           ))}
                        </select>
                     </div>

                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Amount to Transfer</label>
                        <input 
                          required
                          type="number"
                          value={transferData.amount}
                          onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-brand-500 transition-all px-1"
                          placeholder="0.00"
                        />
                     </div>
                     
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Transfer Type</label>
                        <div className="flex gap-2">
                           {['Investment', 'Loan'].map((t) => (
                              <button 
                                key={t}
                                type="button"
                                onClick={() => setTransferData({...transferData, transferType: t})}
                                className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${transferData.transferType === t ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-gray-100 bg-white text-gray-400'}`}
                              >
                                 {t}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Reference Note</label>
                        <input 
                          value={transferData.note}
                          onChange={(e) => setTransferData({...transferData, note: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                          placeholder="What is this for?"
                        />
                     </div>

                     <button 
                       type="submit" 
                       disabled={transferLoading}
                       className="mt-4 bg-brand-600 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                     >
                       {transferLoading ? 'Processing...' : 'Complete Transfer'}
                     </button>
                  </form>
               )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Recent Transactions */}
      <div>
         <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Transaction</h2>
          <span onClick={() => navigate('/history/all')} className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-brand-100 transition-colors">View All</span>
        </div>
        
        <div className="flex flex-col gap-4">
          {loading ? (
             <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center">
              No transactions yet. Add one!
            </div>
          ) : (
            transactions.slice(0, 5).map(tx => {
              const { icon, bg, text } = getIconForCategory(tx.category);
              const txAmountFormatted = formatCurrency(Math.abs(tx.amount), currencyCode);
              
              return (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} ${text}`}>
                        {icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 capitalize">{tx.category}</h4>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{tx.note || (tx.type === 'debt' ? 'Debt' : 'Transaction')}</p>
                      </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${tx.type === 'income' ? 'text-success-500' : 'text-danger-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{txAmountFormatted}
                    </div>
                    {tx.date && (() => {
                        const d = new Date(tx.date);
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        return <p className="text-[10px] uppercase font-bold text-gray-400 mt-1">{mm}/{dd}/{yyyy}</p>;
                    })()}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}
