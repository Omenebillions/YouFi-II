/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import Coach from './pages/Coach';
import Insights from './pages/Insights';
import Goals from './pages/Goals';
import Profile from './pages/Profile';
import HistoryPage from './pages/HistoryPage';
import AutoImport from './pages/AutoImport';
import BusinessList from './pages/BusinessList';
import BusinessDashboard from './pages/BusinessDashboard';
import BusinessProductList from './pages/BusinessProductList';
import BusinessSaleList from './pages/BusinessSaleList';
import BusinessTransactionList from './pages/BusinessTransactionList';
import BusinessDebtList from './pages/BusinessDebtList';
import BusinessCoach from './pages/BusinessCoach';
import UpcomingPayments from './pages/UpcomingPayments';
import TrashBin from './pages/TrashBin';

import BusinessIdeas from './pages/BusinessIdeas';
import AuthCallback from './pages/AuthCallback';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="add" element={<AddTransaction />} />
            <Route path="auto-import" element={<AutoImport />} />
            <Route path="coach" element={<Coach />} />
            <Route path="insights" element={<Insights />} />
            <Route path="goals" element={<Goals />} />
            <Route path="profile" element={<Profile />} />
            <Route path="history/:type" element={<HistoryPage />} />
            <Route path="business" element={<BusinessList />} />
            <Route path="business-ideas" element={<BusinessIdeas />} />
            <Route path="business/:businessId" element={<BusinessDashboard />} />
            <Route path="business/:businessId/products" element={<BusinessProductList />} />
            <Route path="business/:businessId/sales" element={<BusinessSaleList />} />
            <Route path="business/:businessId/transactions/:type" element={<BusinessTransactionList />} />
            <Route path="business/:businessId/debts" element={<BusinessDebtList />} />
            <Route path="business/:businessId/coach" element={<BusinessCoach />} />
            <Route path="upcoming-payments" element={<UpcomingPayments />} />
            <Route path="trash" element={<TrashBin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
