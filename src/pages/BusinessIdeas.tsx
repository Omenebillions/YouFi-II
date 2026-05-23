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
        <button onClick={() => { setViewIdea(null); setFormData({title: '', description: '', plan: ''}); setShowModal(true); }} className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-sm transition-transform active:scale-95">
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
            <p className="text-sm text-gray-500 font-medium mb-8 max-w-xs mx-auto">Brainstorm your next big venture and write down the perfect business plan.</p>
            <button 
               onClick={() => { setViewIdea(null); setFormData({title: '', description: '', plan: ''}); setShowModal(true); }}
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
                  <div className="flex flex-col gap-6">
                     <div className="flex flex-col gap-1.5 focus-within:text-brand-600 transition-colors">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Idea Title</label>
                        <input 
                           required
                           type="text"
                           value={formData.title}
                           onChange={(e) => setFormData({...formData, title: e.target.value})}
                           className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold shadow-sm"
                           placeholder="e.g. Acme Tech Solutions"
                        />
                     </div>
                     <div className="flex flex-col gap-1.5 focus-within:text-brand-600 transition-colors">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Short Description</label>
                        <textarea 
                           required
                           value={formData.description}
                           onChange={(e) => setFormData({...formData, description: e.target.value})}
                           className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium min-h-[100px] resize-none shadow-sm"
                           placeholder="Brief summary of the idea..."
                        />
                     </div>
                     <div className="flex flex-col gap-1.5 focus-within:text-brand-600 transition-colors flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Business Plan</label>
                        <textarea 
                           value={formData.plan}
                           onChange={(e) => setFormData({...formData, plan: e.target.value})}
                           className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium h-full min-h-[300px] resize-none shadow-sm"
                           placeholder="Write out your full business plan, target market, strategy, etc..."
                        />
                     </div>
                  </div>
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
