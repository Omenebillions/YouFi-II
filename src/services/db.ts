import { supabase } from './supabase';
import { 
  localDb, 
  storeOfflineTransaction, 
  getOfflineTransactions,
  storeOfflineBudget,
  getOfflineBudgets,
  deleteOfflineTransaction,
  clearUserOfflineData,
  clearAllOfflineData
} from '../db';
import { parseBusinessName } from '../lib/business';

export const tables = {
  users: 'users',
  transactions: 'transactions',
  budgets: 'budgets',
  savingsGoals: 'savings_goals',
  financialPlans: 'financial_plans',
  aiInsights: 'ai_insights',
  trash: 'trash',
  businesses: 'businesses',
  businessTransactions: 'business_transactions',
  products: 'products',
  sales: 'sales',
  businessDebts: 'business_debts',
  businessIdeas: 'business_ideas',
  upcomingPayments: 'upcoming_payments',
  userSubscriptions: 'user_subscriptions',
  subscriptionTransactions: 'subscription_transactions',
  accountDeletionRequests: 'account_deletion_requests'
};

export const moveToTrash = async (tableName: string, originalId: string, data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from(tables.trash).insert({
      user_id: userData.user.id,
      table_name: tableName,
      original_id: originalId,
      data: data
    });
    if (error) throw error;
  } catch (error) {
    console.warn("Warning moving to trash:", error);
  }
};

export const fetchTransactions = async (userId: string): Promise<any[]> => {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(tables.transactions)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
      
    if (error) throw error;
    
    const remoteData = (data || []).map((tx: any) => ({
      ...tx,
      user_id: userId,
      note: tx.note !== undefined ? tx.note : tx.description
    }));

    // Upsert remote data into user-scoped Dexie store
    if (remoteData.length > 0) {
      for (const tx of remoteData) {
        await storeOfflineTransaction({ ...tx, user_id: userId, synced: 1 });
      }
    }
    
    return remoteData;
  } catch (error) {
    console.warn("[DB Service]: Offline fallback for fetching transactions for user:", userId, error);
    try {
      const fallback = await getOfflineTransactions(userId);
      return fallback;
    } catch (e) {
      return [];
    }
  }
};

export const fetchRecentTransactions = async (userId: string, maxResults: number = 50): Promise<any[]> => {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(tables.transactions)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(maxResults);
      
    if (error) throw error;
    return (data || []).map((tx: any) => ({
      ...tx,
      user_id: userId,
      note: tx.note !== undefined ? tx.note : tx.description
    }));
  } catch (error) {
    console.warn("[DB Service]: Offline fallback for recent transactions for user:", userId, error);
    try {
      const fallback = await getOfflineTransactions(userId);
      return fallback.slice(0, maxResults);
    } catch (e) {
      return [];
    }
  }
};

export const fetchBudgets = async (userId: string, period?: string): Promise<any[]> => {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  try {
    let query = supabase
      .from(tables.budgets)
      .select('*')
      .eq('user_id', userId);

    if (period) {
      query = query.eq('period', period);
    }

    const { data, error } = await query;
    if (error) throw error;

    const list = data || [];
    // Cache to user-scoped offline store
    for (const b of list) {
      await storeOfflineBudget({ ...b, user_id: userId, synced: 1 });
    }
    return list;
  } catch (error) {
    console.warn("[DB Service]: Offline fallback for budgets for user:", userId, error);
    try {
      return await getOfflineBudgets(userId, period);
    } catch (e) {
      return [];
    }
  }
};

export const addTransaction = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    
    // Map note to description to support legacy schema without note column
    const { note, ...restData } = data;
    const finalData = { ...restData, description: note || restData.description, user_id: userData.user.id };
    
    // Attempt online sync
    try {
      const { data: insertedData, error } = await supabase
        .from(tables.transactions)
        .insert(finalData)
        .select();
        
      if (error) throw error;
      
      // Store in offline db as synced
      if (insertedData?.[0]) {
         await storeOfflineTransaction({ ...insertedData[0], user_id: userData.user.id, synced: 1 });
      }
      return insertedData?.[0]?.id;
    } catch (networkError) {
      console.log("Saving transaction offline. Network error:", networkError);
      
      // Save offline and mark unsynced
      const offlineId = `offline-${Date.now()}`;
      await storeOfflineTransaction({ ...finalData, id: offlineId, user_id: userData.user.id, synced: 0 });
      return offlineId;
    }
    
  } catch (error) {
    console.warn("Warning adding transaction:", error);
    throw error;
  }
};


export const deleteTransaction = async (id: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      await deleteOfflineTransaction(userData.user.id, id);
    }

    const { error } = await supabase
      .from(tables.transactions)
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.warn("Warning deleting transaction:", error);
  }
};

export const updateTransaction = async (id: string, data: any) => {
  try {
    const { note, ...restData } = data;
    const finalData = { ...restData, description: note !== undefined ? note : restData.description };
    
    const { error } = await supabase
      .from(tables.transactions)
      .update(finalData)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.warn("Warning updating transaction:", error);
    throw error;
  }
};

export const fetchUser = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.users)
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn("Warning fetching user:", error);
  }
};

export const createUserProfile = async (userId: string, data: any) => {
  try {
    const { error } = await supabase
      .from(tables.users)
      .upsert({
        id: userId,
        ...data,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
  } catch (error) {
    console.warn("Warning creating user profile:", error);
  }
};

export const getGoals = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from(tables.savingsGoals)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("Warning fetching goals:", error);
    }
  };
  
export const addGoal = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: insertedData, error } = await supabase
      .from(tables.savingsGoals)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select();
      
    if (error) throw error;
    return insertedData?.[0]?.id;
  } catch (error) {
    console.warn("Warning adding goal:", error);
  }
};

export const updateGoal = async (id: string, data: any) => {
  try {
    const { error } = await supabase
      .from(tables.savingsGoals)
      .update(data)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.warn("Warning updating goal:", error);
  }
};

export const deleteGoal = async (id: string) => {
  try {
    const { error } = await supabase
      .from(tables.savingsGoals)
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.warn("Warning deleting goal:", error);
  }
};

export const getPlans = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.financialPlans)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching plans:", error);
  }
};

export const addPlan = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: insertedData, error } = await supabase
      .from(tables.financialPlans)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select();
      
    if (error) throw error;
    return insertedData?.[0]?.id;
  } catch (error) {
    console.warn("Warning adding plan:", error);
  }
};


export const updatePlan = async (id: string, data: any) => {
  try {
    const { error } = await supabase
      .from(tables.financialPlans)
      .update(data)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.warn("Warning updating plan:", error);
  }
};

export const getBusinesses = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.businesses)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    if (!data) return [];
    
    return data.map((b: any) => {
      const meta = parseBusinessName(b.name);
      return {
        ...b,
        name: meta.name,
        category: meta.category,
        description: meta.description
      };
    });
  } catch (error) {
    console.warn("Warning fetching businesses:", error);
    return [];
  }
};

export const createBusiness = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: insertedData, error } = await supabase
      .from(tables.businesses)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select()
      .single();
      
    if (error) throw error;
    return insertedData;
  } catch (error) {
    console.warn("Warning creating business:", error);
    return null;
  }
};

export const getBusinessTransactions = async (businessId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.businessTransactions)
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching business transactions:", error);
    return [];
  }
};

export const addBusinessTransaction = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: insertedData, error } = await supabase
      .from(tables.businessTransactions)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select()
      .single();
      
    if (error) throw error;
    return insertedData;
  } catch (error) {
    console.warn("Warning adding business transaction:", error);
    return null;
  }
};

export const getProducts = async (businessId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.products)
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching products:", error);
    return [];
  }
};

export const addProduct = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: insertedData, error } = await supabase
      .from(tables.products)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select()
      .single();
      
    if (error) throw error;
    return insertedData;
  } catch (error) {
    console.warn("Warning adding product:", error);
    return null;
  }
};

export const getSales = async (businessId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.sales)
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching sales:", error);
    return [];
  }
};

export const recordSale = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: insertedData, error } = await supabase
      .from(tables.sales)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select()
      .single();
      
    if (error) throw error;
    return insertedData;
  } catch (error) {
    console.warn("Warning recording sale:", error);
    return null;
  }
};

export const getBusinessDebts = async (businessId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.businessDebts)
      .select('*')
      .eq('business_id', businessId)
      .order('due_date', { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching business debts:", error);
    return [];
  }
};

export const addBusinessDebt = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: insertedData, error } = await supabase
      .from(tables.businessDebts)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select()
      .single();
      
    if (error) throw error;
    return insertedData;
  } catch (error) {
    console.warn("Warning adding business debt:", error);
    return null;
  }
};

export const deletePlan = async (id: string) => {
  try {
    const { error } = await supabase
      .from(tables.financialPlans)
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.warn("Warning deleting plan:", error);
  }
};

export const getUpcomingPayments = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.upcomingPayments)
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching upcoming payments:", error);
    return [];
  }
};

export const fetchAllUserBusinessSales = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.sales)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching all user business sales:", error);
    return [];
  }
};

export const fetchAllUserBusinessTransactions = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.businessTransactions)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Warning fetching all user business transactions:", error);
    return [];
  }
};

export const fetchUserSubscription = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.userSubscriptions)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn("Warning fetching user subscription:", error);
    return null;
  }
};

export const deleteUserAccount = async (accessToken?: string): Promise<boolean> => {
  let token = accessToken;
  if (!token) {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token;
  }

  if (!token) {
    throw new Error("You must be authenticated to delete your account.");
  }

  const response = await fetch('/api/account/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const resData = await response.json().catch(() => ({}));

  if (!response.ok || !resData.success) {
    const errorMsg = resData.error || resData.message || `Account deletion failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return true;
};

/**
 * Clears all locally cached user data across Dexie IndexedDB, localStorage, and Cache Storage.
 */
export const clearLocalUserData = async (): Promise<void> => {
  // 1. Clear offline Dexie database tables
  try {
    if (localDb.transactions) await localDb.transactions.clear();
    if (localDb.budgets) await localDb.budgets.clear();
  } catch (dexieErr) {
    console.warn("[Local Cleanup]: Warning clearing offline Dexie database:", dexieErr);
  }

  // 2. Clear YouFi-specific and user-specific localStorage keys
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.startsWith('youfi') ||
          lowerKey.startsWith('offline') ||
          lowerKey.startsWith('sb-') ||
          lowerKey.includes('settings') ||
          lowerKey.includes('privacy') ||
          lowerKey.includes('currency') ||
          lowerKey.includes('business') ||
          lowerKey.includes('auth') ||
          lowerKey.includes('profile') ||
          lowerKey.includes('user')
        ) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (lsErr) {
    console.warn("[Local Cleanup]: Warning clearing localStorage:", lsErr);
  }

  // 3. Clear Cache Storage caches used by PWA / Service Worker
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(
        cacheKeys
          .filter(name => name.toLowerCase().includes('youfi') || name.toLowerCase().includes('workbox') || name.toLowerCase().includes('app'))
          .map(name => window.caches.delete(name))
      );
    }
  } catch (cacheErr) {
    console.warn("[Local Cleanup]: Warning clearing Cache Storage:", cacheErr);
  }
};


