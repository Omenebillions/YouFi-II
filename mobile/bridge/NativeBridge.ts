import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { WebView } from 'react-native-webview';

export interface BridgeMessage {
  type: string;
  payload?: any;
  callbackId?: string;
}

export class ExpoBridge {
  private webViewRef: WebView | null = null;

  constructor(webViewRef: WebView | null) {
    this.webViewRef = webViewRef;
  }

  private sendToWeb(message: BridgeMessage) {
    if (!this.webViewRef) return;
    const script = `
      (function() {
        const payload = ${JSON.stringify(message)};
        if (window.onNativeMessage) {
          window.onNativeMessage(payload);
        }
        window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
      })();
    `;
    this.webViewRef.injectJavaScript(script);
  }

  public handleWebMessage = (event: any) => {
    try {
      const message: BridgeMessage = JSON.parse(event.nativeEvent.data);
      console.log('[NativeBridge] received:', message.type);

      switch (message.type) {
        case 'getPremiumStatus':
          this.getPremiumStatus().then((status) => {
            this.sendToWeb({ type: 'premiumStatusChanged', payload: { isPremium: status }, callbackId: message.callbackId });
          });
          break;

        case 'purchasePremium':
          this.purchasePremium(message.planId || 'monthly').then((success) => {
            this.sendToWeb({ type: 'premiumStatusChanged', payload: { isPremium: success }, callbackId: message.callbackId });
          });
          break;

        case 'getPushToken':
          this.getPushToken().then((token) => {
            this.sendToWeb({ type: 'pushToken', payload: { token }, callbackId: message.callbackId });
          });
          break;

        case 'schedulePaymentNotifications':
          this.schedulePaymentNotifications(message.instances || [], message.title || 'Payment').then((results) => {
            this.sendToWeb({ type: 'notificationsScheduled', payload: { results }, callbackId: message.callbackId });
          });
          break;

        case 'cancelNotification':
          this.cancelNotification(message.instanceId).then(() => {
            this.sendToWeb({ type: 'notificationCancelled', payload: { success: true }, callbackId: message.callbackId });
          });
          break;

        case 'cancelAllNotifications':
          this.cancelAllNotifications().then(() => {
            this.sendToWeb({ type: 'notificationsCleared', payload: { success: true }, callbackId: message.callbackId });
          });
          break;

        case 'markNotificationAsRead':
          this.markNotificationAsRead(message.notificationId).then(() => {
            this.sendToWeb({ type: 'notificationRead', payload: { success: true }, callbackId: message.callbackId });
          });
          break;

        case 'markAllAsRead':
          this.markAllAsRead().then(() => {
            this.sendToWeb({ type: 'notificationsMarkedRead', payload: { success: true }, callbackId: message.callbackId });
          });
          break;

        case 'syncToCalendar':
          this.syncToCalendar(message.instances || [], message.title || 'Upcoming Payment').then((success) => {
            this.sendToWeb({ type: 'calendarSynced', payload: { success }, callbackId: message.callbackId });
          });
          break;

        case 'removeFromCalendar':
          this.removeFromCalendar(message.instanceIds || []).then(() => {
            this.sendToWeb({ type: 'calendarRemoved', payload: { success: true }, callbackId: message.callbackId });
          });
          break;

        case 'scanReceipt':
          this.scanReceipt().then((result) => {
            this.sendToWeb({ type: 'receiptScanResult', payload: result, callbackId: message.callbackId });
          });
          break;

        case 'scanProductImage':
          this.scanProductImage().then((result) => {
            this.sendToWeb({ type: 'productScanResult', payload: result, callbackId: message.callbackId });
          });
          break;


        case 'log':
          console.log('[Web Log]', message.message);
          break;

        default:
          console.warn('[NativeBridge] Unknown message:', message.type);
      }
    } catch (error) {
      console.error('[NativeBridge] Error handling message:', error);
    }
  };

  async getPremiumStatus(): Promise<boolean> {
    const status = await AsyncStorage.getItem('youfi_premium');
    return status === 'true';
  }

  async purchasePremium(planId: string): Promise<boolean> {
    await AsyncStorage.setItem('youfi_premium', 'true');
    console.log(`[NativeBridge] Premium purchase simulated for: ${planId}`);
    return true;
  }

  async schedulePaymentNotifications(instances: Array<{ id: string; dueDate: string; amount: number }>, title: string) {
    const results = [] as Array<{ instanceId: string; notificationId: string }>;
    for (const instance of instances) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Payment due: ${title}`,
          body: `You have a payment of ₦${instance.amount?.toLocaleString() || 0} due soon.`,
        },
        trigger: { date: new Date(instance.dueDate) },
      });
      results.push({ instanceId: instance.id, notificationId });
    }
    return results;
  }

  async cancelNotification(instanceId: string): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log(`[NativeBridge] cancelled notification: ${instanceId}`);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    console.log(`[NativeBridge] marked read: ${notificationId}`);
  }

  async markAllAsRead(): Promise<void> {
    console.log('[NativeBridge] marked all notifications read');
  }

  async getPushToken(): Promise<string> {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      return token;
    } catch (error) {
      console.warn('[NativeBridge] could not fetch push token', error);
      return '';
    }
  }

  async syncToCalendar(instances: Array<{ id: string; dueDate: string; amount: number }>, title: string): Promise<boolean> {
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (permission.status !== 'granted') {
        return false;
      }
      const calendars = await Calendar.getCalendarsAsync();
      const primaryCalendar = calendars.find((calendar) => calendar.isPrimary) || calendars[0];
      if (!primaryCalendar) {
        return false;
      }
      for (const instance of instances) {
        const start = new Date(instance.dueDate);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        await Calendar.createEventAsync(primaryCalendar.id, {
          title: `${title}`,
          startDate: start,
          endDate: end,
          notes: `Amount: ₦${instance.amount?.toLocaleString() || 0}`,
        });
      }
      return true;
    } catch (error) {
      console.warn('[NativeBridge] calendar sync failed', error);
      return false;
    }
  }

  async removeFromCalendar(instanceIds: string[]): Promise<void> {
    console.log(`[NativeBridge] remove calendar entries: ${instanceIds.join(',')}`);
  }

  async scanReceipt(): Promise<{ amount: number; merchant: string; date: string } | null> {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled) {
        return null;
      }
      return {
        amount: 5000,
        merchant: 'Sample Store',
        date: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('[NativeBridge] scan failed', error);
      return null;
    }
  }

  async scanProductImage(): Promise<{ name: string; price?: number; details?: string } | null> {
    return this.scanReceipt() ? { name: 'Sample Product', price: 24.99, details: 'Mock OCR result' } : null;
  }
}

export default ExpoBridge;
