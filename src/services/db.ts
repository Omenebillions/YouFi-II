import { supabase } from './supabase';

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
  upcomingPayments: 'upcoming_payments'
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
    console.error("Error moving to trash:", error);
  }
};

export const fetchTransactions = async (userId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from(tables.transactions)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
};

export const fetchRecentTransactions = async (userId: string, maxResults: number = 50): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from(tables.transactions)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(maxResults);
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    return [];
  }
};

export const addTransaction = async (data: any) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: insertedData, error } = await supabase
      .from(tables.transactions)
      .insert({
        ...data,
        user_id: userData.user.id
      })
      .select();
      
    if (error) throw error;
    return insertedData?.[0]?.id;
  } catch (error) {
    console.error("Error adding transaction:", error);
  }
};


export const deleteTransaction = async (id: string) => {
  try {
    const { error } = await supabase
      .from(tables.transactions)
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting transaction:", error);
  }
};

export const updateTransaction = async (id: string, data: any) => {
  try {
    const { error } = await supabase
      .from(tables.transactions)
      .update(data)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error("Error updating transaction:", error);
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
    console.error("Error fetching user:", error);
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
    console.error("Error creating user profile:", error);
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
      console.error("Error fetching goals:", error);
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
    console.error("Error adding goal:", error);
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
    console.error("Error updating goal:", error);
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
    console.error("Error deleting goal:", error);
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
    console.error("Error fetching plans:", error);
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
    console.error("Error adding plan:", error);
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
    console.error("Error updating plan:", error);
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
    return data || [];
  } catch (error) {
    console.error("Error fetching businesses:", error);
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
    console.error("Error creating business:", error);
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
    console.error("Error fetching business transactions:", error);
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
    console.error("Error adding business transaction:", error);
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
    console.error("Error fetching products:", error);
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
    console.error("Error adding product:", error);
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
    console.error("Error fetching sales:", error);
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
    console.error("Error recording sale:", error);
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
    console.error("Error fetching business debts:", error);
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
    console.error("Error adding business debt:", error);
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
    console.error("Error deleting plan:", error);
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
    console.error("Error fetching upcoming payments:", error);
    return [];
  }
};
