"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  getNotifications, 
  getUnreadNotificationsCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification 
} from '@/lib/data';
import { Notification } from '@/lib/types';
import { toast } from 'sonner';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotif: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

/**
 * Hook do zarządzania powiadomieniami użytkownika
 */
export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const [notifs, count] = await Promise.all([
        getNotifications(user.uid, 50),
        getUnreadNotificationsCount(user.uid)
      ]);
      
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Błąd podczas pobierania powiadomień');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    
    // Odświeżaj co 30 sekund
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      
      // Aktualizuj lokalny stan
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Błąd podczas oznaczania powiadomienia');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      await markAllNotificationsAsRead(user.uid);
      
      // Aktualizuj lokalny stan
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('Wszystkie powiadomienia oznaczone jako przeczytane');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Błąd podczas oznaczania powiadomień');
    }
  }, [user]);

  const deleteNotif = useCallback(async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      
      // Aktualizuj lokalny stan
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      toast.success('Powiadomienie usunięte');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Błąd podczas usuwania powiadomienia');
    }
  }, [notifications]);

  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotif,
    refreshNotifications,
  };
}
