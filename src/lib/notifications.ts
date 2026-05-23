export interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
}

/**
 * Universal notification bridge.
 * If running in a standard web browser, it falls back to Web Notifications API.
 * If running inside an Expo WebView (e.g. wrapper), it sends a message to the native layer
 * to trigger local push notifications.
 */
export const triggerNotification = (payload: NotificationPayload) => {
  // 1. Check if we're wrapped in an Expo React Native WebView
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'SCHEDULE_NOTIFICATION',
      payload
    }));
    return;
  }

  // 2. Fallback to Web Browser Notification API
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(payload.title, { body: payload.body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(payload.title, { body: payload.body });
      }
    });
  }
};

/**
 * Helper to check upcoming payments and dispatch notifications 
 * if they are due today or exactly 1 day away.
 */
export const checkUpcomingPaymentNotifications = (payments: any[]) => {
  if (!payments || payments.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  payments.forEach(payment => {
    const dueDate = new Date(payment.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysAway = Math.round(timeDiff / (1000 * 3600 * 24));

    // A simple guard to prevent spamming notifications (in a real app, track sent IDs in localStorage)
    const storageKey = `notified_${payment.id}_${daysAway}`;
    if (localStorage.getItem(storageKey)) return;

    if (daysAway === 1) {
      triggerNotification({
        title: 'Upcoming Payment Tomorrow! 📅',
        body: `Reminder: Your payment for ${payment.name || payment.title || 'a bill'} is due tomorrow.`,
        data: { paymentId: payment.id }
      });
      localStorage.setItem(storageKey, 'true');
    } else if (daysAway === 0) {
      triggerNotification({
        title: 'Payment Due Today! ⚠️',
        body: `Your payment for ${payment.name || payment.title || 'a bill'} is due today.`,
        data: { paymentId: payment.id }
      });
      localStorage.setItem(storageKey, 'true');
    }
  });
};
