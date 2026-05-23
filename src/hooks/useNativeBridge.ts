import { useState, useEffect } from 'react';

export interface YouFINativeBridge {
  isNativeSupported: boolean;
  isPremium: boolean;
  
  schedulePaymentNotifications(
    instances: Array<{ id: string; dueDate: string; amount: number; status: string }>,
    title: string
  ): Promise<Array<{ instanceId: string; notificationId: string }>>;
  
  cancelNotification(instanceId: string): Promise<void>;
  cancelAllNotifications(): Promise<void>;
  
  getPushToken(): Promise<string>;
  
  getNotifications(): Promise<Array<{
    id: string;
    title: string;
    body: string;
    receivedAt: string;
    read: boolean;
    data?: any;
  }>>;
  
  getUnreadCount(): Promise<number>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  onNotificationReceived(callback: (notification: any) => void): void;
  
  // Calendar (Premium)
  syncToCalendar(
    instances: Array<{ id: string; dueDate: string; amount: number }>,
    title: string
  ): Promise<boolean>;
  
  removeFromCalendar(instanceIds: string[]): Promise<void>;
  
  // Receipt Scanning
  scanReceipt(): Promise<{ amount: number; merchant: string; date: string } | null>;
  
  // Premium
  getPremiumStatus(): Promise<boolean>;
  purchasePremium(planId: 'monthly' | 'yearly' | 'business'): Promise<boolean>;
  
  // Utility
  log(message: string): void;
}

// Check if running in a WebView on modern browsers/native
const isWebView = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).ReactNativeWebView !== undefined || navigator.userAgent.includes('wv') || (window as any).YouFI !== undefined;
};

// Web Mock Implementation for developers testing on the web version
const createWebFallbackBridge = (): YouFINativeBridge => {
  const getMockNotifications = (): any[] => {
    try {
      const stored = localStorage.getItem('youfi_web_notifications');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    
    // Default mock notifications if none exist
    const defaults = [
      {
        id: 'mock-1',
        title: 'Welcome to YouFI Native!',
        body: 'You are now running on our native-enhanced interface. Check out premium features like receipt scanning and calendar sync!',
        receivedAt: new Date(Date.now() - 3600000).toISOString(),
        read: false,
      },
      {
        id: 'mock-2',
        title: 'Weekly Financial Tip',
        body: 'Review your upcoming payments to avoid any late fees. Creating a budget helps reduce unnecessary expenses.',
        receivedAt: new Date(Date.now() - 86400000).toISOString(),
        read: true,
      }
    ];
    localStorage.setItem('youfi_web_notifications', JSON.stringify(defaults));
    return defaults;
  };

  const saveMockNotifications = (notifications: any[]) => {
    localStorage.setItem('youfi_web_notifications', JSON.stringify(notifications));
  };

  const listeners: Array<(notification: any) => void> = [];

  // Periodically mock receiving a new notification (for demo in browser)
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const isPremium = localStorage.getItem('youfi_premium') === 'true';
      const notification = {
        id: 'mock-dynamic-' + Date.now(),
        title: isPremium ? 'Premium Reward Alert 🌟' : 'Upcoming Bill Alert ⏰',
        body: isPremium ? 'We analyzed your receipts. Your savings are up 12% this month!' : 'You have a payment due today. Use Calendar Sync to stay updated!',
        receivedAt: new Date().toISOString(),
        read: false,
      };
      
      const current = getMockNotifications();
      current.unshift(notification);
      saveMockNotifications(current);
      
      listeners.forEach(cb => {
        try {
          cb(notification);
        } catch (e) {
          console.error('[WebBridge Error] trigger listener:', e);
        }
      });
    }, 15000);
  }

  return {
    isNativeSupported: false,
    get isPremium() {
      return localStorage.getItem('youfi_premium') === 'true';
    },
    
    async schedulePaymentNotifications(instances, title) {
      console.log(`[WebBridge] Scheduled payment notifications for: ${title}`, instances);
      const mappings = instances.map(inst => ({
        instanceId: inst.id,
        notificationId: 'notif-' + inst.id
      }));
      return mappings;
    },
    
    async cancelNotification(instanceId) {
      console.log(`[WebBridge] Cancelled notification for: ${instanceId}`);
    },
    
    async cancelAllNotifications() {
      console.log('[WebBridge] Cancelled all notifications');
    },
    
    async getPushToken() {
      return 'mock-web-push-token-1234567890';
    },
    
    async getNotifications() {
      return getMockNotifications();
    },
    
    async getUnreadCount() {
      const notifs = getMockNotifications();
      return notifs.filter(n => !n.read).length;
    },
    
    async markNotificationAsRead(notificationId) {
      const notifs = getMockNotifications();
      const updated = notifs.map(n => n.id === notificationId ? { ...n, read: true } : n);
      saveMockNotifications(updated);
    },
    
    async markAllAsRead() {
      const notifs = getMockNotifications();
      const updated = notifs.map(n => ({ ...n, read: true }));
      saveMockNotifications(updated);
    },
    
    onNotificationReceived(callback) {
      listeners.push(callback);
    },
    
    async syncToCalendar(instances, title) {
      console.log(`[WebBridge] Syncing ${instances.length} items for "${title}" to native Calendar`);
      return true;
    },
    
    async removeFromCalendar(instanceIds) {
      console.log('[WebBridge] Removed calendar instances:', instanceIds);
    },
    
    async scanReceipt() {
      console.log('[WebBridge] Simulating Receipt Scanning...');
      const simulateSuccess = window.confirm('Configure Web Sandbox: Simulate successful receipt scan?\n\nClick OK for high-fidelity scanning simulation ($45.99 at "Supermarket").\nClick Cancel to simulate empty result.');
      if (simulateSuccess) {
        return {
          amount: 45.99,
          merchant: 'Supermarket',
          date: new Date().toISOString().split('T')[0]
        };
      }
      return null;
    },
    
    async getPremiumStatus() {
      return localStorage.getItem('youfi_premium') === 'true';
    },
    
    async purchasePremium(planId) {
      console.log(`[WebBridge] Processing premium purchase: ${planId}`);
      localStorage.setItem('youfi_premium', 'true');
      return true;
    },
    
    log(message) {
      console.log(`[YouFI WebView Log]: ${message}`);
    }
  };
};

export function useNativeBridge() {
  const [isNative, setIsNative] = useState(isWebView());
  const [bridge, setBridge] = useState<YouFINativeBridge | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const handleDetection = () => {
      const nativeDetected = isWebView();
      setIsNative(nativeDetected);
      
      const activeBridge = (window as any).YouFI || createWebFallbackBridge();
      setBridge(activeBridge);
      
      // Keep track of premium changes in local state for reactive views
      if (activeBridge.getPremiumStatus) {
        activeBridge.getPremiumStatus().then((status: boolean) => {
          setIsPremium(status);
        });
      } else {
        setIsPremium(activeBridge.isPremium);
      }
    };

    handleDetection();
    
    // Periodically re-check in case injection was slightly delayed
    const timer = setTimeout(handleDetection, 500);
    return () => clearTimeout(timer);
  }, []);

  const refreshPremiumStatus = async () => {
    if (!bridge) return false;
    let status = false;
    if (bridge.getPremiumStatus) {
      status = await bridge.getPremiumStatus();
    } else {
      status = bridge.isPremium;
    }
    setIsPremium(status);
    return status;
  };

  return { isNative, bridge: bridge || createWebFallbackBridge(), isPremium, refreshPremiumStatus };
}
