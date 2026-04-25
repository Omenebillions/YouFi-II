import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, DollarSign, Save } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { collections } from '../services/db';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/dbErrorHandler';

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira (NGN)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR)' },
];

export default function Profile() {
  const { userProfile, user, logout } = useAuth();
  const [income, setIncome] = useState(userProfile?.income?.toString() || '0');
  const [currency, setCurrency] = useState(userProfile?.currency || 'USD');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);
    setSaved(false);
    
    try {
      await updateDoc(doc(db, collections.users, user.uid), {
        income: parseFloat(income),
        currency: currency
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, collections.users);
    } finally {
      setLoading(false);
    }
  };

  const currentSymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-8 px-4 pt-12 tracking-tight">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 px-1 pr-12">Settings</h1>
      
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 mb-6 relative overflow-hidden">
        <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-brand-400 to-brand-600 left-0"></div>
        <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={32} />
            )}
        </div>
        <div>
           <h2 className="text-xl font-bold text-gray-900">{userProfile?.name}</h2>
           <p className="text-sm text-gray-500">{userProfile?.email}</p>
        </div>
      </div>
      
      {/* Financial Setup */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-brand-500" />
            Financial Baseline
        </h3>
        
        <div className="space-y-4">
           <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Global Currency</label>
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
           </div>
           <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Income ({currentSymbol})</label>
              <input 
                type="number" 
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors text-gray-900 font-semibold"
              />
           </div>
           
           <button 
             onClick={handleUpdate}
             disabled={loading}
             className="w-full bg-gray-900 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
           >
              {loading ? 'Saving...' : (
                <>
                  <Save size={16} /> Save Changes
                </>
              )}
           </button>
           {saved && <p className="text-xs text-center text-success-500 font-medium">Settings updated successfully! Changes may require a refresh.</p>}
        </div>
      </div>
      
      {/* Logout */}
      <button 
        onClick={logout}
        className="w-full mt-auto bg-white border border-danger-200 text-danger-500 rounded-2xl py-4 font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
      >
         <LogOut size={20} />
         Log Out
      </button>
    </div>
  );
}
