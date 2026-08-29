import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, Check, X, Tag, FileDigit } from 'lucide-react';
import * as xlsx from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
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

const parseTextRegex = (text: string): ParsedTransaction[] => {
  const lines = text.split("\n");

  const transactions = lines.map(line => {
    // Look for common currency amounts
    const amountMatch = line.match(/(?:[$£€₦]|NGN|USD)?\s?[\d,]+\.\d{2}|\b(?:[$£€₦]|NGN|USD)?\s?[\d,]+/);
    const dateMatch = line.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/);

    const amountStr = amountMatch ? amountMatch[0].replace(/[^0-9.]/g, '') : null;
    const amount = amountStr ? parseFloat(amountStr) : null;

    if (!amount) return null;

    const lowerLine = line.toLowerCase();
    const type = (lowerLine.includes("debit") || lowerLine.includes("dr ") || line.includes("-")) ? "expense" 
               : (lowerLine.includes("credit") || lowerLine.includes("cr ") || lowerLine.includes("deposit")) ? "income" 
               : "expense"; // default to expense if unknown

    let desc = line;
    if (amountMatch) desc = desc.replace(amountMatch[0], "");
    if (dateMatch) desc = desc.replace(dateMatch[0], "");
    
    // Cleanup description
    desc = desc.replace(/debit|credit|dr\b|cr\b/gi, '').trim().replace(/^[^a-zA-Z0-9]+/, '');

    return {
      amount: amount,
      date: dateMatch ? dateMatch[0].replace(/\//g, '-') : new Date().toISOString().split('T')[0],
      type: type as 'income' | 'expense',
      category: 'Uncategorized', 
      note: desc.substring(0, 50).trim() || 'Imported Transaction',
      selected: true
    };
  }).filter(t => t !== null) as ParsedTransaction[];

  return transactions;
};

const parseDataHeuristically = (data: any[]): ParsedTransaction[] => {
  if (data.length === 0) return [];

  // Find columns heuristically
  const firstRow = data[data.length > 1 ? 1 : 0]; 
  
  const availableKeys = new Set<string>();
  data.slice(0, 5).forEach(row => Object.keys(row).forEach(k => availableKeys.add(k)));
  const keys = Array.from(availableKeys);
  
  let dateKey = '', amountKey = '', debitKey = '', creditKey = '', noteKey = '', catKey = '';
  
  keys.forEach(k => {
    const lower = k.toLowerCase().replace(/[^a-z]/g, ''); 
    if (!dateKey && (lower.includes('date') || lower.includes('time'))) dateKey = k;
    else if (!amountKey && (lower.includes('amount') || lower.includes('value'))) amountKey = k;
    else if (!debitKey && (lower.includes('debit') || lower.includes('out') || lower.includes('withdrawal'))) debitKey = k;
    else if (!creditKey && (lower.includes('credit') || lower.includes('in') || lower.includes('deposit'))) creditKey = k;
    else if (!noteKey && (lower.includes('desc') || lower.includes('memo') || lower.includes('payee') || lower.includes('name') || lower.includes('particulars'))) noteKey = k;
    else if (!catKey && (lower.includes('category') || lower.includes('type'))) catKey = k;
  });

  const parsed: ParsedTransaction[] = [];
  
  data.forEach(row => {
     if (!row[noteKey] && !row[amountKey] && !row[debitKey] && !row[creditKey]) return;
     
     let txType: 'income' | 'expense' | 'debt' = 'expense';
     let amount = 0;
     
     if (amountKey && row[amountKey] !== undefined && row[amountKey] !== '') {
        const valStr = row[amountKey].toString();
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
     
     if (amount === 0) return; 
     
     let date = new Date().toISOString().split('T')[0];
     if (dateKey && row[dateKey]) {
        const dateStr = row[dateKey].toString();
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
           date = d.toISOString().split('T')[0];
        } else {
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
  const { isPremium, aiTokens, showPaywall, refreshAITokens } = usePremium();
  const [activeMode, setActiveMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
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
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const parseInput = async () => {
    if (activeMode === 'text') {
      if (!rawText.trim()) return;
      setLoading(true);
      setError('');
      try {
        // Try regex first for simple text blocks
        let parsed = parseTextRegex(rawText);
        
        // If regex fails or parses poorly, use AI as fallback if we wanted to...
        // But the prompt wants us to use their cue for robustness. So regex rules directly!
        if (parsed.length === 0) {
            // Check limits for fallback AI OCR calls
            if (!isPremium && aiTokens <= 0) {
               showPaywall('Continuous AI Services');
               throw new Error("Welcome Pack token limit reached. Please upgrade to Pro for unlimited AI transaction parsing.");
            }

            // Enhanced AI Prompt for raw text
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/gemini/generate`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  userId: userProfile?.id,
                  isPremium,
                  contents: { parts: [{ text: `Parse these transactions. Look for DEBIT/CREDIT indicators, amounts, and dates:\n\n${rawText}` }] },
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          type: { type: "STRING", description: "'income', 'expense', or 'debt'" },
                          amount: { type: "NUMBER" },
                          category: { type: "STRING" },
                          note: { type: "STRING" },
                          date: { type: "STRING" },
                        }, required: ["type", "amount", "category", "note", "date"]
                      }
                    }
                  }
               })
             });
             const data = await res.json();
             if (!res.ok) {
               if (data.error === 'token_limit_reached') {
                  showPaywall('Continuous AI Services');
                  throw new Error(data.message);
               }
               throw new Error(data.error);
             }
             parsed = JSON.parse(data.text || "[]");
             refreshAITokens();
        }
        
        if (parsed.length === 0) throw new Error("Could not detect any transactions in the text.");
        
        setParsedTxs(parsed.map(p => ({
            ...p,
            type: ['income', 'expense', 'debt'].includes(p.type) ? p.type : 'expense',
            amount: Math.abs(Number(p.amount) || 0),
            selected: true
        })));
      } catch (err: any) {
        if (err.message?.includes('API Key') || err.message?.includes('API_KEY_INVALID')) {
           setError("Configuration Error: " + err.message);
        } else if (err.message?.includes('high demand')) {
           setError(err.message);
        } else {
           setError(err.message || "Failed to parse text. Please try again.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!file) return;
    if (!isPremium) {
      showPaywall('Smart Camera OCR Scanner');
      setError('Document and Image OCR parsing is a premium feature. Please upgrade to a paid plan to continue.');
      return;
    }
    setLoading(true);
    setError('');

    try {
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
        
        let parsed: ParsedTransaction[] = [];
        
        // If it's an image, let's try offline OCR first for robustness
        if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
            try {
                // We do a dynamic import so Tesseract doesn't block initial load
                const Tesseract = await import('tesseract.js');
                const tesseractResult = await Tesseract.recognize(file, 'eng');
                const ocrText = tesseractResult.data.text;
                
                if (ocrText && ocrText.trim()) {
                   // Run through our robust text regex parser
                   parsed = parseTextRegex(ocrText);
                }
            } catch (ocrErr) {
                console.warn('OCR fallback failed', ocrErr);
            }
        }
        
        // If OCR didn't work or found no transactions, or if it's a PDF, fall back to AI
        if (parsed.length === 0) {
            // Check limits for fallback AI OCR calls
            if (!isPremium && aiTokens <= 0) {
               showPaywall('Continuous AI Services');
               throw new Error("Welcome Pack token limit reached. Please upgrade to Pro for unlimited AI receipt & document importing.");
            }

            contentParts.push({ text: "Extract all transaction records from this statement. Look for indicators such as 'DEBIT', 'CREDIT', amounts, and dates. Apply regex patterns to identify them. Categorize each transaction appropriately. The output must be JSON matching the schema." });
    
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/gemini/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: userProfile?.id,
                isPremium,
                contents: { parts: contentParts },
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        type: { type: "STRING", description: "MUST be exactly 'income', 'expense', or 'debt'" },
                        amount: { type: "NUMBER", description: "Absolute amount value" },
                        category: { type: "STRING", description: "Short, general category name (e.g. Salary, Utilities, Food)" },
                        note: { type: "STRING", description: "Original transaction description" },
                        date: { type: "STRING", description: "Date of transaction in YYYY-MM-DD format" },
                      },
                      required: ["type", "amount", "category", "note", "date"]
                    }
                  }
                }
              })
            });
            const data = await res.json();
            if (!res.ok) {
               if (data.error === 'token_limit_reached') {
                  showPaywall('Continuous AI Services');
                  throw new Error(data.message);
               }
               throw new Error(data.error);
            }
    
            const responseText = data.text || "[]";
            parsed = JSON.parse(responseText.trim());
            
            parsed = parsed.map((p: any) => ({
               ...p,
               type: ['income', 'expense', 'debt'].includes(p.type) ? p.type : 'expense',
               amount: Math.abs(Number(p.amount) || 0),
               selected: true
            }));

            refreshAITokens();
        }

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
      } else if (['txt'].includes(extension || '')) {
         const text = await file.text();
         const parsedLocal = parseTextRegex(text);
         if (parsedLocal.length === 0) throw new Error("Could not detect transactions from text.");
         setParsedTxs(parsedLocal);
      } else {
         throw new Error('Unsupported file type. Please upload JPEG, PNG, PDF, Excel, CSV, or TXT.');
      }

      setFile(null); 

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('API Key') || err.message?.includes('API_KEY_INVALID')) {
        setError("Configuration Error: " + err.message);
      } else if (err.message?.includes('high demand')) {
        setError(err.message);
      } else {
        setError(err.message || 'Failed to parse file. Please try again.');
      }
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
    if (toSubmit.length === 0 || !userProfile?.id) return;
    
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
    <div className="flex flex-col tracking-tight pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pr-12">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-700 shadow-sm transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Scan Bank Alert</h1>
        <div className="w-4"></div>
      </div>

      {parsedTxs.length === 0 ? (
        <div className="flex flex-col items-center pb-24">
           {/* Mode Tabs */}
           <div className="bg-white p-1 rounded-2xl flex items-center shadow-sm border border-gray-100 mb-8 relative w-full h-[52px]">
               <div 
                   className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-brand-50 rounded-xl transition-all duration-300 ease-out border border-brand-100 ${activeMode === 'text' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`} 
               />
               <button 
                   onClick={() => setActiveMode('file')}
                   className={`flex-1 flex items-center justify-center gap-2 h-full text-sm font-bold z-10 transition-colors ${activeMode === 'file' ? 'text-brand-700' : 'text-gray-500 hover:text-gray-900'}`}
               >
                   <UploadCloud size={16} /> File Upload
               </button>
               <button 
                   onClick={() => setActiveMode('text')}
                   className={`flex-1 flex items-center justify-center gap-2 h-full text-sm font-bold z-10 transition-colors ${activeMode === 'text' ? 'text-brand-700' : 'text-gray-500 hover:text-gray-900'}`}
               >
                   <FileDigit size={16} /> Paste Text/SMS
               </button>
           </div>

           {activeMode === 'file' ? (
             <div className="bg-brand-50 border-2 border-brand-200 border-dashed rounded-3xl w-full p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 mb-4">
                   <UploadCloud size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Bank Screenshot</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-xs">Upload a screenshot of your bank transactions, alert, or statement. Our AI will automatically pull out credits/debits.</p>
                
                <label className="bg-brand-600 text-white font-bold py-3 px-6 rounded-xl cursor-pointer hover:bg-brand-700 transition-colors shadow-sm">
                  Choose Image or File
                  <input 
                    type="file" 
                    accept=".jpg,.jpeg,.png,.pdf,.xls,.xlsx,.csv,.txt" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </label>
             </div>
           ) : (
             <div className="w-full">
                <textarea 
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste bank SMS, transaction alerts, or OCR text here...

e.g. TRANSFER CREDIT N15,000
POS DEBIT -₦3,200
2024-01-12
REF: 938293882
DESCRIPTION: SPAR LAGOS"
                  className="w-full min-h-[250px] bg-white border border-gray-200 rounded-3xl p-6 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono"
                />
             </div>
           )}
           
           {file && activeMode === 'file' && (
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
             onClick={parseInput}
             disabled={(activeMode === 'file' ? !file : !rawText) || loading}
             className="w-full mt-8 py-4 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
           >
             {loading ? 'Analyzing with Parsing Engine...' : 'Extract Transactions'}
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
                       <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{tx.date}</span>
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

           <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 shadow-lg z-50">
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
