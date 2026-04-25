import React, { useEffect, useState } from 'react';
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { fetchTransactions } from '../services/db';
import { formatCurrency } from '../lib/currency';
import { isSameMonth } from 'date-fns';
import { BarChart3 } from 'lucide-react';

export default function Insights() {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
       fetchTransactions(user.uid).then(t => {
         setTransactions(t || []);
         setLoading(false);
       });
    }
  }, [user]);

  const currencyCode = userProfile?.currency || 'USD';
  
  const currentMonthTx = transactions.filter(t => {
    try {
      return t.date ? isSameMonth(new Date(t.date), new Date()) : false;
    } catch {
      return false;
    }
  });

  const expenseTxs = currentMonthTx.filter(t => t.type === 'expense');
  const totalExpense = expenseTxs.reduce((acc, t) => acc + t.amount, 0);

  // Group by category
  const expensesByCategory = expenseTxs.reduce((acc, t) => {
    const cat = t.category.toLowerCase();
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const predefinedColors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

  const chartData = Object.entries(expensesByCategory).map(([name, value], idx) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: value as number,
    color: predefinedColors[idx % predefinedColors.length]
  })).sort((a, b) => (b.value as number) - (a.value as number));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-8 px-4 pt-12 tracking-tight">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 px-1 flex items-center gap-2 pr-12">
         <BarChart3 className="text-brand-600" />
         Analysis & Insights
      </h1>
      
      {loading ? (
         <div className="flex items-center justify-center p-12 text-gray-400">Loading analysis...</div>
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center mb-6">
          <h2 className="text-gray-500 font-medium text-sm mb-2">Total Monthly Spend</h2>
          <div className="text-3xl font-bold text-gray-900 mb-8">{formatCurrency(totalExpense, currencyCode)}</div>
          
          {chartData.length > 0 ? (
             <div className="w-full h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(val: number) => formatCurrency(val, currencyCode)} />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-sm font-semibold text-gray-400">Month</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
                No expense data this month.
            </div>
          )}
          
          <div className="w-full mt-6 space-y-3">
            {chartData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(item.value, currencyCode)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-2">
        <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">Spending Patterns</h3>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
           <p className="text-sm text-gray-600 leading-relaxed">
             {chartData.length > 0 ? `You've spent the most on ${chartData[0].name} (${Math.round((chartData[0].value as number) / totalExpense * 100)}% of your expenses) this month. Keep an eye on it to ensure you stay within your budget.` : "We need more data to analyze your spending patterns."}
           </p>
        </div>
      </div>
    </div>
  );
}
