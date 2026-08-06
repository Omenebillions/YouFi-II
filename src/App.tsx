/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PremiumProvider } from './contexts/PremiumContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { useNativeBridge } from './hooks/useNativeBridge';
import { supabase } from './services/supabase';
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
import BusinessGoals from './pages/BusinessGoals';
import LivingExpenses from './pages/LivingExpenses';
import ExpensesPlanner from './pages/ExpensesPlanner';
import UpcomingPayments from './pages/UpcomingPayments';
import BusinessUpcomingPayments from './pages/BusinessUpcomingPayments';
import TrashBin from './pages/TrashBin';

import BusinessIdeas from './pages/BusinessIdeas';
import AuthCallback from './pages/AuthCallback';
import Pricing from './pages/Pricing';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';

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

function AppInitializer() {
  const { user } = useAuth();
  const { bridge } = useNativeBridge();
  const { fetchNotifications } = useNotifications();

  useEffect(() => {
    if (bridge?.onNotificationReceived) {
      bridge.onNotificationReceived((notification: any) => {
        if (notification) {
          console.log('[Native App Notification]: Received in foreground', notification);
          // Auto refresh values
          fetchNotifications();
        }
      });
    }
  }, [bridge, fetchNotifications]);

  useEffect(() => {
    const registerToken = async () => {
      if (bridge?.getPushToken && user) {
        try {
          const token = await bridge.getPushToken();
          if (token) {
            await supabase.from('push_tokens').upsert({
              user_id: user.id,
              token,
              updated_at: new Date().toISOString(),
            });
            console.log('[Native App Push Token]: Registered', token);
          }
        } catch (error) {
          console.error('[Native App Push Token]: Error during registration (safe backup):', error);
        }
      }
    };
    registerToken();
  }, [user, bridge]);

  return null;
}



import { PrivacyProvider } from './contexts/PrivacyContext';

import { UIProvider } from './contexts/UIContext';
import PWAInstallPrompt from './components/PWAInstallPrompt';

export default function App() {
  return (
    <AuthProvider>
      <PremiumProvider>
        <PrivacyProvider>
          <NotificationProvider>
            <UIProvider>
            <PWAInstallPrompt />
            <BrowserRouter>
              
                <AppInitializer />
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
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="history/:type" element={<HistoryPage />} />
                    <Route path="business" element={<BusinessList />} />
                    <Route path="business-ideas" element={<BusinessIdeas />} />
                    <Route path="business/:businessId" element={<BusinessDashboard />} />
                    <Route path="business/:businessId/products" element={<BusinessProductList />} />
                    <Route path="business/:businessId/sales" element={<BusinessSaleList />} />
                    <Route path="business/:businessId/goals" element={<BusinessGoals />} />
                    <Route path="business/:businessId/transactions/:type" element={<BusinessTransactionList />} />
                    <Route path="business/:businessId/debts" element={<BusinessDebtList />} />
                    <Route path="business/:businessId/upcoming-payments" element={<BusinessUpcomingPayments />} />
                    <Route path="business/:businessId/coach" element={<BusinessCoach />} />
                    <Route path="living-expenses" element={<LivingExpenses />} />
                    <Route path="expenses-planner" element={<ExpensesPlanner />} />
                    <Route path="upcoming-payments" element={<UpcomingPayments />} />
                    <Route path="trash" element={<TrashBin />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="terms" element={<Terms />} />
                    <Route path="privacy" element={<Privacy />} />
                    <Route path="refundpolicy" element={<RefundPolicy />} />
                  </Route>
                </Routes>
              
            </BrowserRouter>
            </UIProvider>
          </NotificationProvider>
        </PrivacyProvider>
      </PremiumProvider>
    </AuthProvider>
  );
}
