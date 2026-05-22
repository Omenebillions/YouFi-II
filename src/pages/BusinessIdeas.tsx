import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ArrowLeft, Trash2, Edit2, Lightbulb, ChevronRight, X, Bot, Sparkles, MoveRight } from 'lucide-react';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import ReactMarkdown from 'react-markdown';

export default function BusinessIdeas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState<any>(null);
  
  const [viewIdea, setViewIdea] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({ title: '', description: '', plan: '' });
  const [generating, setGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const fetchIdeas = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('business_ideas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setIdeas(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchIdeas();

    const channel = supabase.channel('business-ideas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_ideas', filter: `user_id=eq.${user.id}` }, () => {
        fetchIdeas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleGenerateIdea = async () => {
    if (!aiPrompt.trim() || generating) return;
    setGenerating(true);
    
    try {
      const prompt = `You are a vast, comprehensive, and highly capable business planner, expert in planning all types of businesses from small local shops to massive global enterprises. 
      Create a detailed, realistic, and actionable business plan for a new venture based on this concept: "${aiPrompt}".
      
      Please include:
      1. Business Name idea (if none provided)
      2. Executive Summary (The big vision)
      3. Target Market & Competitor Analysis
      4. Operations & Logistics
      5. Monetization, Pricing & Revenue Streams
      6. Immediate Next Steps & Launch Plan
      
      Format beautifully in Markdown.`;

      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: prompt
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const text = data.text || "";
      
      const nameMatch = text.match(/Business Name(?:\sidea)?:\s*([^\n]+)/i);
      const title = nameMatch ? nameMatch[1].replace(/[*]/g, '').trim() : "New Business Idea";
      
      setFormData({
         title,
         description: aiPrompt,
         plan: text
      });

    } catch (error) {
      console.error("Error generating business idea:", error);
      alert("Failed to generate idea. Try again later.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || loading) return;

    setLoading(true);
    try {
      if (viewIdea && viewIdea.id) {
         await supabase.from('business_ideas').update({
            title: formData.title,
            description: formData.description,
            plan: formData.plan
         }).eq('id', viewIdea.id);
      } else {
         await supabase.from('business_ideas').insert({
            title: formData.title,
            description: formData.description,
            plan: formData.plan,
            user_id: user.id
         });
      }
      setShowModal(false);
      setViewIdea(null);
      setFormData({ title: '', description: '', plan: '' });
      setAiPrompt('');
      fetchIdeas();
    } catch (error) {
      console.error("Error saving idea:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ideaToDelete) return;
    setLoading(true);
    try {
      await supabase.from('business_ideas').delete().eq('id', ideaToDelete.id);
      setShowDeleteModal(false);
      setIdeaToDelete(null);
      fetchIdeas();
    } catch (error) {
      console.error("Error deleting idea:", error);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-20">
      <div className="flex items-center justify-between mb-8 pr-4">
        <button onClick={() => navigate('/business')} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 px-4">
           <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest leading-none mb-1">Planning</h2>
           <h1 className="text-xl font-black text-gray-900 leading-tight">
              Business Ideas
           </h1>
        </div>
        <button onClick={() => { setViewIdea(null); setFormData({title: '', description: '', plan: ''}); setAiPrompt(''); setShowModal(true); }} className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-sm transition-transform active:scale-95">
          <Plus size={20} className="w-5 h-5" />
        </button>
      </div>

      {loading && ideas.length === 0 ? (
         <div className="text-center text-gray-400 py-10 text-sm font-medium">Loading your ideas...</div>
      ) : ideas.length === 0 ? (
         <div className="bg-white rounded-[32px] p-10 text-center border border-gray-100 shadow-sm mx-2">
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 mx-auto mb-6">
               <Lightbulb size={32} />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Empty Canvas</h2>
            <p className="text-sm text-gray-500 font-medium mb-8 max-w-xs mx-auto">Brainstorm your next big venture and let AI help you build the perfect business plan.</p>
            <button 
               onClick={() => { setViewIdea(null); setFormData({title: '', description: '', plan: ''}); setAiPrompt(''); setShowModal(true); }}
               className="bg-gray-900 text-white font-bold py-4 px-8 rounded-2xl w-full mx-auto shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
               <Sparkles size={18} className="text-purple-300" /> Start Planning
            </button>
         </div>
      ) : (
         <div className="flex flex-col gap-4 px-2">
            {ideas.map((idea) => (
               <motion.div 
                 key={idea.id}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 onClick={() => { setViewIdea(idea); setFormData({ title: idea.title, description: idea.description, plan: idea.plan }); setShowModal(true); }}
                 className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
               >
                 <div className="flex items-center gap-4 flex-1 truncate pr-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shrink-0">
                       <Lightbulb size={24} />
                    </div>
                    <div className="truncate">
                       <h3 className="font-bold text-gray-900 truncate">{idea.title}</h3>
                       <p className="text-xs text-gray-500 font-medium truncate">{idea.description || "No description provided."}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setIdeaToDelete(idea); setShowDeleteModal(true); }} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                       <Trash2 size={18} />
                    </button>
                    <ChevronRight size={20} className="text-gray-300" />
                 </div>
               </motion.div>
            ))}
         </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setIdeaToDelete(null); }}
        onConfirm={handleDelete}
        itemName={ideaToDelete ? ideaToDelete.title : undefined}
      />

      {/* Add / View Idea Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowModal(false); setViewIdea(null); }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
        )}
        {showModal && (
          <motion.div 
            key="modal-content"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            className="fixed inset-0 top-[15vh] bg-white rounded-t-[40px] z-[70] p-6 pb-24 flex flex-col shadow-2xl"
          >
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <h2 className="text-xl font-black text-gray-900">
                     {viewIdea ? 'Idea details' : 'New Venture'}
                  </h2>
                  <button 
                    onClick={() => { setShowModal(false); setViewIdea(null); }}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-6 w-full">
                  {!viewIdea && !formData.plan ? (
                     // Generate flow
                     <div className="flex flex-col gap-6">
                        <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100/50">
                           <div className="flex items-center gap-3 text-purple-700 font-bold mb-3">
                              <Sparkles size={20} /> AI Idea Generator
                           </div>
                           <p className="text-xs text-purple-600/80 font-medium mb-4 leading-relaxed">
                              Describe your business concept, target market, or even just a loose thought. AI will refine it and generate a comprehensive business plan.
                           </p>
                           <textarea
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="e.g. A subscription service delivering fresh pastries to offices on Monday mornings..."
                              className="w-full bg-white rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 border-none shadow-sm min-h-[140px]"
                           />
                           <button 
                              onClick={handleGenerateIdea}
                              disabled={generating || !aiPrompt.trim()}
                              className="mt-4 w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
                           >
                              {generating ? 'Generating magical plan...' : 'Draft Plan'} <MoveRight size={18} />
                           </button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           <div className="h-px bg-gray-100 flex-1"></div>
                           <span className="text-xs font-bold text-gray-300 uppercase">OR Write manually</span>
                           <div className="h-px bg-gray-100 flex-1"></div>
                        </div>

                        <div className="flex flex-col gap-1.5 focus-within:text-brand-600 transition-colors">
                           <label className="text-xs font-bold text-gray-500 uppercase ml-1">Idea Title</label>
                           <textarea 
                              rows={1}
                              required
                              value={formData.title}
                              onChange={(e) => setFormData({...formData, title: e.target.value})}
                              className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all font-medium resize-none shadow-sm"
                              placeholder="e.g. Acme Tech Solutions"
                           />
                        </div>
                        <div className="flex flex-col gap-1.5 focus-within:text-brand-600 transition-colors">
                           <label className="text-xs font-bold text-gray-500 uppercase ml-1">Short Description</label>
                           <textarea 
                              required
                              value={formData.description}
                              onChange={(e) => setFormData({...formData, description: e.target.value})}
                              className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 transition-all font-medium min-h-[100px]"
                              placeholder="Brief summary of the idea..."
                           />
                        </div>
                     </div>
                  ) : (
                     // Review/Edit flow
                     <>
                        <div className="flex flex-col gap-1.5 pt-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Name</label>
                           <textarea 
                              rows={1}
                              required
                              value={formData.title}
                              onChange={(e) => setFormData({...formData, title: e.target.value})}
                              className="bg-transparent text-2xl font-black focus:outline-none border-b border-dashed border-gray-200 pb-2 text-gray-900 resize-none"
                              placeholder="Business Name..."
                           />
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Description</label>
                           <textarea 
                              required
                              value={formData.description}
                              onChange={(e) => setFormData({...formData, description: e.target.value})}
                              className="bg-transparent text-sm font-medium focus:outline-none border-b border-dashed border-gray-200 pb-2 text-gray-600 resize-none"
                              placeholder="A quick summary..."
                           />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 relative min-h-[300px]">
                           <label className="text-[10px] font-bold text-brand-600 uppercase tracking-widest pl-1 flex items-center gap-1.5 mb-2 mt-2">
                              <Bot size={12} /> Plan Details & Strategy
                           </label>
                           
                           {viewIdea && viewIdea.plan && !formData.plan ? (
                              <textarea 
                              value={viewIdea.plan}
                              onChange={(e) => setFormData({...formData, plan: e.target.value})}
                              className="bg-[#fafafa] rounded-2xl p-5 text-sm leading-relaxed text-gray-700 h-full w-full border border-gray-100 flex-1 focus:ring-2 focus:ring-brand-500 focus:outline-none focus:bg-white font-mono"
                           />) : (
                              <div className="markdown-body bg-[#fafafa] rounded-2xl p-5 text-sm leading-relaxed text-gray-700 flex-1 overflow-y-auto border border-gray-100 prose prose-sm prose-p:text-gray-600 prose-headings:text-gray-900 max-w-none">
                                 <ReactMarkdown>
                                    {formData.plan || "*No plan generated. Write manually or generate with AI.*"}
                                 </ReactMarkdown>
                                 <div className="mt-8 pt-4 border-t border-dashed border-gray-200">
                                    <p className="text-xs text-gray-400 italic mb-2">Edit Plan Content (Markdown supported)</p>
                                    <textarea 
                                       value={formData.plan}
                                       onChange={(e) => setFormData({...formData, plan: e.target.value})}
                                       className="bg-white rounded-xl p-4 text-xs font-mono text-gray-600 w-full min-h-[300px] border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                    />
                                 </div>
                              </div>
                           )}
                           
                        </div>
                     </>
                  )}
               </div>

               <div className="mt-6 shrink-0 pt-2 border-t border-gray-50 flex items-center gap-3">
                  <button 
                     onClick={handleSaveIdea}
                     disabled={loading || !formData.title.trim()}
                     className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-black/5 disabled:opacity-50"
                  >
                     {loading ? 'Saving...' : 'Save Idea & Plan'}
                  </button>
               </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
