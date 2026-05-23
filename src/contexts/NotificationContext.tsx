import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNativeBridge } from '../hooks/useNativeBridge';

export interface Notification {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  read: boolean;
  data?: any;
}

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { bridge } = useNativeBridge();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!bridge) return;
    setLoading(true);
    try {
      const list = await bridge.getNotifications();
      setNotifications(list || []);
      const count = await bridge.getUnreadCount();
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('[NotificationContext] Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [bridge]);

  const markAsRead = async (id: string) => {
    if (!bridge) return;
    try {
      await bridge.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[NotificationContext] Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!bridge) return;
    try {
      await bridge.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[NotificationContext] Error marking all as read:', error);
    }
  };

  useEffect(() => {
    if (bridge) {
      fetchNotifications();

      // Listen for push notifications arriving in foreground/background via native bridge
      if (bridge.onNotificationReceived) {
        bridge.onNotificationReceived((newNotif: any) => {
          if (!newNotif) return;
          console.log('[NotificationContext] Notification received via bridge:', newNotif);
          
          const formatted: Notification = {
            id: newNotif.id || 'notif-' + Date.now(),
            title: newNotif.title || 'New Notification',
            body: newNotif.body || '',
            receivedAt: newNotif.receivedAt || new Date().toISOString(),
            read: !!newNotif.read,
            data: newNotif.data
          };

          setNotifications(prev => {
            // Avoid duplicate additions
            if (prev.some(n => n.id === formatted.id)) return prev;
            return [formatted, ...prev];
          });
          
          if (!formatted.read) {
            setUnreadCount(prev => prev + 1);
          }
        });
      }
    }
  }, [bridge, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
