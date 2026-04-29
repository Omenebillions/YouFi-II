import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { fetchTransactions } from '../services/db';

export default function Coach() {
  const { userProfile, user } = useAuth();
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: "Hi there! I'm your YouFi financial coach. Ask me about your spending, 'Can I afford this?', or how to budget better." }
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

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      
      // Fetch some recent context
      const txs = await fetchTransactions(user.uid) || [];
      const txStr = txs.slice(0, 10).map((tx: any) => `${tx.date}: ${tx.type} of ${tx.amount} for ${tx.category}`).join('\n');
      
      const systemInstruction = `You are YouFi, an elite personal finance and corporate strategy co-pilot, trained at an MBA standard. 
Provide highly strategic, analytical, and structured financial advice. Use rigorous frameworks (like DCF analysis logic, NPV, ROI, opportunity cost) adapted for personal finance contexts. 
Although your reasoning should be sophisticated and MBA-grade, explain concepts clearly so the average user can act on them.
User Income: ${userProfile?.income} ${userProfile?.currency}
Recent Transactions: ${txStr}
Goal: Help the user optimize capital allocation, manage liquidity risk, and maximize long-term wealth compounding. If they ask if they can afford something, analyze cash flow impact and opportunity cost.`;
      
      const chat = ai.chats.create({
        model: "gemini-3.1-pro-preview",
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });
      
      // Load previous history into context (for simple demonstration)
      // Actually we are not keeping history in `ai.chats` across re-renders in this simple implementation, 
      // but we will send the user message.
      const response = await chat.sendMessage({ message: userMessage });
      
      setMessages(prev => [...prev, { role: 'model', text: response.text || "I couldn't process that right now." }]);
    } catch (e: any) {
      console.error(e);
      if (!navigator.onLine || e.message?.toLowerCase().includes('network') || e.message?.toLowerCase().includes('fetch')) {
         const offlineMBAGuide = `**It seems you are currently offline.**

While I cannot generate real-time AI responses without an internet connection, here is your **Offline MBA-Standard Financial Advisory Guide**:

### 1. The Time Value of Money (TVM)
A dollar today is worth more than a dollar tomorrow. Always evaluate expenses based on their opportunity cost. If you invest that money at a 7% real return instead, how much will you have in 10 years? 

### 2. Cash Flow over Net Worth
Liquidity is oxygen. Track your Free Cash Flow (Income minus essential expenses). Always maintain a liquidity buffer (3-6 months) to protect against downside risk (job loss, emergencies).

### 3. Asset Allocation & Diversification
Don't concentrate risk. Spread capital across asset classes (equities, bonds, real estate). Understand the Beta (volatility) of your portfolio relative to the market.

### 4. ROI & The Sunk Cost Fallacy
Base future spending decisions on future ROI. Ignore "sunk costs" (money already spent that cannot be recovered). If an investment isn't performing, be willing to cut your losses and reallocate capital.

### 5. Leverage (Debt) Management
Understand the spread: If your debt interest rate is 8% and your investment return is 5%, you have negative leverage (destroying wealth). Pay down high-interest debt immediately. Only use debt if the expected return on the asset exceeds the cost of debt (cost of capital).

*Once your connection is restored, please ask your question again for personalized MBA-level analysis on your specific transactions and goals!*`;
         setMessages(prev => [...prev, { role: 'model', text: offlineMBAGuide }]);
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
      <div className="bg-[#f8f9fc]/80 backdrop-blur-md pt-4 pb-4 px-4 pr-12 sticky top-0 z-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
           <Brain size={22} />
        </div>
        <div>
           <h1 className="text-lg font-bold text-gray-900 leading-tight">YouFi Coach</h1>
           <p className="text-xs text-brand-600 font-medium">Online</p>
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
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-4 py-3 pb-32">
        <div className="flex items-center gap-2">
           <input 
             type="text" 
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSend()}
             placeholder="Ask about your budget..."
             className="flex-1 bg-gray-50 border border-gray-200 rounded-full py-3 px-4 text-sm focus:outline-none focus:border-brand-500 transition-colors"
           />
           <button 
             onClick={handleSend}
             disabled={!input.trim() || loading}
             className="w-12 h-12 bg-brand-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300"
           >
              <Send size={18} className={input.trim() && !loading ? 'ml-1' : ''} />
           </button>
        </div>
      </div>
    </div>
  );
}
