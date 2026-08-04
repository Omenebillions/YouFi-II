import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Tag, Mic, MicOff, CreditCard, RotateCw, UploadCloud } from 'lucide-react';
import { addTransaction, fetchTransactions } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { formatCurrency, CURRENCIES } from '../lib/currency';
import { parsePersonalDebt, serializePersonalDebt, getCleanNote, generateRecurringPayments, RecurringPaymentInstance } from '../lib/debt';
import { sanitizeInput } from '../lib/security';

export default function AddTransaction() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isPrivacyMode } = usePrivacy();
  const [type, setType] = useState<'income' | 'expense' | 'debt'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [duration, setDuration] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [payments, setPayments] = useState<RecurringPaymentInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentAdded, setRecentAdded] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (type === 'debt' && isRecurring) {
      const parsedAmount = parseFloat(recurringAmount) || parseFloat(amount) || 0;
      const generated = generateRecurringPayments(repaymentDate, frequency, duration, parsedAmount, note);
      setPayments(generated);
    } else {
      setPayments([]);
    }
  }, [repaymentDate, frequency, duration, amount, isRecurring, type, recurringAmount, note]);

  const handleUpdatePaymentInstance = (index: number, fields: Partial<RecurringPaymentInstance>) => {
    setPayments(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...fields };
      return copy;
    });
  };

  useEffect(() => {
    if (user) {
      fetchTransactions(user.id).then(res => setRecentAdded(res || []));
    }
  }, [user]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const currencyCode = userProfile?.currency || 'USD';
  const currentSymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || '$';

  const categories = {
    expense: ['Food', 'Transport', 'Rent', 'Shopping', 'Insurance', 'Netflix', 'Health', 'Utilities', 'Other Expense'],
    debt: ['Owed to me', 'I owe', 'Credit Card Payment', 'Loan', 'Other Debt']
  };

  const handleVoiceInput = () => {
    try {
      // Check if browser supports SpeechRecognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn("Your browser does not support Voice input. Please use Chrome or Safari on desktop.");
        return;
      }

      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNote((prev) => prev ? `${prev} ${transcript}` : transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Failed to start or initialize recognition:", e);
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || loading) return;
    
    setLoading(true);
    const sanitizedNote = sanitizeInput(note);
    const finalNote = type === 'debt' ? serializePersonalDebt({
      repaymentDate: repaymentDate || date,
      isRecurring,
      frequency: isRecurring ? frequency : '',
      duration: isRecurring ? duration : '',
      recurringAmount: isRecurring ? parseFloat(recurringAmount) : 0,
      payments: isRecurring ? payments : [],
      status: 'unpaid',
      note: sanitizedNote
    }) : sanitizedNote;

    await addTransaction({
      type,
      amount: parseFloat(amount),
      category: sanitizeInput(category).toLowerCase(),
      note: finalNote,
      date
    });
    
    // Refresh the list immediately after adding
    if (user) {
       const txs = await fetchTransactions(user.id);
       setRecentAdded(txs || []);
    }
    
    setLoading(false);
    setAmount('');
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    if (type === 'income') setCategory('');
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    // Delay to allow virtual keyboard to appear
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  return (
    <div className="flex flex-col tracking-tight pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Add Record</h1>
        <button onClick={() => navigate('/auto-import')} className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold border border-brand-100 active:scale-95 transition-transform hover:bg-brand-100">
          <UploadCloud size={14} /> Scan Bank Alert
        </button>
      </div>

      {/* Top Toggle Cards */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => { setType('income'); setCategory('Salary'); }}
          className={`flex-[0_0_auto] w-28 rounded-[20px] p-4 flex flex-col justify-center items-center gap-2 border-2 transition-all ${type === 'income' ? 'border-brand-500 bg-[#ede9fe]' : 'border-transparent bg-white'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
             <Wallet size={16} />
          </div>
          <span className="text-gray-900 font-bold text-xs">Income</span>
        </button>
        <button 
          onClick={() => { setType('expense'); setCategory('Food'); }}
          className={`flex-[0_0_auto] w-28 rounded-[20px] p-4 flex flex-col justify-center items-center gap-2 border-2 transition-all ${type === 'expense' ? 'border-orange-400 bg-[#fff0e6]' : 'border-transparent bg-white'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-orange-400 text-white flex items-center justify-center">
             <Wallet size={16} />
          </div>
          <span className="text-gray-900 font-bold text-xs">Expense</span>
        </button>
        <button 
          onClick={() => { setType('debt'); setCategory('I owe'); }}
          className={`flex-[0_0_auto] w-28 rounded-[20px] p-4 flex flex-col justify-center items-center gap-2 border-2 transition-all ${type === 'debt' ? 'border-red-400 bg-[#fee2e2]' : 'border-transparent bg-white'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center">
             <CreditCard size={16} />
          </div>
          <span className="text-gray-900 font-bold text-xs">Debt</span>
        </button>
      </div>

      {/* Add Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-[24px] shadow-sm p-6 mb-8 border border-gray-100 flex flex-col items-center">
        <h3 className="text-sm font-bold text-gray-500 mb-2">Enter Amount</h3>
        
        <div className="flex items-center text-4xl font-bold text-gray-900 mb-6 w-full justify-center">
          <span className="text-2xl text-gray-400 mr-1">{currentSymbol}</span>
          <input 
            type="number" 
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={handleFocus}
            placeholder="0.00"
            className="w-1/2 bg-transparent focus:outline-none placeholder-gray-300 text-center"
            required
            step="0.01"
          />
        </div>

        {type === 'income' ? (
           <input 
             type="text"
             value={category}
             onChange={(e) => setCategory(e.target.value)}
             onFocus={handleFocus}
             placeholder="Source (e.g. Upwork, Salary)"
             className="w-full p-3 bg-[#f8f9fc] border-none rounded-xl mb-4 font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
             required
           />
        ) : (
           <select 
             value={category} 
             onChange={(e) => setCategory(e.target.value)}
             onFocus={handleFocus}
             className="w-full p-3 bg-[#f8f9fc] border-none rounded-xl mb-4 font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
             required
           >
             <option value="" disabled>Select Category</option>
             {categories[type].map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
           </select>
        )}
        
        <div className="w-full mb-4">
          <label className="text-xs font-semibold text-gray-500 block mb-1">Transaction Date</label>
          <input 
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setRepaymentDate(e.target.value);
            }}
            onFocus={handleFocus}
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium text-gray-700"
            required
          />
        </div>

        {type === 'debt' && (
          <div className="w-full flex flex-col gap-4 mb-4 bg-red-50/40 p-4 rounded-2xl border border-red-100/30">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Repayment Date</label>
              <input 
                type="date"
                value={repaymentDate}
                onChange={(e) => setRepaymentDate(e.target.value)}
                onFocus={handleFocus}
                className="w-full p-3 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium text-gray-700"
                required
              />
            </div>
            
            <div className="flex items-center justify-between pb-1">
              <div>
                <label className="text-xs font-bold text-gray-700 block">Is Repayment Recurring?</label>
                <span className="text-[10px] text-gray-400">Multiple scheduling dates</span>
              </div>
              <input 
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 bg-white border border-gray-300 pointer-events-auto"
              />
            </div>
            
            {isRecurring && (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium text-gray-700"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Duration / Limit</label>
                  <input 
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3 months, 6 weeks, until paid"
                    onFocus={handleFocus}
                    className="w-full p-3 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium text-gray-700 mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['3 weeks', '6 weeks', '3 months', '6 months', '1 year'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDuration(preset)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          duration === preset 
                            ? 'bg-red-500 text-white border-red-500' 
                            : 'bg-red-50/50 text-red-600 border-red-100/50 hover:bg-red-100/40'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Payment Amount per Recurring Payment</label>
                  <input 
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={recurringAmount}
                    onChange={(e) => setRecurringAmount(e.target.value)}
                    placeholder="Defaults to total amount"
                    onFocus={handleFocus}
                    className="w-full p-3 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium text-gray-700"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Specify how much is paid/owed on each recurring cycle.</p>
                </div>

                {payments.length > 0 && (
                  <div className="mt-3 p-3 bg-white border border-gray-100 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Payment Schedule Dates & Custom Amounts ({payments.length})</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          const parsedAmount = parseFloat(recurringAmount) || parseFloat(amount) || 0;
                          setPayments(generateRecurringPayments(repaymentDate, frequency, duration, parsedAmount, note));
                        }} 
                        className="text-[9px] font-extrabold text-brand-600 hover:text-brand-700"
                      >
                        Reset Schedule
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                      {payments.map((p, idx) => (
                        <div key={p.id} className="flex gap-2 items-center justify-between border-b border-gray-50 pb-2 last:border-none last:pb-0">
                          <span className="text-xs text-gray-500 font-semibold shrink-0">#{idx + 1}</span>
                          <input 
                            type="date"
                            value={p.dueDate}
                            onChange={(e) => handleUpdatePaymentInstance(idx, { dueDate: e.target.value })}
                            className="bg-gray-50 p-1 px-1.5 border border-gray-100 rounded text-[11px] font-bold outline-none text-gray-700 w-[110px]"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">{currentSymbol}</span>
                            <input 
                              type="number"
                              value={p.amount}
                              onChange={(e) => handleUpdatePaymentInstance(idx, { amount: parseFloat(e.target.value) || 0 })}
                              className="bg-gray-50 p-1 px-1.5 border border-gray-100 rounded text-[11px] font-bold outline-none w-16 text-right text-gray-700"
                            />
                          </div>
                          
                          <select
                            value={p.status}
                            onChange={(e) => handleUpdatePaymentInstance(idx, { status: e.target.value as any })}
                            className="bg-gray-50 p-1 border border-gray-100 rounded text-[10px] font-extrabold outline-none text-gray-600"
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        <div className="w-full mb-6 relative">
          <label className="text-xs font-semibold text-gray-500 block mb-1">Details / Note</label>
          <div className="relative flex items-center">
             <input 
               type="text"
               value={note}
               onChange={(e) => setNote(e.target.value)}
               onFocus={handleFocus}
               placeholder="Add a note or use voice input..."
               className="w-full p-3 pr-12 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium"
             />
             <button
               type="button"
               onClick={handleVoiceInput}
               className={`absolute right-2 p-2 rounded-lg transition-colors ${isRecording ? 'bg-red-100 text-red-500 animate-pulse outline outline-2 outline-red-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
               title={isRecording ? "Stop Dictation" : "Dictate Note"}
             >
               {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
             </button>
          </div>
          {isRecording && <p className="text-[10px] text-red-500 mt-1 absolute -bottom-4 right-0">Recording... click to stop.</p>}
        </div>

        <button
          type="submit"
          disabled={!amount || !category || loading}
          className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all active:scale-95 text-sm shadow-md"
        >
          {loading ? 'Saving...' : 'Save Record'}
        </button>
      </form>

      {/* Last Added List */}
      <div>
         <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Last Added</h2>
          <span onClick={() => window.location.href = '#history/all'} className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-brand-100 transition-colors">View All</span>
        </div>
        
        <div className="flex flex-col gap-4 pb-32">
             {recentAdded.slice(0, 4).map((tx: any, i: number) => {
              const bgs = ['bg-[#ffedb5]/30 text-orange-500', 'bg-[#eef2ff] text-brand-500', 'bg-red-50 text-red-500', 'bg-green-50 text-green-500'];
              const bg = bgs[Math.abs(tx.category.length) % bgs.length];
              const isDebt = tx.type === 'debt';
              const debtMeta = isDebt ? parsePersonalDebt(tx) : null;
              const cleanNote = getCleanNote(tx, debtMeta);
              const displayNote = cleanNote || (isDebt ? 'Debt' : new Date(tx.date).toLocaleDateString('en-GB'));

              return (
                <div key={tx.id || i} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg}`}>
                        {tx.type === 'debt' ? <CreditCard size={20} /> : <Tag size={20} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 capitalize">
                          {tx.category}
                          {isDebt && debtMeta?.status === 'paid' && (
                            <span className="ml-2 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-extrabold uppercase">Paid</span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">
                          {displayNote}
                          {isDebt && debtMeta?.repaymentDate && (
                            <span className="block text-[10px] text-red-500/80 font-semibold mt-0.5">
                              Due: {debtMeta.repaymentDate} {debtMeta.isRecurring ? `(Recurring: ${debtMeta.frequency}${debtMeta.duration ? `, for ${debtMeta.duration}` : ''})` : ''}
                            </span>
                          )}
                        </p>
                      </div>
                  </div>
                  <div className={`text-sm font-bold ${tx.type === 'income' ? 'text-success-500' : 'text-danger-500'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), currencyCode, isPrivacyMode)}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  );
}
