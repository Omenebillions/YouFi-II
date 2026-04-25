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
          
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="add" element={<AddTransaction />} />
            <Route path="auto-import" element={<AutoImport />} />
            <Route path="coach" element={<Coach />} />
            <Route path="insights" element={<Insights />} />
            <Route path="goals" element={<Goals />} />
            <Route path="profile" element={<Profile />} />
            <Route path="history/:type" element={<HistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
