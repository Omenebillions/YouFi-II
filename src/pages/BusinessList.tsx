import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, Building2, Lightbulb,
  ChevronRight, ArrowLeft, Trash2, Edit2,
  TrendingUp, TrendingDown, BarChart2, X
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';

export default function BusinessList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bizToDelete, setBizToDelete] = useState<any>(null);
  const [editingBiz, setEditingBiz] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', category: '', description: '' });
  const [globalStats, setGlobalStats] = useState({ income: 0, expenses: 0, profit: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [businessBalances, setBusinessBalances] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const fetchData = async () => {
      const [bizRes, txRes, salesRes] = await Promise.all([
        supabase.from('businesses').select('*').eq('user_id', user.id),
        supabase.from('business_transactions').select('*').eq('user_id', user.id).order('date', { ascending: true }),
        supabase.from('sales').select('*').eq('user_id', user.id).order('date', { ascending: true })
      ]);

      if (bizRes.data) setBusinesses(bizRes.data);
      
      processStats(txRes.data || [], salesRes.data || []);
      setLoading(false);
    };

    fetchData();

    // Subscriptions
    const bizChannel = supabase.channel('biz-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `user_id=eq.${user.id}` }, () => {
        supabase.from('businesses').select('*').eq('user_id', user.id).then(({ data }) => {
          if (data) setBusinesses(data);
        });
      })
      .subscribe();

    const txChannel = supabase.channel('biz-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_transactions', filter: `user_id=eq.${user.id}` }, () => refreshStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `user_id=eq.${user.id}` }, () => refreshStats())
      .subscribe();

    const refreshStats = async () => {
      const [txRes, salesRes] = await Promise.all([
        supabase.from('business_transactions').select('*').eq('user_id', user.id).order('date', { ascending: true }),
        supabase.from('sales').select('*').eq('user_id', user.id).order('date', { ascending: true })
      ]);
      processStats(txRes.data || [], salesRes.data || []);
    };

    return () => {
      supabase.removeChannel(bizChannel);
      supabase.removeChannel(txChannel);
    };
  }, [user]);

  const processStats = (txs: any[], sales: any[]) => {
    let totalInc = 0;
    let totalExp = 0;
    let totalSalesRev = 0;
    const bizBalances: { [key: string]: number } = {};
    const monthlyData: { [key: string]: { date: string, income: number, expenses: number } } = {};

    txs.forEach(data => {
      const bid = data.business_id;
      if (bid) {
        if (!bizBalances[bid]) bizBalances[bid] = 0;
        bizBalances[bid] += (data.type === 'income' ? data.amount : -data.amount);
      }
      if (!data.date) return;
      const month = data.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { date: month, income: 0, expenses: 0 };
      }
      if (data.type === 'income') {
        totalInc += data.amount;
        monthlyData[month].income += data.amount;
      } else {
        totalExp += data.amount;
        monthlyData[month].expenses += data.amount;
      }
    });

    sales.forEach(data => {
      const bid = data.business_id;
      if (bid) {
        if (!bizBalances[bid]) bizBalances[bid] = 0;
        bizBalances[bid] += data.total_price;
      }
      if (!data.date) return;
      const month = data.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { date: month, income: 0, expenses: 0 };
      }
      totalSalesRev += data.total_price;
      monthlyData[month].income += data.total_price;
    });

    setBusinessBalances(bizBalances);
    setGlobalStats({
      income: totalInc + totalSalesRev,
      expenses: totalExp,
      profit: (totalInc + totalSalesRev) - totalExp
    });
    setChartData(Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date)));
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('add') === 'true') {
      handleAddClick();
      // Clear the param
      navigate('/business', { replace: true });
    }
  }, [location.search]);

  const fetchBusinessesOnly = async () => {
    if (!user) return;
    const { data } = await supabase.from('businesses').select('*').eq('user_id', user.id);
    if (data) setBusinesses(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name || loading) return;

    setLoading(true);
    try {
      if (editingBiz) {
        await supabase.from('businesses')
          .update(formData)
          .eq('id', editingBiz.id);
      } else {
        await supabase.from('businesses').insert({
          ...formData,
          user_id: user.id,
          balance: 0
        });
      }
      setShowModal(false);
      setEditingBiz(null);
      setFormData({ name: '', category: '', description: '' });
      await fetchBusinessesOnly();
    } catch (error) {
      console.error("Error saving business:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (biz: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBiz(biz);
    setFormData({
      name: biz.name,
      category: biz.category || '',
      description: biz.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!bizToDelete) return;
    setLoading(true);
    try {
      await supabase.from('businesses').delete().eq('id', bizToDelete.id);
      setShowDeleteModal(false);
      setBizToDelete(null);
    } catch (error) {
      console.error("Error deleting business:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingBiz(null);
    setFormData({ name: '', category: '', description: '' });
    setShowModal(true);
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, userProfile?.currency || 'USD');
  };

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-20">
      <div className="flex items-center justify-between mb-2 pr-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 px-4">
           <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest leading-none mb-1">Welcome back,</h2>
           <h1 className="text-xl font-black text-gray-900 leading-tight">
              {userProfile?.name?.split(' ')[0] || 'Entrepreneur'}
           </h1>
        </div>
        <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold border-2 border-white shadow-sm overflow-hidden">
           {userProfile?.avatar ? <img src={userProfile.avatar} alt="avatar" /> : userProfile?.name?.charAt(0) || 'U'}
        </div>
      </div>

      <div className="mt-8 mb-6">
         <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Empire Overview</h3>
         <div className="grid grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-green-500 p-5 rounded-[32px] text-white shadow-[0_20px_40px_-12px_rgba(34,197,94,0.4)]"
            >
               <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp size={18} />
               </div>
               <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5">Total Income</p>
               <h4 className="text-xl font-black">{formatCurrency(globalStats.income)}</h4>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-500 p-5 rounded-[32px] text-white shadow-[0_20px_40px_-12px_rgba(239,68,68,0.4)]"
            >
               <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                  <TrendingDown size={18} />
               </div>
               <p className="text-[10px] font-bold uppercase opacity-80 mb-0.5">Total Expenses</p>
               <h4 className="text-xl font-black">{formatCurrency(globalStats.expenses)}</h4>
            </motion.div>
         </div>
      </div>

      {chartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8"
        >
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                 <BarChart2 size={16} className="text-brand-600" /> Growth Trends
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-1 bg-brand-50 text-brand-600 rounded-lg">
                 ALL BUSINESSES
              </span>
           </div>
           
           <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                       <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                       dataKey="date" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                       dy={10}
                    />
                    <Tooltip 
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                    <Area 
                       type="monotone" 
                       dataKey="income" 
                       stroke="#22c55e" 
                       strokeWidth={3}
                       fillOpacity={1} 
                       fill="url(#colorInc)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-4 px-2">
         <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Your Ventures</h3>
      </div>

      {loading && businesses.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading your empire...</div>
      ) : businesses.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mx-auto mb-6">
              <Building2 size={32} />
           </div>
           <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to grow?</h2>
           <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">Start tracking your business finances, products, and sales to unlock powerful insights.</p>
           <button 
             onClick={handleAddClick}
             className="bg-brand-600 text-white font-bold py-4 px-8 rounded-2xl w-full shadow-[0_8px_20px_-6px_rgba(85,68,232,0.4)] transition-all active:scale-95"
           >
             Register My Business
           </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1 mb-2">
             <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{businesses.length} Active Businesses</span>
             <button onClick={handleAddClick} className="w-8 h-8 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <Plus size={20} />
             </button>
          </div>
          
          {businesses.map((biz) => (
            <motion.div 
              key={biz.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/business/${biz.id}`)}
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600">
                    <Building2 size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-900">{biz.name}</h3>
                    <div className="flex items-center gap-2">
                       <p className="text-xs text-gray-500 font-medium">{biz.category || 'General'}</p>
                       <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                       <p className={`text-[10px] font-bold ${(businessBalances[biz.id] || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatCurrency(businessBalances[biz.id] || 0)}
                       </p>
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={(e) => handleEdit(biz, e)} className="p-2 text-gray-400 hover:text-brand-600 transition-colors">
                    <Edit2 size={16} />
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); setBizToDelete(biz); setShowDeleteModal(true); }} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                 </button>
                 <ChevronRight size={20} className="text-gray-300 ml-1" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-8 mb-4 px-2">
         <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Ideas & Planning</h3>
      </div>
      
      <motion.div 
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         onClick={() => navigate('/business-ideas')}
         className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all mb-8"
      >
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
               <Lightbulb size={24} />
            </div>
            <div>
               <h3 className="font-bold text-gray-900">Business Ideas</h3>
               <p className="text-xs text-gray-500 font-medium">Use AI to plan and launch your next venture</p>
            </div>
         </div>
         <ChevronRight size={20} className="text-gray-300 ml-1" />
      </motion.div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setBizToDelete(null); }}
        onConfirm={handleDelete}
        itemName={bizToDelete ? bizToDelete.name : undefined}
      />

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setEditingBiz(null); }}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 leading-none">{editingBiz ? 'Update Business' : 'Register Business'}</h2>
                  <button 
                    onClick={() => { setShowModal(false); setEditingBiz(null); }}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Business Name</label>
                     <input 
                       required
                       value={formData.name}
                       onChange={(e) => setFormData({...formData, name: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="e.g. Acme SME Ltd"
                     />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Category</label>
                     <input 
                       value={formData.category}
                       onChange={(e) => setFormData({...formData, category: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="e.g. Retail, Tech, Service"
                     />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Description</label>
                     <textarea 
                       value={formData.description}
                       onChange={(e) => setFormData({...formData, description: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all min-h-[100px]"
                       placeholder="Tell us a bit about your business..."
                     />
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="mt-4 bg-gray-900 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg"
                  >
                    {loading ? 'Processing...' : editingBiz ? 'Save Changes' : 'Create Business'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
