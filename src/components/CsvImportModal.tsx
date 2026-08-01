import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { addTransaction } from '../services/db';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface ParsedTransaction {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  category: string;
  selected: boolean;
}

const COMMON_CATEGORIES = [
  'Housing', 'Food', 'Transportation', 'Utilities', 'Insurance', 'Healthcare', 'Debt', 'Personal', 'Savings', 'Entertainment', 'Other', 'Salary', 'Business', 'Investment'
];

function suggestCategory(description: string, type: 'income' | 'expense'): string {
  const lowerDesc = description.toLowerCase();
  
  if (type === 'income') {
    if (lowerDesc.includes('salary') || lowerDesc.includes('payroll')) return 'Salary';
    if (lowerDesc.includes('interest') || lowerDesc.includes('dividend')) return 'Investment';
    return 'Income';
  } else {
    if (lowerDesc.includes('grocery') || lowerDesc.includes('food') || lowerDesc.includes('restaurant') || lowerDesc.includes('cafe')) return 'Food';
    if (lowerDesc.includes('uber') || lowerDesc.includes('lyft') || lowerDesc.includes('gas') || lowerDesc.includes('fuel')) return 'Transportation';
    if (lowerDesc.includes('rent') || lowerDesc.includes('mortgage')) return 'Housing';
    if (lowerDesc.includes('electric') || lowerDesc.includes('water') || lowerDesc.includes('utility')) return 'Utilities';
    if (lowerDesc.includes('health') || lowerDesc.includes('pharmacy') || lowerDesc.includes('clinic')) return 'Healthcare';
    return 'Other';
  }
}

export default function CsvImportModal({ isOpen, onClose, onImportSuccess }: CsvImportModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions: ParsedTransaction[] = results.data.map((row: any) => {
            // Very basic heuristic for parsing standard bank CSVs
            // Usually has Date, Amount, Description/Payee
            const date = row['Date'] || row['date'] || row['Transaction Date'] || new Date().toISOString().split('T')[0];
            const amountStr = row['Amount'] || row['amount'] || row['Value'] || '0';
            const rawAmount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));
            
            const type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense';
            const amount = Math.abs(rawAmount);
            const description = row['Description'] || row['description'] || row['Payee'] || row['Name'] || 'Unknown Transaction';
            
            return {
              date: date.substring(0, 10),
              amount,
              type,
              description,
              category: suggestCategory(description, type),
              selected: true
            };
          }).filter(t => t.amount > 0);
          
          if (transactions.length === 0) {
            setError("No valid transactions found in the CSV. Please ensure it has Date, Amount, and Description columns.");
            return;
          }
          
          setParsedData(transactions);
          setStep('preview');
        } catch (err: any) {
          setError("Failed to parse CSV. Please check the format.");
        }
      },
      error: (error) => {
        setError("Error reading file: " + error.message);
      }
    });
  };

  const handleImport = async () => {
    if (!user) return;
    
    setStep('importing');
    try {
      const selectedTxs = parsedData.filter(t => t.selected);
      
      for (const tx of selectedTxs) {
        await addTransaction({
          amount: tx.amount,
          category: tx.category,
          note: tx.description,
          date: tx.date,
          type: tx.type
        });
      }
      
      setStep('success');
    } catch (err: any) {
      setError("Failed to import transactions.");
      setStep('preview');
    }
  };

  const toggleSelection = (index: number) => {
    const newData = [...parsedData];
    newData[index].selected = !newData[index].selected;
    setParsedData(newData);
  };
  
  const updateCategory = (index: number, category: string) => {
    const newData = [...parsedData];
    newData[index].category = category;
    setParsedData(newData);
  };

  const reset = () => {
    setStep('upload');
    setParsedData([]);
    setError(null);
  };

  const closeAndReset = () => {
    if (step === 'success') {
      onImportSuccess();
    }
    reset();
    onClose();
  };

  const selectedCount = parsedData.filter(t => t.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Import from CSV</h2>
          <button onClick={closeAndReset} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 mb-6 border border-red-100">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
              <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Bank Statement</h3>
              <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
                Upload your CSV file with transactions. We expect columns for Date, Amount, and Description.
              </p>
              
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <Upload size={18} />
                Select CSV File
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col h-full">
              <p className="text-sm text-gray-500 mb-4 font-medium">
                Found {parsedData.length} transactions. We've auto-categorized them for you. Review and edit before importing.
              </p>
              
              <div className="flex-1 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedCount === parsedData.length && parsedData.length > 0}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setParsedData(parsedData.map(t => ({...t, selected: checked})));
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                      </th>
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold">Description</th>
                      <th className="p-3 font-bold text-right">Amount</th>
                      <th className="p-3 font-bold">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((tx, idx) => (
                      <tr key={idx} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${!tx.selected ? 'opacity-50' : ''}`}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={tx.selected}
                            onChange={() => toggleSelection(idx)}
                            className="rounded text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <td className="p-3 text-gray-600">{tx.date}</td>
                        <td className="p-3 font-medium text-gray-900 truncate max-w-[200px]" title={tx.description}>
                          {tx.description}
                        </td>
                        <td className={`p-3 text-right font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {tx.type === 'income' ? '+' : '-'}{tx.amount.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <select 
                            value={tx.category}
                            onChange={(e) => updateCategory(idx, e.target.value)}
                            disabled={!tx.selected}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            {COMMON_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
              <h3 className="text-lg font-bold text-gray-900">Importing transactions...</h3>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Import Successful!</h3>
              <p className="text-gray-500 mb-8 max-w-sm">
                Successfully imported {selectedCount} transactions to your history.
              </p>
              <button 
                onClick={closeAndReset}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-sm"
              >
                View Transactions
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-600">
              {selectedCount} selected
            </span>
            <div className="flex gap-3">
              <button 
                onClick={reset}
                className="px-6 py-2.5 font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="px-6 py-2.5 font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-50"
              >
                Import Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
