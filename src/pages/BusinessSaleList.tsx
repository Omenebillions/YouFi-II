import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, 
  ShoppingBag, Search, Calendar,
  TrendingUp, TrendingDown, ShoppingCart, Edit2, X
} from 'lucide-react';
import { 
  collection, query, where, getDocs, 
  addDoc, serverTimestamp, deleteDoc, updateDoc,
  doc, orderBy, limit, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/dbErrorHandler';
import { moveToTrash } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

export default function BusinessSaleList() {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingSale, setEditingSale] = useState<any>(null);
  
  useEffect(() => {
    if (location.search.includes('add=true')) {
       setShowModal(true);
    }
  }, [location.search]);
  
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
      handleFirestoreError(error, OperationType.GET, 'sales');
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
      handleFirestoreError(error, OperationType.WRITE, 'sales');
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

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;
    const sale = saleToDelete;
    setLoading(true);
    try {
      // Move to trash first
      await moveToTrash('sales', sale.id, sale);

      // Revert stock
      const product = products.find(p => p.id === sale.productId);
      if (product && !product.isService) {
         try {
           await updateDoc(doc(db, 'products', sale.productId), {
             stock: increment(Number(sale.quantity || 1))
           });
         } catch (err) {
           console.error("Stock update failed", err);
           throw err;
         }
      }
      
      // Revert balance
      try {
        await updateDoc(doc(db, 'businesses', businessId!), {
          balance: increment(-Number(sale.totalPrice || 0))
        });
      } catch (err) {
        console.error("Balance update failed", err);
        throw err;
      }

      // Delete record
      try {
        await deleteDoc(doc(db, 'sales', sale.id));
      } catch (err) {
        console.error("Sale delete failed", err);
        throw err;
      }

      fetchSalesAndProducts();
    } catch (error) {
      alert("Could not delete sale. Check error in console.");
      handleFirestoreError(error, OperationType.DELETE, `sales/${sale.id}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(val);
  };

  const getTotals = () => {
    const today = new Date();
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);
    const startOfWeekStr = new Date(startOfWeek.getTime() - (startOfWeek.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const startOfQuarterStr = new Date(startOfQuarter.getTime() - (startOfQuarter.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const startOfYearStr = new Date(startOfYear.getTime() - (startOfYear.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let tToday = 0;
    let tWeek = 0;
    let tQuarter = 0;
    let tYear = 0;

    sales.forEach(s => {
      const d = s.date;
      if (d === todayStr) tToday += s.totalPrice;
      if (d >= startOfWeekStr && d <= todayStr) tWeek += s.totalPrice;
      if (d >= startOfQuarterStr && d <= todayStr) tQuarter += s.totalPrice;
      if (d >= startOfYearStr && d <= todayStr) tYear += s.totalPrice;
    });

    return { today: tToday, week: tWeek, quarter: tQuarter, year: tYear };
  };

  const totals = getTotals();

  const filteredSales = sales.filter(s => {
     const matchesSearch = s.productName?.toLowerCase().includes(searchTerm.toLowerCase());
     const matchesDate = dateFilter ? s.date === dateFilter : true;
     return matchesSearch && matchesDate;
  });

  const searchTotal = filteredSales.reduce((acc, s) => acc + (s.totalPrice || 0), 0);

  return (
    <div className="flex flex-col tracking-tight pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pr-12">
        <button onClick={() => navigate(`/business/${businessId}`)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Sales Records</h1>
        <div className="w-4"></div>
      </div>

      {/* Summary Totals */}
      {(searchTerm || dateFilter) ? (
         <div className="bg-brand-50 border border-brand-100 p-5 rounded-3xl mb-6 shadow-sm">
            <p className="text-xs font-bold text-brand-600 uppercase mb-2">Search Results Total</p>
            <h3 className="text-2xl font-black text-brand-600">
               {formatCurrency(searchTotal)}
            </h3>
         </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Today</p>
             <h3 className="text-lg font-black text-brand-600">{formatCurrency(totals.today)}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Week</p>
             <h3 className="text-lg font-black text-brand-600">{formatCurrency(totals.week)}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Quarter</p>
             <h3 className="text-lg font-black text-brand-600">{formatCurrency(totals.quarter)}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">This Year</p>
             <h3 className="text-lg font-black text-brand-600">{formatCurrency(totals.year)}</h3>
          </div>
        </div>
      )}

      {/* Search Filters */}
      <div className="flex gap-2 mb-6">
         <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex items-center px-4 shadow-sm">
            <Search className="text-gray-400 w-5 h-5 mr-2 shrink-0" />
            <input 
               type="text" 
               placeholder="Search..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full py-3 bg-transparent text-sm font-medium outline-none placeholder-gray-400 flex-1 min-w-0"
            />
            {searchTerm && (
               <button onClick={() => setSearchTerm('')} className="p-1 shrink-0">
                  <X size={16} className="text-gray-400" />
               </button>
            )}
         </div>
         <div className="bg-white border border-gray-100 rounded-2xl flex items-center px-3 shadow-sm relative shrink-0">
            <Calendar className="text-gray-400 w-5 h-5" />
            <input 
               type="date" 
               value={dateFilter}
               onChange={(e) => setDateFilter(e.target.value)}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {dateFilter && (
               <button onClick={() => setDateFilter('')} className="p-1 relative ml-1 z-10">
                  <X size={16} className="text-gray-400" />
               </button>
            )}
         </div>
      </div>

      <div className="flex justify-end mb-6">
         <button onClick={handleAddClick} className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">
            <Plus size={24} />
         </button>
      </div>

      {loading && filteredSales.length === 0 ? (
        <div className="py-20 text-center text-gray-400">Loading sales...</div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
           <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mx-auto mb-6">
              <ShoppingBag size={32} />
           </div>
           <h2 className="text-lg font-bold text-gray-900 mb-2">No sales recorded</h2>
           <p className="text-xs text-gray-500 mb-8 max-w-xs mx-auto">Start recording your sales to see how your business is performing.</p>
           {!searchTerm && !dateFilter && <button onClick={handleAddClick} className="bg-brand-600 text-white font-bold py-3 px-6 rounded-xl text-sm">Record First Sale</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
           {filteredSales.map((s) => (
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
                    <button onClick={() => { setSaleToDelete(s); setShowDeleteModal(true); }} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                    </button>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Sale Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSaleToDelete(null); }}
        onConfirm={handleDeleteSale}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This will revert business stock and balance, and the record will be moved to the Trash Bin."
        itemName={saleToDelete ? `${saleToDelete.quantity}x ${saleToDelete.productName}` : undefined}
      />

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
