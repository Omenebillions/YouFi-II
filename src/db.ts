import Dexie, { Table } from 'dexie';
import CryptoJS from 'crypto-js';

const SECRET_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OFFLINE_DB_SECRET) 
  || (typeof process !== 'undefined' && process.env && process.env.VITE_OFFLINE_DB_SECRET) 
  || 'youfi-secret-key-default-39281';

export const encrypt = (text: string) => {
  if (!text) return text;
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decrypt = (cipher: string) => {
  if (!cipher) return cipher;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Error decrypting data', error);
    return cipher;
  }
};

export interface LocalTransaction {
  id?: number;
  sync_id?: string;
  user_id: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  description?: string;
  note?: string;
  synced: 0 | 1;
}

export interface LocalBudget {
  id?: number;
  sync_id?: string;
  user_id: string;
  category: string;
  budget_limit: number;
  month: string;
  synced: 0 | 1;
}

export class YouFiDB extends Dexie {
  transactions!: Table<LocalTransaction, number>;
  budgets!: Table<LocalBudget, number>;

  constructor() {
    super('YouFiDB');
    this.version(2).stores({
      transactions: '++id, sync_id, user_id, type, category, date, synced',
      budgets: '++id, sync_id, user_id, category, month, synced',
    });
  }
}

export const localDb = new YouFiDB();

/**
 * Encrypt a transaction before storing offline to protect sensitive info.
 * Deduplicates by sync_id / remote id and strictly preserves sync status.
 */
export const storeOfflineTransaction = async (tx: any): Promise<number | undefined> => {
  if (!tx || !tx.user_id) {
    console.warn('[OfflineDB]: Cannot store offline transaction without a valid user_id.');
    return undefined;
  }

  const syncId = String(tx.id || tx.sync_id || '');
  const syncedState: 0 | 1 = (tx.synced === 1 || tx.synced === 0) ? tx.synced : 0;

  const encTx: LocalTransaction = {
    sync_id: syncId || undefined,
    user_id: String(tx.user_id),
    amount: Number(tx.amount) || 0,
    type: tx.type || 'expense',
    category: tx.category || 'General',
    date: tx.date || new Date().toISOString().split('T')[0],
    note: encrypt(tx.note || ''),
    description: encrypt(tx.description || ''),
    synced: syncedState
  };

  // Upsert strategy to avoid duplicates
  if (syncId) {
    const existing = await localDb.transactions
      .where('user_id')
      .equals(encTx.user_id)
      .filter(t => t.sync_id === syncId)
      .first();

    if (existing && existing.id) {
      await localDb.transactions.update(existing.id, encTx);
      return existing.id;
    }
  }

  const newId = await localDb.transactions.add(encTx);
  return newId;
};

/**
 * Retrieve offline transactions for a SPECIFIC user only.
 * Requires userId to prevent cross-user data leakage.
 */
export const getOfflineTransactions = async (userId: string): Promise<any[]> => {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  const encTxs = await localDb.transactions
    .where('user_id')
    .equals(userId)
    .toArray();

  return encTxs.map(tx => ({
    ...tx,
    id: tx.sync_id || `local-${tx.id}`,
    note: decrypt(tx.note || ''),
    description: decrypt(tx.description || '')
  }));
};

/**
 * Delete a specific offline transaction for a user.
 */
export const deleteOfflineTransaction = async (userId: string, txId: string | number): Promise<void> => {
  if (!userId || !txId) return;

  const stringId = String(txId);
  const matches = await localDb.transactions
    .where('user_id')
    .equals(userId)
    .filter(t => t.sync_id === stringId || String(t.id) === stringId)
    .toArray();

  for (const m of matches) {
    if (m.id) await localDb.transactions.delete(m.id);
  }
};

/**
 * Encrypt and store a budget offline with deduplication and sync preservation.
 */
export const storeOfflineBudget = async (budget: any): Promise<number | undefined> => {
  if (!budget || !budget.user_id) {
    console.warn('[OfflineDB]: Cannot store offline budget without a valid user_id.');
    return undefined;
  }

  const syncId = String(budget.id || budget.sync_id || '');
  const syncedState: 0 | 1 = (budget.synced === 1 || budget.synced === 0) ? budget.synced : 0;

  const encBudget: LocalBudget = {
    sync_id: syncId || undefined,
    user_id: String(budget.user_id),
    category: budget.category || 'General',
    budget_limit: Number(budget.amount || budget.budget_limit) || 0,
    month: budget.period || budget.month || '',
    synced: syncedState
  };

  if (syncId) {
    const existing = await localDb.budgets
      .where('user_id')
      .equals(encBudget.user_id)
      .filter(b => b.sync_id === syncId)
      .first();

    if (existing && existing.id) {
      await localDb.budgets.update(existing.id, encBudget);
      return existing.id;
    }
  }

  const newId = await localDb.budgets.add(encBudget);
  return newId;
};

/**
 * Retrieve offline budgets for a SPECIFIC user only.
 */
export const getOfflineBudgets = async (userId: string, period?: string): Promise<any[]> => {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  let query = localDb.budgets.where('user_id').equals(userId);
  const budgets = await query.toArray();

  if (period) {
    return budgets.filter(b => b.month === period);
  }

  return budgets.map(b => ({
    ...b,
    id: b.sync_id || `local-budget-${b.id}`,
    amount: b.budget_limit,
    period: b.month
  }));
};

/**
 * Clear cached records for a single user without impacting other accounts.
 */
export const clearUserOfflineData = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    await localDb.transactions.where('user_id').equals(userId).delete();
    await localDb.budgets.where('user_id').equals(userId).delete();
  } catch (err) {
    console.warn('[OfflineDB]: Warning clearing user offline data:', err);
  }
};

/**
 * Completely purge all local Dexie tables.
 */
export const clearAllOfflineData = async (): Promise<void> => {
  try {
    await localDb.transactions.clear();
    await localDb.budgets.clear();
  } catch (err) {
    console.warn('[OfflineDB]: Warning clearing all offline data:', err);
  }
};
