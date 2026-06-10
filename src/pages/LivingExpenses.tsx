import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../lib/currency';
import { Plus, Trash2, Home, AlertCircle, ArrowLeft, HeartPulse, Target, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePrivacy } from '../contexts/PrivacyContext';

export default function LivingExpenses() {
  const { user, userProfile } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [entries, setEntries] = useState([{ id: Date.now(), name: '', amount: '', frequency: 'monthly' }]);
  const [businessProfits, setBusinessProfits] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', amount: '', frequency: 'monthly' });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: expensesData } = await supabase
        .from('living_expenses')
        .select('*')
        .eq('user_id', user?.id);
      
      if (expensesData) {
        setExpenses(expensesData);
      }

      // Fetch current month's business profits for a more accurate run-rate
      const { data: businesses } = await supabase.from('businesses').select('*').eq('user_id', user?.id);
      if (businesses) {
        const { data: bizTxs } = await supabase.from('business_transactions').select('*').eq('user_id', user?.id);
        const { data: bizSales } = await supabase.from('sales').select('*').eq('user_id', user?.id);
        
        const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
        let monthlyTotal = 0;

        if (bizTxs) {
          const inc = bizTxs.filter(t => t.type === 'income' && t.date?.startsWith(currentMonthStr)).reduce((acc, t) => acc + t.amount, 0);
          const exp = bizTxs.filter(t => t.type === 'expense' && t.date?.startsWith(currentMonthStr)).reduce((acc, t) => acc + t.amount, 0);
          monthlyTotal += (inc - exp);
        }
        if (bizSales) {
          const salesInc = bizSales.filter(s => s.sale_date?.startsWith(currentMonthStr)).reduce((acc, s) => acc + (s.selling_price * s.quantity_sold), 0);
          const salesExp = bizSales.filter(s => s.sale_date?.startsWith(currentMonthStr)).reduce((acc, s) => acc + (s.cost_price * s.quantity_sold), 0);
          monthlyTotal += (salesInc - salesExp);
        }
        setBusinessProfits(monthlyTotal);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyExpenses = () => {
    return expenses.reduce((acc, exp) => {
      let monthlyAmt = parseFloat(exp.amount) || 0;
      if (exp.frequency === 'weekly') monthlyAmt = (monthlyAmt * 52) / 12; // Precise monthly average
      if (exp.frequency === 'yearly') monthlyAmt = monthlyAmt / 12;
      return acc + monthlyAmt;
    }, 0);
  };

  const monthlyLivingExpenses = calculateMonthlyExpenses();
  const configuredIncome = parseFloat(userProfile?.income?.toString() || '0');
  const totalAvailableIncome = configuredIncome + (businessProfits > 0 ? businessProfits : 0); // Active monthly profit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const validEntries = entries.filter(ent => ent.name && !isNaN(parseFloat(ent.amount)) && parseFloat(ent.amount) > 0);
    if (validEntries.length === 0) return;

    try {
      const inserts = validEntries.map(ent => ({
        user_id: user.id,
        name: ent.name,
        amount: parseFloat(ent.amount),
        frequency: ent.frequency
      }));
      await supabase.from('living_expenses').insert(inserts);
      setShowAddForm(false);
      setEntries([{ id: Date.now(), name: '', amount: '', frequency: 'monthly' }]);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const amount = parseFloat(editData.amount);
    if (!editData.name || isNaN(amount) || amount <= 0) return;

    try {
      await supabase.from('living_expenses').update({
        name: editData.name,
        amount,
        frequency: editData.frequency
      }).eq('id', editingId);
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('living_expenses').delete().eq('id', id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const currencyCode = userProfile?.currency || 'USD';
  const currencyString = (val: number) => formatCurrency(val, currencyCode, isPrivacyMode);

  const deficit = monthlyLivingExpenses - configuredIncome;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-gray-700 shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Living Expenses</h1>
          <p className="text-sm text-gray-500">Track and manage your baseline costs</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <HeartPulse size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-tight">Monthly Living Cost</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{currencyString(monthlyLivingExpenses)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Monthly Validated Income</span>
            <span className="font-bold text-gray-900">{currencyString(configuredIncome)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Est. Monthly Business Profit</span>
            <span className="font-bold text-gray-900">{currencyString(businessProfits > 0 ? businessProfits : 0)}</span>
          </div>
          <div className="h-px w-full bg-gray-200" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium tracking-wide">Expected Total Resources</span>
            <span className="font-black text-emerald-600">{currencyString(totalAvailableIncome)}</span>
          </div>
        </div>

        {monthlyLivingExpenses > totalAvailableIncome && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-900 mb-1">Income Deficit Detected</p>
              <p className="text-xs text-rose-700 leading-relaxed">
                Your living expenses exceed your available monthly income and business profits combined by {currencyString(monthlyLivingExpenses - totalAvailableIncome)}. Consider increasing your income sources or adjusting your expenses.
              </p>
            </div>
          </div>
        )}
        
        {monthlyLivingExpenses <= totalAvailableIncome && monthlyLivingExpenses > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
            <Target size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-900 mb-1">Healthy Runway</p>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Your living expenses are fully covered by your current income baseline.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-8 mb-4 px-2">
        <h2 className="text-lg font-bold text-gray-900">Your Base Expenses</h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-sm font-bold text-brand-600 bg-brand-50 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-brand-100 transition-colors"
        >
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-4 relative z-10 mb-6 pb-32 max-h-[80vh] overflow-y-auto">
          {entries.map((entry, index) => (
            <div key={entry.id} className="space-y-4 pb-6 border-b border-gray-100 last:border-b-0 last:pb-0">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-900">Entry #{index + 1}</h3>
                {entries.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => setEntries(entries.filter((_, i) => i !== index))}
                    className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-2">Expense Name</label>
                <input 
                  required={index === 0}
                  type="text" 
                  value={entry.name}
                  onChange={e => {
                    const newEntries = [...entries];
                    newEntries[index].name = e.target.value;
                    setEntries(newEntries);
                  }}
                  placeholder="Rent, Groceries, Electricity..."
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-2">Amount</label>
                  <input 
                    required={index === 0}
                    type="number" 
                    step="0.01"
                    min="0"
                    value={entry.amount}
                    onChange={e => {
                      const newEntries = [...entries];
                      newEntries[index].amount = e.target.value;
                      setEntries(newEntries);
                    }}
                    placeholder="0.00"
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-2">Billing Cycle</label>
                  <select
                    value={entry.frequency}
                    onChange={e => {
                      const newEntries = [...entries];
                      newEntries[index].frequency = e.target.value;
                      setEntries(newEntries);
                    }}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button 
            type="button" 
            onClick={() => setEntries([...entries, { id: Date.now(), name: '', amount: '', frequency: 'monthly' }])}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 font-bold hover:bg-gray-50 transition-colors mt-2"
          >
            <Plus size={16} /> Add Another Entry
          </button>

          <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
             <button type="submit" className="flex-1 bg-brand-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-brand-200">Save Entries</button>
             <button type="button" onClick={() => setShowAddForm(false)} className="px-6 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition-transform">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading expenses...</div>
      ) : expenses.length === 0 && !showAddForm ? (
        <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
           <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
              <Home size={32} />
           </div>
           <h3 className="text-gray-900 font-bold mb-2">No Living Expenses</h3>
           <p className="text-sm text-gray-500 mb-6 max-w-xs">You haven't added any baseline living costs yet. Track your rent, utilities, and groceries to monitor your financial health.</p>
           <button 
             onClick={() => setShowAddForm(true)}
             className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-lg"
           >
             Add First Expense
           </button>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col gap-4 shadow-sm">
              {editingId === exp.id ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-2">Expense Name</label>
                    <input 
                      required
                      type="text" 
                      value={editData.name}
                      onChange={e => setEditData({...editData, name: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-2">Amount</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        min="0"
                        value={editData.amount}
                        onChange={e => setEditData({...editData, amount: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pl-2">Billing Cycle</label>
                      <select
                        value={editData.frequency}
                        onChange={e => setEditData({...editData, frequency: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                     <button type="submit" className="flex-1 bg-brand-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform shadow-sm">Update</button>
                     <button type="button" onClick={() => setEditingId(null)} className="px-6 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-transform">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                        <Home size={20} />
                     </div>
                     <div>
                        <p className="font-bold text-gray-900 leading-tight mb-1">{exp.name}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{exp.frequency}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <p className="font-black text-gray-900 mr-2">{currencyString(parseFloat(exp.amount))}</p>
                     <button onClick={() => { setEditingId(exp.id); setEditData({ name: exp.name, amount: exp.amount.toString(), frequency: exp.frequency }); }} className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors">
                        <Edit2 size={16} />
                     </button>
                     <button onClick={() => handleDelete(exp.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors">
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
  );
}
