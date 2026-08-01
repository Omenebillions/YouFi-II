import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Package, Camera,
  Trash2, Box, Search, Edit2, X, RefreshCw
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../hooks/useNativeBridge';
import UpgradePrompt from '../components/UpgradePrompt';
import CameraScanner from '../components/CameraScanner';
import { motion, AnimatePresence } from 'motion/react';
import { moveToTrash } from '../services/db';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { ModalTracker } from '../components/ModalTracker';

import { formatCurrency as formatCurrencyGlobal, CURRENCIES } from '../lib/currency';

export default function BusinessProductList() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', costPrice: '', sellingPrice: '', stock: '', isService: false });
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockData, setRestockData] = useState<Record<string, { selected: boolean, qty: string, cost: string }>>({});
  const [recordExpense, setRecordExpense] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showWebScanner, setShowWebScanner] = useState(false);

  const { isNative, isPremium, bridge } = useNativeBridge();
  const productLimit = 15;

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
      const { data } = await supabase.from('products').select('*').eq('business_id', businessId).eq('user_id', user.id);
      if (data) setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !businessId || !formData.name || loading) return;
    
    if (!editingProduct && !isPremium && products.length >= productLimit) {
      setShowModal(false);
      setShowUpgradePrompt(true);
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        await supabase.from('products').update({
          name: formData.name,
          cost_price: formData.costPrice ? parseFloat(formData.costPrice) : 0,
          selling_price: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
          price: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
          stock: formData.isService ? 0 : (parseInt(formData.stock) || 0),
          is_service: formData.isService
        }).eq('id', editingProduct.id);
      } else {
        await supabase.from('products').insert({
          name: formData.name,
          cost_price: formData.costPrice ? parseFloat(formData.costPrice) : 0,
          selling_price: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
          price: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
          stock: formData.isService ? 0 : (parseInt(formData.stock) || 0),
          is_service: formData.isService,
          business_id: businessId,
          user_id: user.id
        });
      }
      
      setShowModal(false);
      setEditingProduct(null);
      setFormData({ name: '', costPrice: '', sellingPrice: '', stock: '', isService: false });
      fetchProducts();
    } catch (error) {
       console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      costPrice: product.cost_price?.toString() || '0',
      sellingPrice: product.selling_price?.toString() || product.price?.toString() || '0',
      stock: product.stock?.toString() || '0',
      isService: product.is_service || false
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    if (!isPremium && products.length >= productLimit) {
      setShowUpgradePrompt(true);
      return;
    }
    setEditingProduct(null);
    setFormData({ name: '', costPrice: '', sellingPrice: '', stock: '', isService: false });
    setShowModal(true);
  };

  const handleCameraScan = async () => {
    if (!isPremium) {
      setShowUpgradePrompt(true);
      return;
    }
    
    if (isNative && bridge?.scanProductImage) {
      setLoading(true);
      try {
        const result = await bridge.scanProductImage();
        if (result) {
          setEditingProduct(null);
          setFormData({ 
            name: result.name || '', 
            costPrice: '', 
            sellingPrice: result.price?.toString() || '', 
            stock: '1', 
            isService: false 
          });
          setShowModal(true);
        }
      } catch (err) {
        console.error("Camera scan error:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setShowWebScanner(true);
    }
  };

  const handleWebScanComplete = (result: { name: string; price?: number; details?: string }) => {
    setShowWebScanner(false);
    setEditingProduct(null);
    setFormData({ 
      name: result.name || '', 
      costPrice: '', 
      sellingPrice: result.price?.toString() || '', 
      stock: '1', 
      isService: false 
    });
    setShowModal(true);
  };

  const handleOpenRestock = () => {
    const initialData: Record<string, { selected: boolean, qty: string, cost: string }> = {};
    products.filter(p => !p.is_service).forEach(p => {
      initialData[p.id] = { selected: false, qty: '', cost: p.cost_price?.toString() || '0' };
    });
    setRestockData(initialData);
    setRecordExpense(true);
    setShowRestockModal(true);
  };

  const handleRestockSubmit = async () => {
    const selectedItems = Object.entries(restockData).filter(([_, data]) => data.selected && parseInt(data.qty) > 0);
    if (selectedItems.length === 0 || !user || !businessId) return;

    setLoading(true);
    try {
      let totalExpense = 0;
      let restockDetails: string[] = [];

      for (const [id, data] of selectedItems) {
        const qty = parseInt(data.qty) || 0;
        const cost = parseFloat(data.cost) || 0;
        const product = products.find(p => p.id === id);
        if (!product) continue;

        await supabase.from('products').update({
          stock: (product.stock || 0) + qty,
          cost_price: cost
        }).eq('id', id);

        const itemCost = qty * cost;
        totalExpense += itemCost;
        restockDetails.push(`${qty}x ${product.name}`);
      }

      if (recordExpense && totalExpense > 0) {
        const { data: biz } = await supabase.from('businesses').select('balance').eq('id', businessId).single();
        if (biz) {
          await supabase.from('businesses').update({ balance: (biz.balance || 0) - totalExpense }).eq('id', businessId);
        }
        
        await supabase.from('business_transactions').insert({
          business_id: businessId,
          user_id: user.id,
          amount: totalExpense,
          type: 'expense',
          category: 'Inventory Restock',
          description: `Restocked: ${restockDetails.join(', ')}`,
          status: 'completed',
          date: new Date().toISOString().split('T')[0]
        });
      }

      setShowRestockModal(false);
      fetchProducts();
    } catch (error) {
      console.error("Error restocking products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    const id = productToDelete.id;
    setLoading(true);
    try {
      await moveToTrash('products', id, productToDelete);
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
       console.error("Error deleting product:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, currencyCode);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalInventoryCost = filteredProducts
    .filter(p => !p.is_service)
    .reduce((acc, p) => acc + (p.stock || 0) * (p.cost_price || 0), 0);

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
         </div>
         <button onClick={handleOpenRestock} className="px-4 h-12 bg-white flex shrink-0 items-center justify-center gap-2 text-gray-700 font-bold border border-gray-100 rounded-2xl shadow-sm hover:border-gray-200 active:scale-95 transition-all text-sm">
            <RefreshCw size={18} />
            <span className="hidden sm:inline">Restock</span>
         </button>
         <button onClick={handleCameraScan} className="w-12 h-12 shrink-0 bg-white border border-gray-100 flex items-center justify-center text-gray-700 rounded-2xl shadow-sm hover:border-gray-200 active:scale-95 transition-all">
            <Camera size={20} />
         </button>
         <button onClick={handleAddClick} className="w-12 h-12 shrink-0 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {/* Total Inventory Value */}
      <div className="bg-gray-900 rounded-3xl p-6 mb-8 text-white shadow-xl flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Inventory Cost</p>
          <div className="text-2xl font-black">{formatCurrency(totalInventoryCost)}</div>
        </div>
        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
          <Package className="text-white w-6 h-6" />
        </div>
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
           {filteredProducts.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
                       <Box size={24} />
                    </div>
                    <div>
                       <h4 className="font-bold text-gray-900 text-sm">{p.name}</h4>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-brand-600 font-bold text-xs">{formatCurrency(p.selling_price || p.price)}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${p.stock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                             {p.stock > 0 ? `${p.stock} In Stock` : 'Out of Stock'}
                          </span>
                       </div>
                       <p className="text-[10px] text-gray-400 font-medium">Cost: {formatCurrency(p.cost_price || 0)}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(p)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-600 transition-colors">
                        <Edit2 size={16} />
                    </button>
                    <button onClick={() => { setProductToDelete(p); setShowDeleteModal(true); }} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                    </button>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Add Transaction Modal */}
      <UpgradePrompt 
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        featureName="Unlimited Products & OCR Inventory Scanning"
      />

      <CameraScanner 
        isOpen={showWebScanner}
        onClose={() => setShowWebScanner(false)}
        onScanComplete={handleWebScanComplete}
      />

      {/* Delete Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setProductToDelete(null); }}
        onConfirm={handleDeleteProduct}
        itemName={productToDelete?.name}
      />

      {/* Product Modal */}
      <ModalTracker isOpen={showModal || showRestockModal || showDeleteModal || showUpgradePrompt || showWebScanner} />
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
               
               {!editingProduct && (
                 <div className="mb-6">
                   <button 
                     type="button" 
                     onClick={handleCameraScan} 
                     className="w-full bg-brand-50 border border-brand-200 text-brand-700 font-bold py-4 rounded-2xl active:scale-95 transition-all flex flex-col items-center justify-center gap-2"
                   >
                     <div className="flex items-center gap-2">
                       <Camera size={20} />
                       <span>Scan Product with Camera</span>
                     </div>
                     <span className="text-xs text-brand-600/80 font-normal">Use camera to snap brand name and auto-fill details</span>
                   </button>
                   
                   <div className="flex items-center gap-4 my-4">
                     <div className="h-px bg-gray-100 flex-1"></div>
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">or enter manually</span>
                     <div className="h-px bg-gray-100 flex-1"></div>
                   </div>
                 </div>
               )}

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

      {/* Restock Modal */}
      <AnimatePresence>
        {showRestockModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRestockModal(false)}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-[40px] z-[70] p-6 pb-24 md:p-8 md:pb-8 max-h-[90vh] flex flex-col max-w-2xl mx-auto shadow-2xl"
            >
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 leading-tight">Restock Products</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Select and update quantities for incoming stock.</p>
                  </div>
                  <button 
                    onClick={() => setShowRestockModal(false)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
                  >
                     <X size={20} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto min-h-0 mb-6 bg-gray-50/50 rounded-2xl p-1 md:p-2 border border-gray-100/50">
                  <div className="flex flex-col gap-2">
                    {products.filter(p => !p.is_service).length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm font-medium">No restockable products found.</div>
                    ) : (
                      products.filter(p => !p.is_service).map((p) => {
                        const rowData = restockData[p.id];
                        if (!rowData) return null;
                        return (
                          <div key={p.id} className={`bg-white p-4 items-center rounded-2xl border ${rowData.selected ? 'border-brand-300 shadow-sm' : 'border-transparent shadow-sm'} transition-colors flex flex-col sm:flex-row gap-4`}>
                            <div className="flex items-center gap-3 self-start sm:self-center w-full sm:w-1/3 shrink-0">
                               <input 
                                 type="checkbox"
                                 checked={rowData.selected}
                                 onChange={(e) => setRestockData({...restockData, [p.id]: { ...rowData, selected: e.target.checked }})}
                                 className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                               />
                               <div className="truncate">
                                 <h4 className="font-bold text-gray-900 text-sm truncate">{p.name}</h4>
                                 <span className="text-xs text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded-full inline-block mt-1">{p.stock} in stock</span>
                               </div>
                            </div>
                            
                            {rowData.selected && (
                              <div className="grid grid-cols-2 gap-3 w-full sm:w-2/3">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Add Qty</label>
                                  <input 
                                    type="number"
                                    min="1"
                                    value={rowData.qty}
                                    placeholder="0"
                                    onChange={(e) => setRestockData({...restockData, [p.id]: { ...rowData, qty: e.target.value }})}
                                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-gray-900 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all text-center"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1 block">Unit Cost</label>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rowData.cost}
                                    onChange={(e) => setRestockData({...restockData, [p.id]: { ...rowData, cost: e.target.value }})}
                                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-gray-900 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
               </div>

               <div className="shrink-0 flex items-center justify-between bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                  <span className="text-sm font-bold text-gray-900">Record as {currencyCode} expense</span>
                  <input 
                    type="checkbox"
                    checked={recordExpense}
                    onChange={(e) => setRecordExpense(e.target.checked)}
                    className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 border-gray-300 bg-white"
                  />
               </div>

               <button 
                 onClick={handleRestockSubmit}
                 disabled={loading}
                 className="shrink-0 w-full bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:active:scale-100"
               >
                 {loading ? 'Processing...' : 'Update Stock'}
               </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
