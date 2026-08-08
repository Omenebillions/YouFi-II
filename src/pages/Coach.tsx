import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Sparkles, TrendingUp, AlertCircle, Target, Briefcase, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import { fetchTransactions, getBusinesses, getGoals, getUpcomingPayments } from '../services/db';

export default function Coach() {
  const { userProfile, user } = useAuth();
  const { isPremium, aiTokens, showPaywall, refreshAITokens } = usePremium();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: "Hi there! I'm your YouFi AI Advisor. I have access to your personal and business financials. Choose a topic below or type your question!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextData, setContextData] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const [txs, businesses, goals, upcoming] = await Promise.all([
          fetchTransactions(user.id),
          getBusinesses(user.id),
          getGoals(user.id),
          getUpcomingPayments(user.id)
        ]);
        const personalGoals = goals ? goals.filter((g: any) => !g.frequency?.startsWith('business:')) : [];
        setContextData({ txs, businesses, goals: personalGoals, upcoming });
      } catch (e) {
        console.error("Failed to load context for AI", e);
      }
    }
    loadData();
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (userText: string = input) => {
    if (!userText.trim() || !user || loading) return;
    
    // Quick client check
    if (!isPremium && aiTokens <= 0) {
      showPaywall('Continuous AI Services');
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText.trim() }]);
    setLoading(true);
    
    try {
      const txs = contextData.txs || [];
      const txStr = txs.slice(0, 30).map((tx: any) => `${tx.date}: ${tx.type} of ${tx.amount} for ${tx.category}`).join('\n');
      
      const bizStr = (contextData.businesses || []).map((b: any) => `${b.name} (Balance: ${b.balance})`).join('\n');
      const goalStr = (contextData.goals || []).map((g: any) => `${g.title} (Target: ${g.target_amount}, Saved: ${g.saved_amount})`).join('\n');
      const upcomingStr = (contextData.upcoming || []).map((u: any) => `${u.title} (Amount: ${u.amount}, Due: ${u.due_date})`).join('\n');
      
      const systemInstruction = `You are YouFi Advisor, an elite personal finance and corporate strategy co-pilot, trained at an MBA standard. 
Provide highly strategic, analytical, and structured financial advice. Use rigorous frameworks (DCF analysis logic, NPV, ROI, opportunity cost) adapted for personal and SME finance. 
Explain concepts clearly so the average user can act on them. Be extremely critical of bad financial decisions and encouraging of good ones.

User Financial Context:
Currency: ${userProfile?.currency || 'USD'}
Monthly Income: ${userProfile?.income || 'Not Provided'}

Recent Personal Transactions:
${txStr || 'None'}

User's Businesses (SME):
${bizStr || 'None'}

User's Goals:
${goalStr || 'None'}

Upcoming Payouts/Debts:
${upcomingStr || 'None'}

When generating insights, adhere to these guidelines:
1. Spending Pattern Recognition: Point out anomalies or trends (e.g., "You spent X% more on logistics...").
2. Predictive Alerts: Warn about potential budget overruns or cash flow issues.
3. Debt Strategy: Give optimal strategies for outstanding/upcoming debts.
4. Goal Tracking: Provide actionable steps to close gaps on savings goals.
5. Business Strategy: Advise on cash reserves, inventory scaling, and risk matching for their SME.

Format your responses beautifully in Markdown. Be concise, punchy, and highly analytical.`;

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userMessage: userText.trim(), systemInstruction, isPremium })
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
         const offlineMBAGuide = `**It seems you are currently offline.**
While I cannot generate real-time AI responses without an internet connection, here is your **Offline MBA-Standard Financial Advisory Guide**:
1. **The Time Value of Money (TVM)**: Always evaluate expenses based on their opportunity cost. 
2. **Cash Flow over Net Worth**: Maintain a liquidity buffer (3-6 months) to protect against downside risk.
3. **ROI & The Sunk Cost Fallacy**: Base future spending decisions on future ROI. Ignore "sunk costs".
4. **Leverage (Debt) Management**: Only use debt if the expected return on the asset exceeds the cost of debt.
*Once your connection is restored, please ask your question again!*`;
         setMessages(prev => [...prev, { role: 'model', text: offlineMBAGuide }]);
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

  const suggestionChips = [
    { label: "Analyze my spending patterns", icon: <TrendingUp size={14} /> },
    { label: "Any predictive budget alerts?", icon: <AlertCircle size={14} /> },
    { label: "How should I structure my debt?", icon: <Target size={14} /> },
    { label: "Give me an SME business strategy", icon: <Briefcase size={14} /> }
  ];

  if (!isPremium && aiTokens <= 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] p-6 text-center animate-in fade-in duration-300">
        <div className="w-full max-w-xs flex justify-start mb-4">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} /> Exit AI Advisor
          </button>
        </div>
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mb-5 border border-amber-100 shadow-inner">
          <Brain size={32} className="animate-pulse" />
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">You’ve seen the magic.</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-sm leading-relaxed">
          Unlock unlimited AI financial consulting, OCR receipt scanners, automatic calendar event synchronizations, and strategic SME coaching.
        </p>
        <button
          onClick={() => showPaywall('Continuous AI Services')}
          className="mt-6 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-brand-600/20 active:scale-95 transition-all w-full max-w-xs cursor-pointer"
        >
          Upgrade to Pro for Unlimited AI Advisory
        </button>
      </div>
    );
  }

  const handleExit = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

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
            className="text-[9px] bg-brand-600 hover:bg-brand-700 font-bold text-white px-2.5 py-0.5 rounded-full transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer"
          >
            Upgrade
          </button>
        </div>
      )}
      <div className="bg-[#f8f9fc]/80 backdrop-blur-md pt-4 pb-4 px-4 sticky top-0 z-10 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleExit} 
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-xs shrink-0 cursor-pointer text-xs font-bold"
            title="Exit AI Advisor"
            aria-label="Exit AI Advisor"
          >
            <ArrowLeft size={16} />
            <span>Exit</span>
          </button>
          <div className="w-9 h-9 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 shrink-0">
             <Brain size={20} />
          </div>
          <div className="flex-1 min-w-0">
             <h1 className="text-base font-bold text-gray-900 leading-tight truncate">YouFi AI Advisor</h1>
             <p className="text-[10px] text-brand-600 font-medium truncate">Full Financial Access • MBA Level</p>
          </div>
        </div>
        <button
          onClick={handleExit}
          className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Close ✕
        </button>
      </div>
           <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-24">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
               msg.role === 'user' 
                ? 'bg-brand-600 text-white rounded-tr-sm' 
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
             }`}>
                {msg.role === 'model' && idx === 0 && (
                   <div className="flex flex-wrap gap-2 mt-4 mb-2">
                     {suggestionChips.map((chip, i) => (
                        <button 
                           key={i}
                           onClick={() => handleSend(chip.label)}
                           className="flex items-center gap-1.5 text-xs bg-brand-50 text-brand-700 font-semibold px-3 py-1.5 rounded-full hover:bg-brand-100 transition-colors border border-brand-100"
                        >
                           {chip.icon} {chip.label}
                        </button>
                     ))}
                   </div>
                )}
                {msg.role === 'model' ? (
                   <div className="markdown-body text-sm prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-brand-600">
                     <Markdown>{msg.text}</Markdown>
                   </div>
                ) : (
                  <p className="text-sm font-medium">{msg.text}</p>
                )}
             </div>
          </div>
        ))}
        {loading && (
           <div className="flex justify-start">
             <div className="bg-white border border-gray-100 text-brand-600 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm text-sm flex gap-2 items-center">
                <Sparkles size={16} className="animate-pulse" />
                <span className="font-medium animate-pulse">Analyzing financials</span>
                <div className="flex gap-0.5 ml-1">
                   <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '100ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '200ms'}}>.</span>
                </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 pt-3 pb-3">
        <div className="flex flex-col gap-2 relative max-w-2xl mx-auto">
           <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all shadow-sm">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your AI Advisor..."
                className="flex-1 bg-transparent py-2 px-3 text-sm focus:outline-none text-gray-900 placeholder:text-gray-400 font-medium"
              />
              <button 
                onClick={() => handleSend(input)}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:bg-gray-200 transition-transform active:scale-95 shrink-0"
              >
                 <Send size={16} className={input.trim() && !loading ? 'ml-0.5' : ''} />
              </button>
           </div>
           <p className="text-[10px] text-center text-gray-400 font-medium">AI can make mistakes. Verify important financial decisions.</p>
        </div>
      </div>
    </div>
  );
}
