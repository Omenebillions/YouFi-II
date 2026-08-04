import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, CheckCircle2, Clock, Printer, Mail, 
  Search, Filter, Settings, Store, Calendar, ArrowRight, X, AlertTriangle, FileSpreadsheet, Loader2, Edit, ChevronRight
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency as formatCurrencyGlobal } from '../lib/currency';

interface BusinessInvoicesProps {
  businessId: string;
  currencyCode: string;
  businessName: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  price: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  status: 'paid' | 'unpaid' | 'overdue' | 'draft';
  notes?: string;
  total: number;
  businessId: string;
  taxRate?: number;
}

export interface BusinessSettings {
  address: string;
  phone: string;
  email: string;
  logo: string; // Emoji or custom text
  paymentInstructions?: string;
}

export default function BusinessInvoices({ businessId, currencyCode, businessName }: BusinessInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>({
    address: '',
    phone: '',
    email: '',
    logo: '🏢',
    paymentInstructions: ''
  });
  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfiguringSettings, setIsConfiguringSettings] = useState(false);
  const [showIncompleteSettingsModal, setShowIncompleteSettingsModal] = useState(false);
  
  // Generator form state
  const [genMode, setGenMode] = useState<'sales' | 'manual'>('sales');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 14 days terms
    return d.toISOString().split('T')[0];
  });
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState('');
  const [manualItems, setManualItems] = useState<InvoiceItem[]>([
    { id: '1', name: '', description: '', quantity: 1, unit: 'Units', price: 0 }
  ]);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  
  // Helper for currency formatting
  const formatCurrency = (val: number) => {
    return formatCurrencyGlobal(val, currencyCode);
  };

  // Load Invoices and Settings on mount
  useEffect(() => {
    if (!businessId) return;
    
    // Load invoices
    const storedInvoices = localStorage.getItem(`youfi_biz_invoices_${businessId}`);
    if (storedInvoices) {
      try {
        setInvoices(JSON.parse(storedInvoices));
      } catch (e) {
        console.error('Error parsing stored invoices:', e);
      }
    } else {
      setInvoices([]);
    }

    // Load settings
    const storedSettings = localStorage.getItem(`youfi_biz_settings_${businessId}`);
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (e) {
        console.error('Error parsing stored settings:', e);
      }
    } else {
      setSettings({
        address: '',
        phone: '',
        email: '',
        logo: '🏢',
        paymentInstructions: ''
      });
    }
  }, [businessId]);

  // Fetch sales whenever we enter generation mode
  useEffect(() => {
    if (isGenerating && genMode === 'sales' && businessId) {
      fetchSales();
    }
  }, [isGenerating, genMode, businessId]);

  // Fetch recorded sales for this business
  const fetchSales = async () => {
    setSalesLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('business_id', businessId)
        .order('date', { ascending: false });
        
      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      console.error('Error fetching sales for invoice generation:', err);
    } finally {
      setSalesLoading(false);
    }
  };

  // Save invoices helper
  const saveInvoices = (updatedList: Invoice[]) => {
    setInvoices(updatedList);
    localStorage.setItem(`youfi_biz_invoices_${businessId}`, JSON.stringify(updatedList));
  };

  // Save settings helper
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`youfi_biz_settings_${businessId}`, JSON.stringify(settings));
    setIsConfiguringSettings(false);
  };

  // Reset generator form
  const resetGenerator = () => {
    const nextNum = invoices.length + 1;
    setInvoiceNumber(`INV-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`);
    setClientName('');
    setClientEmail('');
    setClientAddress('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split('T')[0]);
    setTaxRate(0);
    setCustomNotes('');
    setManualItems([{ id: '1', name: '', quantity: 1, price: 0 }]);
    setSelectedSaleIds([]);
  };

  const startGeneration = () => {
    resetGenerator();
    setIsGenerating(true);
  };

  const checkSettingsIncomplete = () => {
    const defaultLogo = '🏢';
    const isLogoMissing = !settings.logo || settings.logo.trim() === '' || settings.logo === defaultLogo;
    const isAddressMissing = !settings.address || settings.address.trim() === '';
    const isPhoneMissing = !settings.phone || settings.phone.trim() === '';
    return isLogoMissing || isAddressMissing || isPhoneMissing;
  };

  const handleCreateInvoiceClick = () => {
    if (checkSettingsIncomplete()) {
      setShowIncompleteSettingsModal(true);
    } else {
      startGeneration();
    }
  };

  // Add line item in manual mode
  const addManualItem = () => {
    setManualItems([
      ...manualItems,
      { id: Date.now().toString(), name: '', description: '', quantity: 1, unit: 'Units', price: 0 }
    ]);
  };

  // Remove manual line item
  const removeManualItem = (id: string) => {
    if (manualItems.length === 1) return;
    setManualItems(manualItems.filter(item => item.id !== id));
  };

  // Update manual item
  const updateManualItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setManualItems(manualItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Toggle sale selection
  const toggleSaleSelection = (saleId: string) => {
    setSelectedSaleIds(prev => 
      prev.includes(saleId) 
        ? prev.filter(id => id !== saleId) 
        : [...prev, saleId]
    );
  };

  // Calculate potential total of currently configuring invoice
  const getGeneratingSubtotal = () => {
    if (genMode === 'manual') {
      return manualItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    } else {
      const selectedSales = sales.filter(s => selectedSaleIds.includes(s.id));
      return selectedSales.reduce((acc, s) => acc + (s.total_price || 0), 0);
    }
  };

  const getGeneratingTotal = () => {
    const subtotal = getGeneratingSubtotal();
    return subtotal + (subtotal * (taxRate / 100));
  };

  // Handle invoice submission
  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    let itemsToSave: InvoiceItem[] = [];

    if (genMode === 'manual') {
      // Validate items
      const validItems = manualItems.filter(i => i.name.trim() !== '');
      if (validItems.length === 0) {
        alert('Please add at least one valid line item with a name.');
        return;
      }
      itemsToSave = validItems;
    } else {
      const selectedSales = sales.filter(s => selectedSaleIds.includes(s.id));
      if (selectedSales.length === 0) {
        alert('Please select at least one recorded sale.');
        return;
      }
      itemsToSave = selectedSales.map((s, index) => ({
        id: s.id,
        name: `${s.product_name || 'Sale'} (x${s.quantity || 1})`,
        quantity: s.quantity || 1,
        price: s.unit_price || s.total_price || 0
      }));
    }

    const subtotal = itemsToSave.reduce((acc, i) => acc + (i.quantity * i.price), 0);
    const finalTotal = subtotal + (subtotal * (taxRate / 100));

    let updatedInvoices = [...invoices];
    let invoiceToSave: Invoice;

    if (editingInvoiceId) {
      const existingIdx = updatedInvoices.findIndex(i => i.id === editingInvoiceId);
      if (existingIdx !== -1) {
        invoiceToSave = {
          ...updatedInvoices[existingIdx],
          invoiceNumber: invoiceNumber || updatedInvoices[existingIdx].invoiceNumber,
          clientName,
          clientEmail,
          clientAddress,
          date: invoiceDate,
          dueDate,
          items: itemsToSave,
          notes: customNotes,
          total: finalTotal,
          taxRate
        };
        updatedInvoices[existingIdx] = invoiceToSave;
      } else {
        // Fallback if not found for some reason
        invoiceToSave = {
          id: editingInvoiceId,
          invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
          clientName,
          clientEmail,
          clientAddress,
          date: invoiceDate,
          dueDate,
          items: itemsToSave,
          status: 'unpaid',
          notes: customNotes,
          total: finalTotal,
          businessId,
          taxRate
        };
        updatedInvoices = [invoiceToSave, ...updatedInvoices];
      }
    } else {
      invoiceToSave = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
        clientName,
        clientEmail,
        clientAddress,
        date: invoiceDate,
        dueDate,
        items: itemsToSave,
        status: 'unpaid',
        notes: customNotes,
        total: finalTotal,
        businessId,
        taxRate
      };
      updatedInvoices = [invoiceToSave, ...updatedInvoices];
    }

    saveInvoices(updatedInvoices);
    setIsGenerating(false);
    setEditingInvoiceId(null);
    setSelectedInvoice(invoiceToSave); // Auto open details of new/edited invoice
  };

  // Toggle invoice status
  const toggleInvoiceStatus = (invoiceId: string) => {
    const updated = invoices.map(inv => {
      if (inv.id === invoiceId) {
        const nextStatusMap: Record<string, 'paid' | 'unpaid'> = {
          unpaid: 'paid',
          paid: 'unpaid',
          overdue: 'paid',
          draft: 'unpaid'
        };
        const nextStatus = nextStatusMap[inv.status] || 'unpaid';
        return { ...inv, status: nextStatus };
      }
      return inv;
    });
    saveInvoices(updated);
    if (selectedInvoice && selectedInvoice.id === invoiceId) {
      setSelectedInvoice(updated.find(i => i.id === invoiceId) || null);
    }
  };

  // Delete an invoice
  const handleDeleteInvoice = (invoiceId: string) => {
    if (window.confirm('Are you sure you want to delete this invoice record? This is irreversible.')) {
      const updated = invoices.filter(inv => inv.id !== invoiceId);
      saveInvoices(updated);
      setSelectedInvoice(null);
    }
  };

  // Filter invoices based on tab and query
  const filteredInvoices = invoices.filter(inv => {
    const matchesTab = 
      activeTab === 'all' || 
      (activeTab === 'paid' && inv.status === 'paid') ||
      (activeTab === 'unpaid' && (inv.status === 'unpaid' || inv.status === 'overdue')) ||
      (activeTab === 'overdue' && inv.status === 'overdue');
      
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      inv.clientName.toLowerCase().includes(searchLower) ||
      inv.invoiceNumber.toLowerCase().includes(searchLower) ||
      (inv.clientEmail && inv.clientEmail.toLowerCase().includes(searchLower));
      
    return matchesTab && matchesSearch;
  });

  const triggerPrint = () => {
    window.print();
  };

  const handleEditInvoice = () => {
    if (!selectedInvoice) return;
    setGenMode('manual');
    setClientName(selectedInvoice.clientName);
    setClientEmail(selectedInvoice.clientEmail);
    setClientAddress(selectedInvoice.clientAddress);
    setInvoiceDate(selectedInvoice.date);
    setDueDate(selectedInvoice.dueDate);
    setInvoiceNumber(selectedInvoice.invoiceNumber);
    setTaxRate(selectedInvoice.taxRate || 0);
    setCustomNotes(selectedInvoice.notes || '');
    setManualItems(selectedInvoice.items);
    setEditingInvoiceId(selectedInvoice.id);
    
    setSelectedInvoice(null);
    setIsGenerating(true);
  };

  return (
    <div id="invoice-module" className="flex flex-col gap-6 w-full text-left">
      
      {/* HEADER TABS & CONTROLS (Hidden during print) */}
      <div className="print:hidden flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-brand-600" /> Invoice History
          </h2>
          <p className="text-xs text-gray-500 mt-1">Manage, generate, and track payment status of invoices.</p>
        </div>
        
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button 
            onClick={() => setIsConfiguringSettings(true)} 
            className="flex-1 md:flex-none py-2.5 px-4 bg-white border border-gray-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-gray-700 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            <Settings size={15} /> Settings
          </button>
          <button 
            onClick={handleCreateInvoiceClick} 
            className="flex-1 md:flex-none py-2.5 px-4 bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/10 hover:bg-brand-700 transition-all active:scale-95"
          >
            <Plus size={15} /> Create Invoice
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW (Hidden during print) */}
      <div className="print:hidden grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-lg font-black text-gray-900 mt-1">
            {formatCurrency(invoices.reduce((acc, inv) => acc + inv.total, 0))}
          </p>
          <p className="text-[9px] text-gray-400 mt-0.5">{invoices.length} invoices generated</p>
        </div>
        <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100/50 shadow-sm">
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Collected</p>
          <p className="text-lg font-black text-green-700 mt-1">
            {formatCurrency(invoices.filter(i => i.status === 'paid').reduce((acc, inv) => acc + inv.total, 0))}
          </p>
          <p className="text-[9px] text-green-600/80 mt-0.5">
            {invoices.filter(i => i.status === 'paid').length} paid invoices
          </p>
        </div>
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 shadow-sm">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Outstanding</p>
          <p className="text-lg font-black text-amber-800 mt-1">
            {formatCurrency(invoices.filter(i => i.status !== 'paid').reduce((acc, inv) => acc + inv.total, 0))}
          </p>
          <p className="text-[9px] text-amber-700/80 mt-0.5">
            {invoices.filter(i => i.status !== 'paid').length} pending payment
          </p>
        </div>
      </div>

      {/* FILTER BUTTONS & SEARCH BAR (Hidden during print) */}
      <div className="print:hidden flex flex-col gap-3">
        <div className="flex gap-2 bg-gray-100/60 p-1 rounded-xl self-start">
          {(['all', 'paid', 'unpaid', 'overdue'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'paid' ? 'Paid' : tab === 'unpaid' ? 'Unpaid' : 'Overdue'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, email, invoice number..." 
            className="w-full bg-white border border-gray-100 rounded-xl py-3 pl-11 pr-4 text-xs font-medium text-gray-800 focus:outline-none focus:border-brand-500 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* INVOICES LIST (Hidden during print) */}
      <div className="print:hidden flex flex-col gap-3">
        {filteredInvoices.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs bg-white rounded-2xl border border-dashed border-gray-150">
            <FileText size={32} className="mx-auto text-gray-300 mb-2.5" />
            No invoices found matching your criteria.
          </div>
        ) : (
          filteredInvoices.map(invoice => (
            <div 
              key={invoice.id} 
              onClick={() => setSelectedInvoice(invoice)}
              className="bg-white p-4 rounded-xl border border-gray-50 flex items-center justify-between shadow-sm cursor-pointer hover:border-brand-200 transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  invoice.status === 'paid' 
                    ? 'bg-green-50 text-green-600' 
                    : invoice.status === 'overdue' 
                    ? 'bg-red-50 text-red-600' 
                    : 'bg-amber-50 text-amber-600'
                }`}>
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 text-xs">{invoice.invoiceNumber}</span>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                      invoice.status === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : invoice.status === 'overdue' 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-gray-800 text-[11px] mt-0.5">{invoice.clientName}</h4>
                  <p className="text-[9px] text-gray-400 mt-0.5">Due {invoice.dueDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-1">
                  <p className="text-xs font-black text-gray-900">{formatCurrency(invoice.total)}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{invoice.items.length} items</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* COMPACT PRINT PREVIEW - VISIBLE ONLY DURING PRINTING */}
      {selectedInvoice && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] text-left p-8 text-black text-sm leading-relaxed">
          <div className="flex justify-between items-start border-b pb-6 mb-8">
            <div>
              <div className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
                {settings.logo && (settings.logo.startsWith('data:') || settings.logo.startsWith('http')) ? (
                  <img src={settings.logo} alt="Logo" className="h-12 w-auto object-contain rounded-lg" />
                ) : (
                  <span className="text-3xl">{settings.logo || '🏢'}</span>
                )}
                <span>{businessName}</span>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Business Invoice</p>
              
              {/* Business Info */}
              <div className="mt-4 text-xs text-gray-600 flex flex-col gap-0.5">
                {settings.address && <p>{settings.address}</p>}
                {settings.phone && <p>Phone: {settings.phone}</p>}
                {settings.email && <p>Email: {settings.email}</p>}
              </div>
            </div>
            
            <div className="text-right">
              <h2 className="text-2xl font-black text-gray-800 mb-1">INVOICE</h2>
              <p className="font-mono text-gray-600 text-xs">{selectedInvoice.invoiceNumber}</p>
              <div className="mt-4 text-xs text-gray-600 flex flex-col gap-0.5">
                <p><span className="font-bold text-gray-800">Date:</span> {selectedInvoice.date}</p>
                <p><span className="font-bold text-gray-800">Due Date:</span> {selectedInvoice.dueDate}</p>
                <p><span className="font-bold text-gray-800">Status:</span> <span className="uppercase font-extrabold">{selectedInvoice.status}</span></p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To:</p>
              <h4 className="font-black text-gray-800 text-sm">{selectedInvoice.clientName}</h4>
              {selectedInvoice.clientEmail && <p className="text-xs text-gray-600 mt-1">{selectedInvoice.clientEmail}</p>}
              {selectedInvoice.clientAddress && <p className="text-xs text-gray-500 whitespace-pre-line mt-1.5">{selectedInvoice.clientAddress}</p>}
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-8 text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                <th className="py-2.5">Description</th>
                <th className="py-2.5 text-center w-16">Qty</th>
                <th className="py-2.5 text-right w-24">Rate</th>
                <th className="py-2.5 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-150">
                  <td className="py-3">
                    <p className="font-bold text-gray-800">{item.name}</p>
                    {item.description && <p className="text-gray-500 text-[10px] mt-1 whitespace-pre-wrap leading-relaxed max-w-sm">{item.description}</p>}
                  </td>
                  <td className="py-3 text-center text-gray-600">{item.quantity} {item.unit || ''}</td>
                  <td className="py-3 text-right text-gray-600">{formatCurrency(item.price)}</td>
                  <td className="py-3 text-right font-bold text-gray-800">{formatCurrency(item.quantity * item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-start gap-8">
            <div className="flex-1">
              {settings.paymentInstructions && (
                <div className="mb-4">
                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider mb-1">Payment Instructions:</p>
                  <p className="text-[11px] text-gray-600 whitespace-pre-line">{settings.paymentInstructions}</p>
                </div>
              )}
              {selectedInvoice.notes && (
                <div>
                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider mb-1">Notes:</p>
                  <p className="text-[11px] text-gray-500 italic">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>

            <div className="w-64">
              <div className="flex justify-between py-1.5 text-xs text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedInvoice.items.reduce((acc, i) => acc + (i.quantity * i.price), 0))}</span>
              </div>
              {selectedInvoice.taxRate ? (
                <div className="flex justify-between py-1.5 text-xs text-gray-600 border-b border-gray-150 pb-2">
                  <span>Tax ({selectedInvoice.taxRate}%):</span>
                  <span>{formatCurrency(selectedInvoice.items.reduce((acc, i) => acc + (i.quantity * i.price), 0) * (selectedInvoice.taxRate / 100))}</span>
                </div>
              ) : null}
              <div className="flex justify-between py-3 text-sm font-extrabold text-gray-900 border-t border-gray-200 mt-2">
                <span>Total Due:</span>
                <span>{formatCurrency(selectedInvoice.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVOICE DETAILS & PRINT VIEWER (Hidden during print) */}
      <AnimatePresence>
        {selectedInvoice && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedInvoice(null)} 
              className="print:hidden fixed inset-0 bg-black/40 z-[80]" 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }} 
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[90] p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl flex flex-col gap-6 print:absolute print:inset-0 print:rounded-none print:shadow-none print:max-w-none print:max-h-none print:pb-0"
            >
              <div className="print:hidden flex justify-between items-center pb-4 border-b border-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-gray-900">{selectedInvoice.invoiceNumber}</h3>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      selectedInvoice.status === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : selectedInvoice.status === 'overdue' 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{businessName}</p>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all">
                  <X size={16} />
                </button>
              </div>

              {/* ACTION QUICK BAR */}
              <div className="print:hidden flex flex-wrap gap-2">
                <button 
                  onClick={() => toggleInvoiceStatus(selectedInvoice.id)} 
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border ${
                    selectedInvoice.status === 'paid' 
                      ? 'bg-amber-50 text-amber-700 border-amber-100' 
                      : 'bg-green-50 text-green-700 border-green-100'
                  }`}
                >
                  <CheckCircle2 size={15} /> 
                  {selectedInvoice.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
                </button>
                <button 
                  onClick={handleEditInvoice} 
                  className="py-2.5 px-4 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Edit size={15} /> Edit
                </button>
                <button 
                  onClick={triggerPrint} 
                  className="py-2.5 px-4 bg-gray-50 border border-gray-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-gray-700 transition-all active:scale-95"
                >
                  <Printer size={15} /> Print/PDF
                </button>
                <button 
                  onClick={() => handleDeleteInvoice(selectedInvoice.id)} 
                  className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>

              {/* REALISTIC INVOICE PREVIEW CONTAINER */}
              <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 flex flex-col gap-6 text-xs text-gray-700 leading-relaxed shadow-inner print:bg-white print:border-none print:shadow-none print:p-0">
                
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b border-gray-150 pb-4">
                  <div>
                    <div className="text-xl font-extrabold text-gray-900 flex items-center gap-1.5">
                      {settings.logo && (settings.logo.startsWith('data:') || settings.logo.startsWith('http')) ? (
                        <img src={settings.logo} alt="Logo" className="h-8 w-auto object-contain rounded" />
                      ) : (
                        <span className="text-lg">{settings.logo || '🏢'}</span>
                      )}
                      <span>{businessName}</span>
                    </div>
                    {/* Seller details */}
                    <div className="mt-2 text-[10px] text-gray-400 flex flex-col gap-0.5">
                      {settings.address && <p>{settings.address}</p>}
                      {settings.phone && <p>Ph: {settings.phone}</p>}
                      {settings.email && <p>Em: {settings.email}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <h4 className="font-extrabold text-gray-800 text-[11px] uppercase tracking-widest">Invoice</h4>
                    <p className="font-mono text-gray-500 text-[10px] mt-0.5">{selectedInvoice.invoiceNumber}</p>
                    <div className="mt-2 text-[10px] text-gray-400 flex flex-col gap-0.5">
                      <p><span className="font-semibold">Issued:</span> {selectedInvoice.date}</p>
                      <p><span className="font-semibold">Due:</span> {selectedInvoice.dueDate}</p>
                    </div>
                  </div>
                </div>

                {/* Bill to */}
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Client / Billed To:</span>
                  <h4 className="font-black text-gray-800 text-xs mt-1">{selectedInvoice.clientName}</h4>
                  {selectedInvoice.clientEmail && <p className="text-gray-500 mt-0.5">{selectedInvoice.clientEmail}</p>}
                  {selectedInvoice.clientAddress && <p className="text-gray-400 whitespace-pre-line mt-1">{selectedInvoice.clientAddress}</p>}
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[8px] tracking-wider">
                        <th className="py-2">Item Description</th>
                        <th className="py-2 text-center w-12">Qty</th>
                        <th className="py-2 text-right w-20">Rate</th>
                        <th className="py-2 text-right w-20">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item, i) => (
                        <tr key={item.id || i} className="border-b border-gray-100">
                          <td className="py-3">
                            <p className="font-bold text-gray-800">{item.name}</p>
                            {item.description && <p className="text-gray-500 text-[10px] mt-1 whitespace-pre-wrap leading-relaxed max-w-sm">{item.description}</p>}
                          </td>
                          <td className="py-3 text-center text-gray-500">{item.quantity} {item.unit || ''}</td>
                          <td className="py-3 text-right text-gray-500">{formatCurrency(item.price)}</td>
                          <td className="py-3 text-right font-bold text-gray-800">{formatCurrency(item.quantity * item.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Section */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-t border-gray-150 pt-4 mt-2">
                  <div className="flex-1 flex flex-col gap-2">
                    {settings.paymentInstructions && (
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Payment Instructions:</span>
                        <p className="text-[10px] text-gray-500 whitespace-pre-line mt-0.5">{settings.paymentInstructions}</p>
                      </div>
                    )}
                    {selectedInvoice.notes && (
                      <div>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Notes:</span>
                        <p className="text-[10px] text-gray-400 italic mt-0.5">"{selectedInvoice.notes}"</p>
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-48 flex flex-col gap-1.5 self-end">
                    <div className="flex justify-between text-gray-500 text-[10px]">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedInvoice.items.reduce((acc, i) => acc + (i.quantity * i.price), 0))}</span>
                    </div>
                    {selectedInvoice.taxRate ? (
                      <div className="flex justify-between text-gray-500 text-[10px] border-b border-gray-100 pb-1.5">
                        <span>Tax ({selectedInvoice.taxRate}%):</span>
                        <span>{formatCurrency(selectedInvoice.items.reduce((acc, i) => acc + (i.quantity * i.price), 0) * (selectedInvoice.taxRate / 100))}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-black text-gray-900 text-xs border-t border-gray-150 pt-2 mt-1">
                      <span>Total Due:</span>
                      <span>{formatCurrency(selectedInvoice.total)}</span>
                    </div>
                  </div>
                </div>

              </div>

              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="print:hidden w-full py-3 bg-gray-900 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all shadow-md mt-2"
              >
                Close Preview
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL: INVOICE GENERATOR FORM (Hidden during print) */}
      <AnimatePresence>
        {isGenerating && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsGenerating(false)} 
              className="print:hidden fixed inset-0 bg-black/40 z-[80]" 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }} 
              className="print:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[90] p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl flex flex-col gap-5 text-gray-800"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-brand-600" /> New Invoice
                </h3>
                <button onClick={() => setIsGenerating(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitInvoice} className="flex flex-col gap-4">
                
                {/* Generation Mode Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice Source</label>
                  <div className="grid grid-cols-2 bg-gray-100/50 p-1 rounded-xl">
                    <button 
                      type="button" 
                      onClick={() => setGenMode('sales')} 
                      className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        genMode === 'sales' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <FileSpreadsheet size={14} /> Recorded Sales
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setGenMode('manual')} 
                      className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        genMode === 'manual' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <Edit size={14} /> Services Rendered / Custom
                    </button>
                  </div>
                </div>

                {/* Basic Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Invoice Number</label>
                    <input 
                      type="text" 
                      required 
                      value={invoiceNumber} 
                      onChange={(e) => setInvoiceNumber(e.target.value)} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Tax Rate (%)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      step="0.1" 
                      value={taxRate} 
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Client Details */}
                <div className="flex flex-col gap-3 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Client Information</span>
                  <div className="flex flex-col gap-1">
                    <input 
                      type="text" 
                      required 
                      value={clientName} 
                      onChange={(e) => setClientName(e.target.value)} 
                      placeholder="Client/Company Name *" 
                      className="bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <input 
                      type="email" 
                      value={clientEmail} 
                      onChange={(e) => setClientEmail(e.target.value)} 
                      placeholder="Client Email Address (optional)" 
                      className="bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <textarea 
                      value={clientAddress} 
                      onChange={(e) => setClientAddress(e.target.value)} 
                      placeholder="Client Physical/Billing Address (optional)" 
                      rows={2}
                      className="bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800 resize-none"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Issue Date</label>
                    <input 
                      type="date" 
                      required 
                      value={invoiceDate} 
                      onChange={(e) => setInvoiceDate(e.target.value)} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs text-gray-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Due Date</label>
                    <input 
                      type="date" 
                      required 
                      value={dueDate} 
                      onChange={(e) => setDueDate(e.target.value)} 
                      className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs text-gray-800"
                    />
                  </div>
                </div>

                {/* LINE ITEMS SECTION */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice Line Items</label>
                  
                  {/* GENERATOR MODE: SALES */}
                  {genMode === 'sales' && (
                    <div className="flex flex-col gap-2 border border-gray-100 rounded-2xl bg-gray-50/20 p-4 max-h-56 overflow-y-auto shadow-inner">
                      {salesLoading ? (
                        <div className="py-6 flex flex-col items-center justify-center text-xs text-gray-400 gap-2">
                          <Loader2 size={20} className="animate-spin text-brand-600" />
                          <span>Fetching recorded sales...</span>
                        </div>
                      ) : sales.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-400">
                          No sales recorded for this business yet.<br />
                          <button 
                            type="button" 
                            onClick={() => setGenMode('manual')}
                            className="text-brand-600 font-bold mt-2 hover:underline"
                          >
                            Switch to Manual Entry
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 text-xs">
                          <p className="text-[10px] text-gray-400 font-semibold mb-1">Select one or more sales items to add:</p>
                          {sales.map((sale) => {
                            const isChecked = selectedSaleIds.includes(sale.id);
                            return (
                              <div 
                                key={sale.id} 
                                onClick={() => toggleSaleSelection(sale.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                  isChecked 
                                    ? 'bg-brand-50/40 border-brand-200 shadow-sm' 
                                    : 'bg-white border-gray-100 hover:border-gray-200'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked} 
                                    onChange={() => {}} // toggled by parent div click
                                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                  />
                                  <div>
                                    <p className="font-bold text-gray-800">{sale.product_name || 'Generic Item'}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{sale.date} · Qty: {sale.quantity || 1}</p>
                                  </div>
                                </div>
                                <span className="font-black text-gray-900">{formatCurrency(sale.total_price || 0)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* GENERATOR MODE: MANUAL */}
                  {genMode === 'manual' && (
                    <div className="flex flex-col gap-2">
                      {manualItems.map((item, index) => (
                        <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                          <div className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              required 
                              placeholder="Item name / title" 
                              value={item.name} 
                              onChange={(e) => updateManualItem(item.id, 'name', e.target.value)} 
                              className="flex-1 bg-white border border-gray-150 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800"
                            />
                            <button 
                              type="button" 
                              disabled={manualItems.length === 1}
                              onClick={() => removeManualItem(item.id)}
                              className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 disabled:opacity-40 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <textarea 
                            placeholder="Description (optional)" 
                            value={item.description || ''} 
                            onChange={(e) => updateManualItem(item.id, 'description', e.target.value)} 
                            className="w-full bg-white border border-gray-150 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 resize-none h-16"
                          />
                          <div className="flex gap-2 items-center">
                            <input 
                              type="number" 
                              required 
                              min="1" 
                              placeholder="Qty" 
                              value={item.quantity} 
                              onChange={(e) => updateManualItem(item.id, 'quantity', parseInt(e.target.value) || 1)} 
                              className="w-16 bg-white border border-gray-150 rounded-xl px-2 py-2 text-xs font-bold text-gray-800 text-center"
                            />
                            <select 
                              value={item.unit || 'Units'} 
                              onChange={(e) => updateManualItem(item.id, 'unit', e.target.value)}
                              className="w-24 bg-white border border-gray-150 rounded-xl px-2 py-2 text-xs font-bold text-gray-800"
                            >
                              <option value="Units">Units</option>
                              <option value="Tons">Tons</option>
                              <option value="Kg">Kg</option>
                              <option value="Litres">Litres</option>
                              <option value="Hours">Hours</option>
                              <option value="Days">Days</option>
                              <option value="Months">Months</option>
                            </select>
                            <input 
                              type="number" 
                              required 
                              min="0" 
                              step="0.01" 
                              placeholder="Price" 
                              value={item.price || ''} 
                              onChange={(e) => updateManualItem(item.id, 'price', parseFloat(e.target.value) || 0)} 
                              className="flex-1 bg-white border border-gray-150 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 text-right"
                            />
                          </div>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={addManualItem}
                        className="py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-dashed border-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 text-gray-600 transition-all mt-1"
                      >
                        <Plus size={14} /> Add Line Item
                      </button>
                    </div>
                  )}
                </div>

                {/* Custom Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Notes / Payment Terms</label>
                  <input 
                    type="text" 
                    value={customNotes} 
                    onChange={(e) => setCustomNotes(e.target.value)} 
                    placeholder="e.g. Thank you for your business! Net 14 terms." 
                    className="bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800"
                  />
                </div>

                {/* Preview Summary and Submit */}
                <div className="bg-gray-900 text-white p-5 rounded-2xl flex flex-col gap-2 mt-2">
                  <div className="flex justify-between text-xs opacity-75">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(getGeneratingSubtotal())}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-xs opacity-75">
                      <span>Estimated Tax ({taxRate}%):</span>
                      <span>{formatCurrency(getGeneratingSubtotal() * (taxRate / 100))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t border-white/10 pt-2 mt-1">
                    <span>Total Due:</span>
                    <span>{formatCurrency(getGeneratingTotal())}</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all shadow-lg mt-2"
                >
                  Generate & Save Invoice
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL: BUSINESS SETTINGS CONFIGURATOR (Hidden during print) */}
      <AnimatePresence>
        {isConfiguringSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsConfiguringSettings(false)} 
              className="print:hidden fixed inset-0 bg-black/40 z-[80]" 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }} 
              className="print:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[90] p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto max-w-2xl mx-auto shadow-2xl flex flex-col gap-5 text-gray-800"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Store size={20} className="text-brand-600" /> Invoice Settings
                </h3>
                <button onClick={() => setIsConfiguringSettings(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
                <p className="text-xs text-gray-400 leading-relaxed">These details will automatically populate the header of generated invoices for <span className="font-bold text-gray-700">{businessName}</span>.</p>
                
                {/* Custom Logo Upload / Emoji Input Section */}
                <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Business Logo</span>
                  
                  <div className="flex gap-4 items-center">
                    {/* Visual Preview */}
                    <div className="w-16 h-16 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {settings.logo && (settings.logo.startsWith('data:') || settings.logo.startsWith('http')) ? (
                        <img src={settings.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-3xl">{settings.logo || '🏢'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-1.5">
                      <p className="text-[10px] text-gray-500 font-medium">Use a text emoji/symbol, or upload your official company logo file (Max 1MB).</p>
                      
                      <div className="flex gap-2 items-center">
                        <label className="cursor-pointer py-2 px-3 bg-white border border-gray-150 rounded-xl text-[10px] font-extrabold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 flex items-center gap-1.5">
                          <span>Upload Image File</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 1024 * 1024) {
                                  alert("Logo size should be less than 1MB to ensure smooth saving.");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setSettings({ ...settings, logo: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden" 
                          />
                        </label>
                        
                        {(settings.logo && (settings.logo.startsWith('data:') || settings.logo.startsWith('http'))) ? (
                          <button 
                            type="button"
                            onClick={() => setSettings({ ...settings, logo: '🏢' })}
                            className="py-2 px-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-bold hover:bg-red-100 transition-colors"
                          >
                            Reset to Default
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold">Or Emoji:</span>
                            <input 
                              type="text" 
                              maxLength={4}
                              value={settings.logo} 
                              onChange={(e) => setSettings({...settings, logo: e.target.value})} 
                              className="w-14 bg-white border border-gray-150 rounded-xl py-1 px-2 text-center text-sm font-bold text-gray-800 focus:border-brand-500"
                              placeholder="🏢"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Contact Phone</label>
                  <input 
                    type="tel" 
                    value={settings.phone} 
                    onChange={(e) => setSettings({...settings, phone: e.target.value})} 
                    className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Business Contact Email</label>
                  <input 
                    type="email" 
                    value={settings.email} 
                    onChange={(e) => setSettings({...settings, email: e.target.value})} 
                    className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800"
                    placeholder="billing@yourbusiness.com"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Physical Address</label>
                  <textarea 
                    value={settings.address} 
                    onChange={(e) => setSettings({...settings, address: e.target.value})} 
                    rows={3}
                    className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800 resize-none"
                    placeholder="123 Commerce St, Suite 400&#10;Metropolis, NY 10001"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">Bank / Transfer Instructions</label>
                  <textarea 
                    value={settings.paymentInstructions} 
                    onChange={(e) => setSettings({...settings, paymentInstructions: e.target.value})} 
                    rows={3}
                    className="bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800 resize-none"
                    placeholder="Bank: Chase Bank&#10;Account Number: 1234567890&#10;Routing: 021000021"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all shadow-lg mt-2"
                >
                  Save Business Info
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL: INCOMPLETE SETTINGS PROMPT */}
      <AnimatePresence>
        {showIncompleteSettingsModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowIncompleteSettingsModal(false)} 
              className="print:hidden fixed inset-0 bg-black/40 z-[100]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 50 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 50 }} 
              className="print:hidden fixed inset-x-4 bottom-10 md:bottom-auto md:top-1/2 md:-translate-y-1/2 bg-white rounded-3xl z-[110] p-6 max-h-[85vh] overflow-y-auto max-w-md mx-auto shadow-2xl flex flex-col gap-5 text-gray-800"
            >
              <div className="flex items-start gap-3.5 pb-2 border-b border-gray-100">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Incomplete Business Profile</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Please update your details to generate professional invoices.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Invoices require valid business details in the header so clients know who they are purchasing from and how to settle payments. Currently, the following fields are missing:
                </p>

                <div className="flex flex-col gap-2 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-600 flex items-center gap-1.5">
                      <span className="text-base">🏢</span> Business Logo:
                    </span>
                    {(!settings.logo || settings.logo === '🏢') ? (
                      <span className="text-amber-600 font-extrabold text-[10px] bg-amber-50 px-2 py-0.5 rounded">⚠️ Default / Missing</span>
                    ) : (
                      <span className="text-green-600 font-extrabold text-[10px] bg-green-50 px-2 py-0.5 rounded">✅ Configured</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="font-semibold text-gray-600 flex items-center gap-1.5">
                      📍 Physical Address:
                    </span>
                    {!settings.address?.trim() ? (
                      <span className="text-red-600 font-extrabold text-[10px] bg-red-50 px-2 py-0.5 rounded">❌ Missing</span>
                    ) : (
                      <span className="text-green-600 font-extrabold text-[10px] bg-green-50 px-2 py-0.5 rounded">✅ Configured</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="font-semibold text-gray-600 flex items-center gap-1.5">
                      📞 Phone Number:
                    </span>
                    {!settings.phone?.trim() ? (
                      <span className="text-red-600 font-extrabold text-[10px] bg-red-50 px-2 py-0.5 rounded">❌ Missing</span>
                    ) : (
                      <span className="text-green-600 font-extrabold text-[10px] bg-green-50 px-2 py-0.5 rounded">✅ Configured</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button 
                  onClick={() => {
                    setShowIncompleteSettingsModal(false);
                    setIsConfiguringSettings(true);
                  }}
                  className="w-full py-3.5 bg-brand-600 text-white font-extrabold rounded-xl text-xs shadow-md shadow-brand-500/10 hover:bg-brand-700 active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Settings size={15} /> Configure settings now
                </button>
                <button 
                  onClick={() => {
                    setShowIncompleteSettingsModal(false);
                    startGeneration();
                  }}
                  className="w-full py-3 text-gray-500 hover:text-gray-800 font-bold text-xs text-center hover:underline"
                >
                  Continue with incomplete profile anyway
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
