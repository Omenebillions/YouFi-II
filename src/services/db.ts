import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, orderBy, serverTimestamp, 
  onSnapshot, limit
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { handleFirestoreError, OperationType } from './dbErrorHandler';

export const collections = {
  users: 'users',
  transactions: 'transactions',
  budgets: 'budgets',
  savingsGoals: 'savingsGoals',
  financialPlans: 'financialPlans',
  aiInsights: 'aiInsights',
  trash: 'trash'
};

export const moveToTrash = async (collectionName: string, originalId: string, data: any) => {
  try {
    const trashRef = doc(collection(db, collections.trash));
    await setDoc(trashRef, {
      userId: auth.currentUser?.uid,
      collectionName,
      originalId,
      data,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error moving to trash:", error);
  }
};

export const fetchTransactions = async (userId: string): Promise<any[]> => {
  try {
    const q = query(collection(db, collections.transactions), where('userId', '==', userId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collections.transactions);
    return [];
  }
};

export const fetchRecentTransactions = async (userId: string, maxResults: number = 50): Promise<any[]> => {
  try {
    const q = query(collection(db, collections.transactions), where('userId', '==', userId), orderBy('date', 'desc'), limit(maxResults));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collections.transactions);
    return [];
  }
};

export const addTransaction = async (data: any) => {
  try {
    const newDocRef = doc(collection(db, collections.transactions));
    await setDoc(newDocRef, {
      ...data,
      userId: auth.currentUser?.uid,
      createdAt: serverTimestamp()
    });
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collections.transactions);
  }
};

export const deleteTransaction = async (id: string) => {
  try {
    await deleteDoc(doc(db, collections.transactions, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collections.transactions}/${id}`);
  }
};

export const updateTransaction = async (id: string, data: any) => {
  try {
    const docRef = doc(db, collections.transactions, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collections.transactions}/${id}`);
  }
};

export const fetchUser = async (userId: string) => {
  try {
    const docRef = doc(db, collections.users, userId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, collections.users);
  }
};

export const createUserProfile = async (userId: string, data: any) => {
  try {
    const docRef = doc(db, collections.users, userId);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collections.users);
  }
};

export const getGoals = async (userId: string) => {
    try {
      const q = query(collection(db, collections.savingsGoals), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collections.savingsGoals);
    }
  };
  
export const addGoal = async (data: any) => {
  try {
      const newDocRef = doc(collection(db, collections.savingsGoals));
      await setDoc(newDocRef, {
      ...data,
      userId: auth.currentUser?.uid,
      createdAt: serverTimestamp()
      });
      return newDocRef.id;
  } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collections.savingsGoals);
  }
};

export const updateGoal = async (id: string, data: any) => {
  try {
    const docRef = doc(db, collections.savingsGoals, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collections.savingsGoals}/${id}`);
  }
};

export const deleteGoal = async (id: string) => {
  try {
    await deleteDoc(doc(db, collections.savingsGoals, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collections.savingsGoals}/${id}`);
  }
};

export const getPlans = async (userId: string) => {
  try {
    const q = query(collection(db, collections.financialPlans), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collections.financialPlans);
  }
};

export const addPlan = async (data: any) => {
  try {
      const newDocRef = doc(collection(db, collections.financialPlans));
      await setDoc(newDocRef, {
      ...data,
      userId: auth.currentUser?.uid,
      createdAt: serverTimestamp()
      });
      return newDocRef.id;
  } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collections.financialPlans);
  }
};

export const updatePlan = async (id: string, data: any) => {
  try {
    const docRef = doc(db, collections.financialPlans, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collections.financialPlans}/${id}`);
  }
};

export const deletePlan = async (id: string) => {
  try {
    await deleteDoc(doc(db, collections.financialPlans, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collections.financialPlans}/${id}`);
  }
};
