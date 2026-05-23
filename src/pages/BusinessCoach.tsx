import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Markdown from 'react-markdown';
import { supabase } from '../services/supabase';
import { useParams, useNavigate } from 'react-router-dom';

export default function BusinessCoach() {
  const { userProfile, user } = useAuth();
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);

  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: "Hi there! I'm your YouFi Business CFO AI. Ask me about your cash flow, scaling strategies, expense optimization, or how to prosper in your business." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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

      const txStr = (txs || []).map((tx: any) => `${tx.date}: ${tx.type} of ${tx.amount} for ${tx.category}`).join('\n');
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
        body: JSON.stringify({ userMessage, systemInstruction })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setMessages(prev => [...prev, { role: 'model', text: data.text || "I couldn't process that right now." }]);
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
      } else if (e.message?.includes('high demand')) {
         setMessages(prev => [...prev, { role: 'model', text: e.message }]);
      } else {
         setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full flex-1 relative pt-4">
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
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-32">
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
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 py-3 pb-32">
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
