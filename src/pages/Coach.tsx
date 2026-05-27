import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Sparkles, TrendingUp, AlertCircle, Target, Briefcase, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Markdown from 'react-markdown';
import { fetchTransactions, getBusinesses, getGoals, getUpcomingPayments } from '../services/db';

export default function Coach() {
  const { userProfile, user } = useAuth();
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
        body: JSON.stringify({ userMessage: userText.trim(), systemInstruction })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch AI response');
      
      setMessages(prev => [...prev, { role: 'model', text: data.text || "I couldn't process that right now." }]);
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
      } else if (e.message?.includes('high demand')) {
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

  return (
    <div className="flex flex-col h-full flex-1 relative pt-4">
      <div className="bg-[#f8f9fc]/80 backdrop-blur-md pt-4 pb-4 px-4 pr-12 sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100">
        <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
           <Brain size={22} />
        </div>
        <div>
           <h1 className="text-lg font-bold text-gray-900 leading-tight">YouFi AI Advisor</h1>
           <p className="text-xs text-brand-600 font-medium">Full Financial Access • MBA Level</p>
        </div>
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
      
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 pt-4 pb-6">
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
