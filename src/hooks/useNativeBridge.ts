// hooks/useNativeBridge.ts
import { useState, useEffect, useCallback, useRef } from 'react';

// ---- Types ----
export interface BridgeRequest {
  type: string;
  callbackId: string;
  payload?: Record<string, unknown>;
}

export interface BridgeResponseSuccess {
  callbackId: string;
  success: true;
  payload?: any;
}

export interface BridgeResponseError {
  callbackId: string;
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type BridgeResponse = BridgeResponseSuccess | BridgeResponseError;

// Error codes (exported for use elsewhere)
export const NATIVE_BRIDGE_UNAVAILABLE = 'NATIVE_BRIDGE_UNAVAILABLE';
export const NATIVE_REQUEST_TIMEOUT = 'NATIVE_REQUEST_TIMEOUT';
export const NATIVE_REQUEST_FAILED = 'NATIVE_REQUEST_FAILED';
export const NATIVE_INVALID_RESPONSE = 'NATIVE_INVALID_RESPONSE';
export const PURCHASE_CANCELLED = 'PURCHASE_CANCELLED';
export const PURCHASE_FAILED = 'PURCHASE_FAILED';
export const SCAN_CANCELLED = 'SCAN_CANCELLED';
export const SCAN_FAILED = 'SCAN_FAILED';
export const CALENDAR_PERMISSION_DENIED = 'CALENDAR_PERMISSION_DENIED';
export const NOTIFICATION_PERMISSION_DENIED = 'NOTIFICATION_PERMISSION_DENIED';

export interface YouFINativeBridge {
  // Premium / billing
  getPremiumStatus(): Promise<{ isPremium: boolean }>;
  purchasePremium(planId: 'monthly' | 'yearly' | 'business'): Promise<{ transactionId?: string }>;

  // Notifications
  schedulePaymentNotifications(
    instances: Array<{ id: string; dueDate: string; amount: number; status?: string }>,
    title: string
  ): Promise<Array<{ instanceId: string; notificationId: string }>>;
  cancelNotification(instanceId: string): Promise<void>;
  cancelAllNotifications(): Promise<void>;
  getPushToken(): Promise<{ token: string }>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllAsRead(): Promise<void>;

  // Calendar
  syncToCalendar(
    instances: Array<{ id: string; dueDate: string; amount: number }>,
    title: string
  ): Promise<{ success: boolean }>;
  removeFromCalendar(instanceIds: string[]): Promise<void>;

  // Scanning
  scanReceipt(): Promise<{ amount: number; merchant: string; date: string } | null>;
  scanProductImage(): Promise<{ name: string; price?: number; details?: string } | null>;
  
  // Premium
  getPremiumStatus(): Promise<boolean>;
  purchasePremium(planId: 'monthly' | 'yearly' | 'business'): Promise<boolean>;
  
  // Rewarded Ads (Free tier only)
  
  // Utility
  log(message: string): void;
}

// ---- Detection ----
const isWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).ReactNativeWebView || navigator.userAgent.includes('wv');
};

// ---- Native Bridge Implementation (singleton) ----
class NativeBridge implements YouFINativeBridge {
  private callbackId = 0;
  private pending = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private isListening = false;

  constructor() {
    this.setupListeners();
  }

  // ---- Send request with callbackId ----
  private sendRequest<T>(type: string, payload?: Record<string, unknown>, timeoutMs = 15000): Promise<T> {
    if (!(window as any).ReactNativeWebView) {
      return Promise.reject(new Error(NATIVE_BRIDGE_UNAVAILABLE));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.callbackId;
      const callbackIdStr = String(id);

      const timer = setTimeout(() => {
        this.pending.delete(callbackIdStr);
        reject(new Error(NATIVE_REQUEST_TIMEOUT));
      }, timeoutMs);

      this.pending.set(callbackIdStr, { resolve, reject, timer });

      const message: BridgeRequest = { type, callbackId: callbackIdStr, payload };
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    });
  }

  // ---- Set up listeners for native responses and events ----
  private setupListeners() {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    const handleMessage = (event: MessageEvent) => {
      let data: unknown;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      // If it's a response with callbackId
      if (data && typeof data === 'object' && 'callbackId' in data) {
        const response = data as BridgeResponse;
        const callbackId = response.callbackId;
        if (this.pending.has(callbackId)) {
          const pending = this.pending.get(callbackId)!;
          clearTimeout(pending.timer);
          this.pending.delete(callbackId);
          if (response.success) {
            pending.resolve(response.payload);
          } else {
            pending.reject(new Error(response.error?.message || NATIVE_REQUEST_FAILED));
          }
          return;
        }
        // Unknown callbackId – ignore or log
        console.warn('Received response with unknown callbackId:', callbackId);
        return;
      }

      // Otherwise, treat as an unsolicited event
      // Dispatch a custom event so PremiumContext / other listeners can handle it
      if (data && typeof data === 'object' && 'type' in data) {
        window.dispatchEvent(new CustomEvent('nativeEvent', { detail: data }));
      }
      return null;
    },
    
    async scanProductImage() {
      console.log('[WebViewBridge] Triggering native scanProductImage');
      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'scanProductImage'
        }));
      }
      return null;
    },
    
    async getPremiumStatus() {
      return localStorage.getItem('youfi_premium') === 'true';
    },
    
    async purchasePremium(planId) {
      console.log(`[WebViewBridge] Requesting purchasePremium natively for: ${planId}`);
      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'purchasePremium',
          planId
        }));
      }
      return true;
    },
    
    
    log(message) {
      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message
        }));
      }
    }
  };
};

// Web Mock Implementation for developers testing on the web version
const createWebFallbackBridge = (): YouFINativeBridge => {
  const getMockNotifications = (): any[] => {
    try {
      const stored = localStorage.getItem('youfi_web_notifications');
      if (stored) {
        const list = JSON.parse(stored);
        return Array.isArray(list) ? list.filter((n: any) => n && n.id && !n.id.startsWith('mock-')) : [];
      }
    } catch (e) {}
    
    localStorage.setItem('youfi_web_notifications', JSON.stringify([]));
    return [];
  };

  const saveMockNotifications = (notifications: any[]) => {
    localStorage.setItem('youfi_web_notifications', JSON.stringify(notifications));
  };

  const listeners: Array<(notification: any) => void> = [];

  return {
    isNativeSupported: false,
    get isPremium() {
      return localStorage.getItem('youfi_premium') === 'true';
    },
    defaultTransactionLimit: 20,
    
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

    async scanProductImage() {
      console.log('[WebBridge] Simulating Product Camera OCR...');
      const simulateSuccess = window.confirm('Configure Web Sandbox: Simulate successful optical character recognition of a product?\n\nClick OK to simulate identifying "Premium Steel Flask" with price $24.99.');
      if (simulateSuccess) {
        return {
          name: 'Premium Steel Flask',
          price: 24.99,
          details: '1L insulated flask'
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

// Expose globally to guarantee window.YouFI is always accessible in code
if (typeof window !== 'undefined' && !(window as any).YouFI) {
  if (isWebView()) {
    (window as any).YouFI = createWebViewBridge();
  } else {
    (window as any).YouFI = createWebFallbackBridge();
  }
  return null;
}

// ---- React Hook ----
export function useNativeBridge() {
  const [bridge, setBridge] = useState<YouFINativeBridge | null>(() => getBridgeInstance());
  const [isNativeSupported, setIsNativeSupported] = useState<boolean>(!!bridge);

  useEffect(() => {
    // Default the app to free tier so token limits and paywalls apply
    if (localStorage.getItem('youfi_premium') !== 'true') {
      localStorage.setItem('youfi_premium', 'false');
    }

    // Expose dynamic updates so native can trigger reacts components instantly via injectJavaScript
    (window as any).updateYouFIPremiumStatus = (status: boolean) => {
      console.log('[NativeBridge] updateYouFIPremiumStatus called with:', status);
      localStorage.setItem('youfi_premium', status ? 'true' : 'false');
      setIsPremium(status);
    };

    const handlePremiumEvent = (e: Event & { detail?: { isPremium: boolean } }) => {
      const status = e.detail?.isPremium;
      if (status !== undefined) {
        console.log('[NativeBridge] premiumStatusChanged event caught:', status);
        localStorage.setItem('youfi_premium', status ? 'true' : 'false');
        setIsPremium(status);
      }
    };

    const handleMessageEvent = (event: MessageEvent) => {
      try {
        let parsed = event.data;
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        if (parsed) {
          if (parsed.type === 'premiumStatusChanged' || parsed.type === 'isPremium') {
            const status = parsed.isPremium !== undefined ? parsed.isPremium : parsed.value;
            console.log('[NativeBridge] Premium message event parsed:', status);
            localStorage.setItem('youfi_premium', status ? 'true' : 'false');
            setIsPremium(status);
          }
          if (parsed.type === 'pushToken') {
            console.log('[NativeBridge] Received push token from native:', parsed.token);
            localStorage.setItem('youfi_push_token', parsed.token);
          }
        }
      } catch (err) {
        // Safe fail
      }
    };

    window.addEventListener('premiumStatusChanged', handlePremiumEvent as any);
    window.addEventListener('message', handleMessageEvent);

    const handleDetection = () => {
      const nativeDetected = isWebView();
      setIsNative(nativeDetected);
      
      const activeBridge = (window as any).YouFI || (nativeDetected ? createWebViewBridge() : createWebFallbackBridge());
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
    return () => {
      window.removeEventListener('premiumStatusChanged', handlePremiumEvent as any);
      window.removeEventListener('message', handleMessageEvent);
      clearTimeout(timer);
    };
  }, []);

  return { bridge, isNativeSupported, refreshBridge };
}