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
    };

    // Listen to both 'message' and window.onNativeMessage
    window.addEventListener('message', handleMessage);

    // Preserve existing onNativeMessage if any
    const existing = (window as any).onNativeMessage;
    (window as any).onNativeMessage = (msg: any) => {
      if (typeof existing === 'function') existing(msg);
      handleMessage({ data: msg } as MessageEvent);
    };
  }

  // ---- Public API methods ----
  async getPremiumStatus() {
    return this.sendRequest<{ isPremium: boolean }>('getPremiumStatus');
  }

  async purchasePremium(planId: 'monthly' | 'yearly' | 'business') {
    return this.sendRequest<{ transactionId?: string }>('purchasePremium', { planId });
  }

  async schedulePaymentNotifications(instances, title) {
    return this.sendRequest<Array<{ instanceId: string; notificationId: string }>>(
      'schedulePaymentNotifications',
      { instances, title }
    );
  }

  async cancelNotification(instanceId: string) {
    await this.sendRequest<void>('cancelNotification', { instanceId });
  }

  async cancelAllNotifications() {
    await this.sendRequest<void>('cancelAllNotifications');
  }

  async getPushToken() {
    return this.sendRequest<{ token: string }>('getPushToken');
  }

  async markNotificationAsRead(notificationId: string) {
    await this.sendRequest<void>('markNotificationAsRead', { notificationId });
  }

  async markAllAsRead() {
    await this.sendRequest<void>('markAllAsRead');
  }

  async syncToCalendar(instances, title) {
    return this.sendRequest<{ success: boolean }>('syncToCalendar', { instances, title });
  }

  async removeFromCalendar(instanceIds: string[]) {
    await this.sendRequest<void>('removeFromCalendar', { instanceIds });
  }

  async scanReceipt() {
    return this.sendRequest<{ amount: number; merchant: string; date: string } | null>('scanReceipt');
  }

  async scanProductImage() {
    return this.sendRequest<{ name: string; price?: number; details?: string } | null>('scanProductImage');
  }

  log(message: string) {
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'log', payload: { message } })
      );
    } else {
      console.log(`[YouFI Log] ${message}`);
    }
  }
}

// ---- Singleton accessor ----
let bridgeInstance: YouFINativeBridge | null = null;

function getBridgeInstance(): YouFINativeBridge | null {
  if (isWebView() && (window as any).ReactNativeWebView) {
    if (!bridgeInstance) {
      bridgeInstance = new NativeBridge();
      // Optionally expose globally for debugging or legacy code
      if (typeof window !== 'undefined') {
        (window as any).__youfiBridge = bridgeInstance;
      }
    }
    return bridgeInstance;
  }
  return null;
}

// ---- React Hook ----
export function useNativeBridge() {
  const [bridge, setBridge] = useState<YouFINativeBridge | null>(() => getBridgeInstance());
  const [isNativeSupported, setIsNativeSupported] = useState<boolean>(!!bridge);

  useEffect(() => {
    // On mount, re-check (in case ReactNativeWebView appears later)
    const instance = getBridgeInstance();
    setBridge(instance);
    setIsNativeSupported(!!instance);
  }, []);

  const refreshBridge = useCallback(() => {
    const instance = getBridgeInstance();
    setBridge(instance);
    setIsNativeSupported(!!instance);
  }, []);

  return { bridge, isNativeSupported, refreshBridge };
}