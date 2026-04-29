import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, 
  ShoppingBag, Search, Calendar,
  TrendingUp, TrendingDown, ShoppingCart, Edit2
} from 'lucide-react';
import { 
  collection, query, where, getDocs, 
  addDoc, serverTimestamp, deleteDoc, 
  doc, orderBy, limit, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function BusinessSaleList() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    productId: '', 
    quantity: '1', 
    unitPrice: '',
    date: new Date().toISOString().split('T')[0] 
  });

  const currencyCode = userProfile?.currency || 'USD';

  useEffect(() => {
    if (businessId && user) {
      fetchSalesAndProducts();
    }
  }, [businessId, user]);

  const fetchSalesAndProducts = async () => {
    if (!businessId || !user) return;
    setLoading(true);
    try {
      const salesQ = query(
        collection(db, 'sales'), 
        where('businessId', '==', businessId),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const salesSnapshot = await getDocs(salesQ);
      setSales(salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const prodQ = query(
        collection(db, 'products'), 
        where('businessId', '==', businessId),
        where('userId', '==', user.uid)
      );
      const prodSnapshot = await getDocs(prodQ);
      setProducts(prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === formData.productId);
    const qty = parseInt(formData.quantity);
    
    if (!user || !businessId || !product || isNaN(qty) || qty <= 0) return;

    if (!product.isService) {
      // Check stock if creating or increasing quantity
      const stockAvailable = editingSale ? product.stock + editingSale.quantity : product.stock;
      if (stockAvailable < qty) {
        alert("Insufficient stock!");
        return;
      }
    }

    const sellingPrice = formData.unitPrice !== '' ? parseFloat(formData.unitPrice) : (product.sellingPrice || product.price || 0);
    const costPrice = product.costPrice || 0;
    const totalPrice = sellingPrice * qty;
    const profit = (sellingPrice - costPrice) * qty;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      if (editingSale) {
        // Revert old values
        const oldProductRef = doc(db, 'products', editingSale.productId);
        const oldProduct = products.find(p => p.id === editingSale.productId);
        if (oldProduct && !oldProduct.isService) {
          batch.update(oldProductRef, { stock: increment(editingSale.quantity) });
        }
        
        const businessRef = doc(db, 'businesses', businessId);
        batch.update(businessRef, { balance: increment(-editingSale.totalPrice) });

        // Update record
        batch.update(doc(db, 'sales', editingSale.id), {
          productId: formData.productId,
          productName: product.name,
          quantity: qty,
          unitPrice: sellingPrice,
          totalPrice,
          profit,
          date: formData.date
        });

        // Apply new values
        if (!product.isService) {
          batch.update(doc(db, 'products', formData.productId), { stock: increment(-qty) });
        }
        batch.update(businessRef, { balance: increment(totalPrice) });

      } else {
        // Add sale record
        const saleRef = doc(collection(db, 'sales'));
        batch.set(saleRef, {
          businessId,
          userId: user.uid,
          productId: formData.productId,
          productName: product.name,
          quantity: qty,
          unitPrice: sellingPrice,
          totalPrice,
          profit,
          date: formData.date,
          createdAt: serverTimestamp()
        });

        // Update product stock
        if (!product.isService) {
          const productRef = doc(db, 'products', formData.productId);
          batch.update(productRef, {
            stock: increment(-qty)
          });
        }

        // Update Business Balance
        const businessRef = doc(db, 'businesses', businessId);
        batch.update(businessRef, {
          balance: increment(totalPrice)
        });
      }

      await batch.commit();

      setShowModal(false);
      setEditingSale(null);
      setFormData({ productId: '', quantity: '1', unitPrice: '', date: new Date().toISOString().split('T')[0] });
      fetchSalesAndProducts();
    } catch (error) {
      console.error("Error saving sale:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sale: any) => {
    setEditingSale(sale);
    setFormData({
      productId: sale.productId,
      quantity: sale.quantity.toString(),
      unitPrice: sale.unitPrice?.toString() || '',
      date: sale.date
    });
    setShowModal(true);
  };

  const handleAddClick = () => {
    setEditingSale(null);
    setFormData({ productId: '', quantity: '1', unitPrice: '', date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const handleDeleteSale = async (sale: any) => {
    if (!window.confirm("Delete this sale? This will restore stock and revert business balance.")) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Revert stock
      const product = products.find(p => p.id === sale.productId);
      if (!product || (product && !product.isService)) {
         batch.update(doc(db, 'products', sale.productId), {
           stock: increment(sale.quantity)
         });
      }
      
      // Revert balance
      batch.update(doc(db, 'businesses', businessId!), {
        balance: increment(-sale.totalPrice)
      });

      // Delete record
      batch.delete(doc(db, 'sales', sale.id));

      await batch.commit();
      fetchSalesAndProducts();
    } catch (error) {
      console.error("Error deleting sale:", error);
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
        <h1 className="text-xl font-bold text-gray-900">Sales Records</h1>
        <div className="w-4"></div>
      </div>

      <div className="flex gap-3 mb-6">
         <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex items-center px-4 shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input 
              className="w-full bg-transparent border-none p-3 text-sm focus:ring-0" 
              placeholder="Search sales..." 
            />
         </div>
         <button onClick={handleAddClick} className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {loading && sales.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading sales...</div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mx-auto mb-6">
              <ShoppingBag size={32} />
           </div>
           <h2 className="text-lg font-bold text-gray-900 mb-2">No sales recorded</h2>
           <p className="text-xs text-gray-500 mb-8 max-w-xs mx-auto">Start recording your sales to see how your business is performing.</p>
           <button onClick={handleAddClick} className="bg-brand-600 text-white font-bold py-3 px-6 rounded-xl text-sm">Record First Sale</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
           {sales.map((s) => (
              <div key={s.id} className="bg-white p-5 rounded-3xl border border-gray-50 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 font-bold text-xs">
                       {s.quantity}x
                    </div>
                    <div>
                       <h4 className="font-bold text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                          {s.productName || 'Item'}
                       </h4>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-900 font-bold text-sm">{formatCurrency(s.totalPrice)}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{s.date}</span>
                       </div>
                       {s.profit !== undefined && (
                         <div className="flex items-center gap-1 mt-0.5">
                            {s.profit >= 0 ? <TrendingUp size={10} className="text-green-500" /> : <TrendingDown size={10} className="text-red-500" />}
                            <span className={`text-[10px] font-bold ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                               Profit: {formatCurrency(s.profit)}
                            </span>
                         </div>
                       )}
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(s)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-600 transition-colors">
                        <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteSale(s)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                    </button>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Sale Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setEditingSale(null); }}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[70] p-8 pb-32 max-h-[90vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl"
            >
               <h2 className="text-xl font-bold text-gray-900 mb-6">{editingSale ? 'Edit Sale' : 'Record New Sale'}</h2>
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Select Item</label>
                     <select 
                       required
                       value={formData.productId}
                       onChange={(e) => setFormData({...formData, productId: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 appearance-none"
                     >
                        <option value="">Select an item...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id} disabled={!p.isService && p.stock <= 0 && (!editingSale || editingSale.productId !== p.id)}>
                            {p.name} ({formatCurrency(p.sellingPrice || p.price)}) - {p.isService ? 'Service' : `${editingSale && editingSale.productId === p.id ? p.stock + editingSale.quantity : p.stock} in stock`}
                          </option>
                        ))}
                     </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase ml-1">Custom Unit Price (Optional)</label>
                     <input 
                       type="number"
                       step="0.01"
                       value={formData.unitPrice}
                       onChange={(e) => setFormData({...formData, unitPrice: e.target.value})}
                       className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                       placeholder="Leave blank to use default item price"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Quantity</label>
                        <input 
                          required
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Sale Date</label>
                        <input 
                          required
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                     </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading || products.length === 0}
                    className="mt-4 bg-brand-600 text-white font-bold py-4 rounded-2xl w-full active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingSale ? 'Update Record' : 'Complete Sale'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
