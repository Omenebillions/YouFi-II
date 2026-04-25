import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, Check, X, Tag } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import * as xlsx from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { addTransaction } from '../services/db';
import { formatCurrency } from '../lib/currency';

interface ParsedTransaction {
  type: 'income' | 'expense' | 'debt';
  amount: number;
  category: string;
  note: string;
  date: string;
  selected?: boolean;
}

const parseDataHeuristically = (data: any[]): ParsedTransaction[] => {
  if (data.length === 0) return [];

  // Find columns heuristically
  const firstRow = data[data.length > 1 ? 1 : 0]; // look at second row if exists as first might be weird, but let's check all keys across first few rows
  
  // Aggregate all keys from the first 5 rows to handle missing keys in the first row
  const availableKeys = new Set<string>();
  data.slice(0, 5).forEach(row => Object.keys(row).forEach(k => availableKeys.add(k)));
  const keys = Array.from(availableKeys);
  
  let dateKey = '', amountKey = '', debitKey = '', creditKey = '', noteKey = '', catKey = '';
  
  keys.forEach(k => {
    const lower = k.toLowerCase().replace(/[^a-z]/g, ''); // strip spaces/symbols for simpler matching
    if (!dateKey && (lower.includes('date') || lower.includes('time'))) dateKey = k;
    else if (!amountKey && (lower.includes('amount') || lower.includes('value'))) amountKey = k;
    else if (!debitKey && (lower.includes('debit') || lower.includes('out') || lower.includes('withdrawal'))) debitKey = k;
    else if (!creditKey && (lower.includes('credit') || lower.includes('in') || lower.includes('deposit'))) creditKey = k;
    else if (!noteKey && (lower.includes('desc') || lower.includes('memo') || lower.includes('payee') || lower.includes('name') || lower.includes('particulars'))) noteKey = k;
    else if (!catKey && (lower.includes('category') || lower.includes('type'))) catKey = k;
  });

  const parsed: ParsedTransaction[] = [];
  
  data.forEach(row => {
     // If we don't have note and amount, skip this row
     if (!row[noteKey] && !row[amountKey] && !row[debitKey] && !row[creditKey]) return;
     
     let txType: 'income' | 'expense' | 'debt' = 'expense';
     let amount = 0;
     
     if (amountKey && row[amountKey] !== undefined && row[amountKey] !== '') {
        const valStr = row[amountKey].toString();
        // Simple heuristic: negative amount = expense, positive = income 
        // This is not always true for all bank statements, but it works for many standard formats
        const val = parseFloat(valStr.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(val)) {
           amount = Math.abs(val);
           txType = val < 0 ? 'expense' : 'income';
        }
     } else if (debitKey && row[debitKey] !== undefined && row[debitKey] !== '') {
        const val = parseFloat(row[debitKey].toString().replace(/[^0-9.-]+/g, ""));
        if (!isNaN(val)) {
           amount = Math.abs(val);
           txType = 'expense';
        }
     } else if (creditKey && row[creditKey] !== undefined && row[creditKey] !== '') {
        const val = parseFloat(row[creditKey].toString().replace(/[^0-9.-]+/g, ""));
        if (!isNaN(val)) {
           amount = Math.abs(val);
           txType = 'income';
        }
     }
     
     if (amount === 0) return; // skip zero amounts
     
     let date = new Date().toISOString().split('T')[0];
     if (dateKey && row[dateKey]) {
        // Many excel date parsing might give numbers or strings. We use a simple strategy here.
        const dateStr = row[dateKey].toString();
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
           date = d.toISOString().split('T')[0];
        } else {
           // Fallback to original string if Date() fails but string seems like a date
           date = dateStr.substring(0, 10);
        }
     }
     
     const note = row[noteKey] ? row[noteKey].toString().trim() : 'Unknown Transaction';
     const category = row[catKey] ? row[catKey].toString().trim() : 'Uncategorized';
     
     parsed.push({
        type: txType,
        amount,
        note,
        category,
        date,
        selected: true
     });
  });
  
  return parsed;
};

export default function AutoImport() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedTxs, setParsedTxs] = useState<ParsedTransaction[]>([]);
  
  const currencyCode = userProfile?.currency || 'USD';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const parseFile = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured.');
      }
      
      const ai = new GoogleGenAI({ apiKey });

      let contentParts: any[] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (['jpg', 'jpeg', 'png', 'pdf'].includes(extension || '')) {
        const base64 = await fileToBase64(file);
        let mimeType = file.type;
        if (!mimeType) {
           if (extension === 'pdf') mimeType = 'application/pdf';
           else if (extension === 'png') mimeType = 'image/png';
           else mimeType = 'image/jpeg';
        }

        contentParts = [{
          inlineData: {
            mimeType,
            data: base64
          }
        }];
        
        contentParts.push({ text: "Extract all transaction records from this statement. Categorize each transaction appropriately. The output must be JSON matching the schema." });

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts: contentParts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "MUST be exactly 'income', 'expense', or 'debt'" },
                  amount: { type: Type.NUMBER, description: "Absolute amount value" },
                  category: { type: Type.STRING, description: "Short, general category name (e.g. Salary, Utilities, Food)" },
                  note: { type: Type.STRING, description: "Original transaction description" },
                  date: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format" },
                },
                required: ["type", "amount", "category", "note", "date"]
              }
            }
          }
        });

        const responseText = response.text || "[]";
        let parsed = JSON.parse(responseText.trim());
        
        // Validation & Cleanup
        parsed = parsed.map((p: any) => ({
           ...p,
           type: ['income', 'expense', 'debt'].includes(p.type) ? p.type : 'expense',
           amount: Math.abs(Number(p.amount) || 0),
           selected: true
        }));

        setParsedTxs(parsed);

      } else if (['xls', 'xlsx', 'csv'].includes(extension || '')) {
         const arrayBuffer = await file.arrayBuffer();
         const workbook = xlsx.read(arrayBuffer, { type: 'array' });
         const firstSheetName = workbook.SheetNames[0];
         const worksheet = workbook.Sheets[firstSheetName];
         const json = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
         
         const parsedLocal = parseDataHeuristically(json);
         if (parsedLocal.length === 0) {
            throw new Error("Could not detect tabular transaction data.");
         }
         
         setParsedTxs(parsedLocal);
      } else {
         throw new Error('Unsupported file type. Please upload JPEG, PNG, PDF, or Excel/CSV.');
      }

      setFile(null); // Clear file after successful parse

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to parse file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
    const next = [...parsedTxs];
    next[index].selected = !next[index].selected;
    setParsedTxs(next);
  };
  
  const handleAmountChange = (index: number, val: string) => {
    const next = [...parsedTxs];
    next[index].amount = parseFloat(val) || 0;
    setParsedTxs(next);
  };
  
  const handleCategoryChange = (index: number, val: string) => {
    const next = [...parsedTxs];
    next[index].category = val;
    setParsedTxs(next);
  };

  const submitTransactions = async () => {
    const toSubmit = parsedTxs.filter(t => t.selected);
    if (toSubmit.length === 0) return;
    
    setLoading(true);
    try {
      for (const tx of toSubmit) {
         await addTransaction({
            type: tx.type,
            amount: tx.amount,
            category: tx.category.toLowerCase(),
            note: tx.note,
            date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString()
         });
      }
      navigate('/');
    } catch (err: any) {
       console.error(err);
       setError("Failed to save transactions.");
       setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fc] pb-8 tracking-tight px-6 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Auto Import</h1>
        <div className="w-4"></div>
      </div>

      {parsedTxs.length === 0 ? (
        <div className="flex flex-col items-center">
           <div className="bg-brand-50 border-2 border-brand-200 border-dashed rounded-3xl w-full p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 mb-4">
                 <UploadCloud size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Statement</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-xs">We support JPEG, PNG, PDF, and Excel files. Our AI will automatically extract your transactions.</p>
              
              <label className="bg-brand-600 text-white font-bold py-3 px-6 rounded-xl cursor-pointer hover:bg-brand-700 transition-colors shadow-sm">
                Choose File
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.pdf,.xls,.xlsx,.csv" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>
           </div>
           
           {file && (
             <div className="w-full mt-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="text-gray-400" size={24} />
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg">
                  <X size={16} />
                </button>
             </div>
           )}

           {error && <p className="mt-4 text-sm font-medium text-red-500 bg-red-50 p-3 rounded-lg w-full">{error}</p>}
           
           <button
             onClick={parseFile}
             disabled={!file || loading}
             className="w-full mt-8 py-4 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
           >
             {loading ? 'Analyzing with AI...' : 'Analyze Document'}
           </button>
        </div>
      ) : (
        <div className="flex flex-col">
           <div className="flex items-center justify-between mb-4 px-1">
             <h2 className="text-lg font-bold text-gray-900">Review Transactions</h2>
             <span className="text-xs font-semibold text-gray-500">{parsedTxs.filter(t => t.selected).length} selected</span>
           </div>
           
           <div className="flex flex-col gap-4 pb-24">
             {parsedTxs.map((tx, idx) => (
               <div key={idx} className={`bg-white p-4 rounded-2xl shadow-sm border ${tx.selected ? 'border-brand-500' : 'border-gray-100'} transition-colors relative`}>
                  <button 
                    onClick={() => toggleSelection(idx)}
                    className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center border ${tx.selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-gray-50 border-gray-300 text-transparent'}`}
                  >
                    <Check size={14} />
                  </button>
                  
                  <div className={`transition-opacity ${tx.selected ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex gap-2 items-center mb-3 pr-8">
                       <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-700' : tx.type === 'debt' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                         {tx.type}
                       </span>
                       <span className="text-xs text-gray-400 font-medium">{tx.date}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                       <div>
                         <label className="text-[10px] font-semibold text-gray-400 uppercase">Amount</label>
                         <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500 font-medium">{currencyCode === 'USD' ? '$' : currencyCode}</span>
                            <input 
                              type="number"
                              value={tx.amount}
                              onChange={(e) => handleAmountChange(idx, e.target.value)}
                              className="w-full bg-gray-50 border-none rounded-lg p-2 pl-12 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-brand-500"
                            />
                         </div>
                       </div>
                       
                       <div>
                         <label className="text-[10px] font-semibold text-gray-400 uppercase">Category</label>
                         <input 
                            type="text"
                            value={tx.category}
                            onChange={(e) => handleCategoryChange(idx, e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-lg p-2 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-brand-500 capitalize"
                         />
                       </div>
                       
                       <div>
                         <p className="text-xs text-gray-600 italic mt-1 leading-tight line-clamp-2">"{tx.note}"</p>
                       </div>
                    </div>
                  </div>
               </div>
             ))}
           </div>

           <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 shadow-lg">
             <button
               onClick={submitTransactions}
               disabled={parsedTxs.filter(t => t.selected).length === 0 || loading}
               className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold disabled:opacity-50 transition-all active:scale-95 shadow-md flex items-center justify-center"
             >
               {loading ? 'Saving...' : `Import ${parsedTxs.filter(t => t.selected).length} Records`}
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
