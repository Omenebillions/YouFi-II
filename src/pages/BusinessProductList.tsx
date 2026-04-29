import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Package, 
  Trash2, Box, Search, Edit2, X
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../services/dbErrorHandler';

export default function BusinessProductList() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', costPrice: '', sellingPrice: '', stock: '', isService: false });

  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (businessId && user) {
      fetchProducts();
    }
  }, [businessId, user]);

  const fetchProducts = async () => {
    if (!businessId || !user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), where('businessId', '==', businessId), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessId || !formData.name) return;

    setLoading(true);
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          name: formData.name,
          costPrice: formData.costPrice ? parseFloat(formData.costPrice) : 0,
          sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
          stock: formData.isService ? 0 : (parseInt(formData.stock) || 0),
          isService: formData.isService
        });
      } else {
        await addDoc(collection(db, 'products'), {
          name: formData.name,
          costPrice: formData.costPrice ? parseFloat(formData.costPrice) : 0,
          sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
          stock: formData.isService ? 0 : (parseInt(formData.stock) || 0),
          isService: formData.isService,
          businessId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }
      
      setShowModal(false);
      setEditingProduct(null);
      setFormData({ name: '', costPrice: '', sellingPrice: '', stock: '', isService: false });
      fetchProducts();
    } catch (error) {
      if (editingProduct) {
        handleFirestoreError(error, OperationType.UPDATE, `products/${editingProduct.id}`);
      } else {
        handleFirestoreError(error, OperationType.CREATE, `products`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      costPrice: product.costPrice?.toString() || '0',
      sellingPrice: product.sellingPrice?.toString() || product.price?.toString() || '0',
      stock: product.stock?.toString() || '0',
      isService: product.isService || false
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setFormData({ name: '', costPrice: '', sellingPrice: '', stock: '', isService: false });
    setShowModal(true);
  };

  const handleDeleteProduct = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(val);
  };

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(`/business/${businessId}`)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Products & Services</h1>
        <div className="w-4"></div>
      </div>

      <div className="flex gap-3 mb-6">
         <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex items-center px-4 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input 
              className="w-full bg-transparent border-none p-3 text-sm focus:ring-0" 
              placeholder="Search products & services..." 
            />
         </div>
         <button onClick={handleAddClick} className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {loading && products.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading inventory...</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-6">
              <Package size={32} />
           </div>
           <h2 className="text-lg font-bold text-gray-900 mb-2">No items added yet</h2>
           <p className="text-xs text-gray-500 mb-8 max-w-xs mx-auto">Start adding your products and services to track sales easily.</p>
           <button onClick={handleAddClick} className="bg-brand-600 text-white font-bold py-3 px-6 rounded-xl text-sm">Add First Item</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
           {products.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
                       <Box size={24} />
                    </div>
                    <div>
                       <h4 className="font-bold text-gray-900 text-sm">{p.name}</h4>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-brand-600 font-bold text-xs">{formatCurrency(p.sellingPrice || p.price)}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${p.stock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                             {p.stock > 0 ? `${p.stock} In Stock` : 'Out of Stock'}
                          </span>
                       </div>
                       <p className="text-[10px] text-gray-400 font-medium">Cost: {formatCurrency(p.costPrice || 0)}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(p)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-600 transition-colors">
                        <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                    </button>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Product Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 leading-none">{editingProduct ? 'Edit Item' : 'Add New Item'}</h2>
                  <button 
                    onClick={() => { setShowModal(false); setEditingProduct(null); }}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Name</label>
                     <input 
                       required
                       value={formData.name}
                       onChange={(e) => setFormData({...formData, name: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="e.g. Leather Shoe or Consulting"
                     />
                  </div>
                  
                   <div className="grid grid-cols-3 gap-3">
                     <div className="col-span-3 flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                       <span className="text-sm font-bold text-gray-700">This is a Service (No Stock)</span>
                       <input 
                         type="checkbox"
                         checked={formData.isService}
                         onChange={(e) => setFormData({...formData, isService: e.target.checked})}
                         className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 bg-white border-gray-300"
                       />
                     </div>
                     <div className="col-span-3 grid grid-cols-2 gap-3">
                         <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Cost Price (Optional)</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={formData.costPrice}
                              onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
                              className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                              placeholder="0.00"
                            />
                         </div>
                         <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Selling Price (Optional)</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={formData.sellingPrice}
                              onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
                              className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                              placeholder="0.00"
                            />
                         </div>
                     </div>
                     {!formData.isService && (
                         <div className="col-span-3 flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Stock Qty</label>
                            <input 
                              type="number"
                              value={formData.stock}
                              onChange={(e) => setFormData({...formData, stock: e.target.value})}
                              className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                              placeholder="0"
                            />
                         </div>
                     )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="mt-4 bg-gray-900 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? 'Saving...' : editingProduct ? 'Update Item' : 'Add Item'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
