import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

export default function TrashBin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Trash Listener
    const qTrash = query(
      collection(db, 'trash'), 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(qTrash, (snapshot) => {
      setTrashItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Trash Bin...</div>;
  }

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Trash Bin</h1>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 min-h-[60vh]">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-50 text-gray-500">
           <Trash2 size={24} />
           <p className="text-sm">Deleted items display here. Restoring items logic depends on their original connections.</p>
        </div>

        {trashItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
            </div>
            <p className="text-gray-500 font-medium">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trashItems.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border border-gray-100 rounded-2xl flex flex-col gap-2">
                 <div className="flex justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
                       {item.collectionName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {item.createdAt?.toDate().toLocaleDateString() || ''}
                    </span>
                 </div>
                 <div className="text-sm text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap bg-gray-50 p-2 rounded-xl mt-2 font-mono">
                    {JSON.stringify(item.data).substring(0, 80)}...
                 </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
