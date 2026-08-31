/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PremiumProvider } from './contexts/PremiumContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { UIProvider } from './contexts/UIContext';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useNativeBridge } from './hooks/useNativeBridge';
import { supabase } from './services/supabase';
import Layout from './components/Layout';

// Lazy loaded pages to optimize bundle size and speed up initial load
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AddTransaction = React.lazy(() => import('./pages/AddTransaction'));
const Coach = React.lazy(() => import('./pages/Coach'));
const Insights = React.lazy(() => import('./pages/Insights'));
const Goals = React.lazy(() => import('./pages/Goals'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Profile = React.lazy(() => import('./pages/Profile'));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'));
const AutoImport = React.lazy(() => import('./pages/AutoImport'));
const BusinessList = React.lazy(() => import('./pages/BusinessList'));
const BusinessDashboard = React.lazy(() => import('./pages/BusinessDashboard'));
const BusinessProductList = React.lazy(() => import('./pages/BusinessProductList'));
const BusinessSaleList = React.lazy(() => import('./pages/BusinessSaleList'));
const BusinessTransactionList = React.lazy(() => import('./pages/BusinessTransactionList'));
const BusinessDebtList = React.lazy(() => import('./pages/BusinessDebtList'));
const BusinessCoach = React.lazy(() => import('./pages/BusinessCoach'));
const BusinessGoals = React.lazy(() => import('./pages/BusinessGoals'));
const LivingExpenses = React.lazy(() => import('./pages/LivingExpenses'));
const ExpensesPlanner = React.lazy(() => import('./pages/ExpensesPlanner'));
const UpcomingPayments = React.lazy(() => import('./pages/UpcomingPayments'));
const BusinessUpcomingPayments = React.lazy(() => import('./pages/BusinessUpcomingPayments'));
const TrashBin = React.lazy(() => import('./pages/TrashBin'));
const BusinessIdeas = React.lazy(() => import('./pages/BusinessIdeas'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const Terms = React.lazy(() => import('./pages/Terms'));
const Privacy = React.lazy(() => import('./pages/Privacy'));
const RefundPolicy = React.lazy(() => import('./pages/RefundPolicy'));
const DeleteAccountRequest = React.lazy(() => import('./pages/DeleteAccountRequest'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-3">
        <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-gray-400 tracking-wide uppercase">Loading YouFi...</p>
      </div>
    );
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





export default function App() {
  return (
    <AuthProvider>
      <PremiumProvider>
        <PrivacyProvider>
          <NotificationProvider>
            <UIProvider>
            <PWAInstallPrompt />
            <Router>
              
              <AppInitializer />
              <Suspense fallback={
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              }>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/delete-account" element={<DeleteAccountRequest />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/refundpolicy" element={<RefundPolicy />} />
                  <Route path="/pricing" element={<Pricing />} />
                  
                  <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                    <Route index element={<Dashboard />} />
                    <Route path="add" element={<AddTransaction />} />
                    <Route path="auto-import" element={<AutoImport />} />
                    <Route path="coach" element={<Coach />} />
                    <Route path="insights" element={<Insights />} />
                    <Route path="goals" element={<Goals />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="profile" element={<Navigate to="/settings" replace />} />
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
              </Suspense>
              
            </Router>
            </UIProvider>
          </NotificationProvider>
        </PrivacyProvider>
      </PremiumProvider>
    </AuthProvider>
  );
}
