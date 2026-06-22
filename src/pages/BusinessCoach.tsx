import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import Markdown from 'react-markdown';
import { supabase } from '../services/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { parseBusinessTxCategory } from '../lib/business';

export default function BusinessCoach() {
  const { userProfile, user } = useAuth();
  const { isPremium, aiTokens, showPaywall, refreshAITokens } = usePremium();
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);

  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: "Hi there! I'm your YouFi Business CFO AI. Ask me about your cash flow, scaling strategies, expense optimization, or how to prosper in your business." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const zRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!businessId) return;
    const fetchBiz = async () => {
      const { data } = await supabase.from('businesses').select('*').eq('id', businessId).maybeSingle();
      if (data) {
        setBusiness(data);
      }
    };
    fetchBiz();
  }, [businessId]);

  const handleSend = async () => {
    if (!input.trim() || !user || !businessId) return;
    
    // Quick client check
    if (!isPremium && aiTokens <= 0) {
      showPaywall('Continuous AI Services');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);
    
    try {
      // Fetch some recent context using snake_case
      const { data: txs } = await supabase.from('business_transactions')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', user.id)
        .limit(10);
      
      const { data: sales } = await supabase.from('sales')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', user.id)
        .limit(5);

      const txStr = (txs || []).map((tx: any) => {
        const meta = parseBusinessTxCategory(tx.category);
        return `${tx.date}: ${tx.type} of ${tx.amount} for ${meta.category}${meta.note ? ` (${meta.note})` : ''}`;
      }).join('\n');
      const salesStr = (sales || []).map((s: any) => `${s.date}: Sold ${s.quantity} of product for ${s.total_price}`).join('\n');
      
      const systemInstruction = `You are a world-class CFO and Business Strategist AI.
You are advising a business owner using the YouFi app.
Business Name: ${business?.name || 'Unknown'}
Business Category: ${business?.category || 'Unknown'}
Current Cash Balance: ${business?.balance || 0}
User Name: ${userProfile?.fullName || 'User'}

Recent Transactions:
${txStr}

Recent Sales:
${salesStr}

Goal: Provide elite, CFO-level financial advice. Help the user optimize operations, manage cash flow, reduce expenses, price products correctly, and scale their business. Use structural business frameworks (like EBITDA, CAC, LTV, working capital optimization). Be highly strategic, but explain clearly so an entrepreneur can act on your advice to prosper.`;
      
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userMessage, systemInstruction, isPremium })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'token_limit_reached') {
          showPaywall('Continuous AI Services');
          throw new Error(data.message);
        }
        throw new Error(data.error || 'Failed to fetch AI response');
      }
      
      setMessages(prev => [...prev, { role: 'model', text: data.text || "I couldn't process that right now." }]);
      
      // Update tokens count
      refreshAITokens();
    } catch (e: any) {
      console.error(e);
      if (!navigator.onLine || e.message?.toLowerCase().includes('network') || e.message?.toLowerCase().includes('fetch')) {
         const offlineCFO = `**It seems you are currently offline.**

While I cannot generate live CFO insights without an internet connection, here is your **Offline Business Strategy Guide**:

### 1. Cash is King
Profit is an opinion; cash is a fact. Always monitor your operating cash flow. If your business is growing too fast without adequate working capital, you risk insolvency.

### 2. Unit Economics
Understand your Customer Acquisition Cost (CAC) and Lifetime Value (LTV). If CAC > LTV, scaling will destroy your business. Aim for an LTV:CAC ratio of 3:1 or higher.

### 3. Expense Optimization
Regularly audit your fixed and variable costs. Cut expenses that do not contribute to revenue generation or customer satisfaction.

### 4. Pricing Strategy
Don't compete on price alone. Understand your value proposition. If you provide superior value, price accordingly to protect your margins.

*Once your connection is restored, please ask your question again for personalized CFO-level analysis on your business!*`;
         setMessages(prev => [...prev, { role: 'model', text: offlineCFO }]);
      } else if (e.message?.includes('API Key') || e.message?.includes('API_KEY_INVALID')) {
         setMessages(prev => [...prev, { role: 'model', text: `**Configuration Error**: ${e.message}` }]);
      } else if (e.message?.includes('high demand') || e.message?.includes('You’ve seen the magic')) {
         setMessages(prev => [...prev, { role: 'model', text: e.message }]);
      } else {
         setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium && aiTokens <= 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] p-6 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mb-5 border border-amber-100 shadow-inner">
          <Brain size={32} className="animate-pulse" />
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">You’ve seen the magic.</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-sm leading-relaxed">
          Unlock unlimited corporate CFO strategic coaching, automated receipts OCR scanning, and premium bookkeeping consulting options.
        </p>
        <button
          onClick={() => showPaywall('Continuous AI Services')}
          className="mt-6 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all w-full max-w-xs"
        >
          Upgrade to Pro for Unlimited AI CFO
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full flex-1 relative pt-0">
      {!isPremium && (
        <div className="bg-brand-50 border-b border-brand-100 px-4 py-2 flex items-center justify-between text-[11px] font-semibold shrink-0">
          <div className="flex items-center gap-1.5 text-brand-800">
            <Sparkles size={13} className="text-amber-500 fill-amber-500 animate-pulse" />
            <span>Welcome Pack: <span className="font-bold text-gray-950">{aiTokens} of 5</span> Free AI Queries remaining.</span>
          </div>
          <button 
            onClick={() => showPaywall('Continuous AI Services')}
            className="text-[9px] bg-brand-600 hover:bg-brand-700 font-bold text-white px-2.5 py-0.5 rounded-full transition-all shrink-0 active:scale-95 shadow-sm"
          >
            Upgrade
          </button>
        </div>
      )}
      {/* Header */}
      <div className="bg-[#f8f9fc]/80 backdrop-blur-md pt-4 pb-4 px-4 pr-12 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center -ml-2 z-10 transition-transform active:scale-95 shadow-sm">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
             <path d="M15 18l-6-6 6-6"/>
           </svg>
        </button>
        <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
           <Brain size={22} />
        </div>
        <div>
           <h1 className="text-lg font-bold text-gray-900 leading-tight">CFO AI Coach</h1>
           <p className="text-xs text-brand-600 font-medium">{business?.name || 'Loading...'}</p>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-24">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
               msg.role === 'user' 
                ? 'bg-brand-600 text-white rounded-tr-sm' 
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
             }`}>
                {msg.role === 'model' ? (
                  <div className="markdown-body text-sm prose prose-sm max-w-none">
                     <Markdown>{msg.text}</Markdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.text}</p>
                )}
             </div>
          </div>
        ))}
        {loading && (
           <div className="flex justify-start">
             <div className="bg-white border border-gray-100 text-gray-400 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm flex gap-1">
                <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '100ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '200ms'}}>.</span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 py-3 pb-6">
        <div className="flex items-center gap-2">
           <input 
             type="text" 
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSend()}
             placeholder="Ask your CFO AI..."
             className="flex-1 bg-gray-50 border border-gray-200 rounded-full py-3 px-4 text-sm focus:outline-none focus:border-brand-500 transition-colors"
           />
           <button 
             onClick={handleSend}
             disabled={!input.trim() || loading}
             className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300"
           >
              <Send size={18} className={input.trim() && !loading ? 'ml-1' : ''} />
           </button>
        </div>
      </div>
    </div>
  );
}
