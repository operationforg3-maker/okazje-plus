'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { formatTimeAgo } from '@/lib/format-relative-time';
import { getUnreadNotifications, markNotificationAsRead } from '@/lib/data';
import { Notification } from '@/lib/types';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSmartPoll } from '@/hooks/use-smart-poll';

interface NotificationWithRelativeTime extends Notification {
  relativeTime?: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationWithRelativeTime[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const fetchNotifications = useCallback(async () => {
    if (!user) return [] as Notification[];
    return getUnreadNotifications(user.uid);
  }, [user]);

  const unread = useSmartPoll(fetchNotifications, {
    interval: 30000,
    immediate: !!user,
  });

  useEffect(() => {
    if (!unread) return;
    setNotifications(unread as NotificationWithRelativeTime[]);
    setUnreadCount(unread.length);
  }, [unread]);

  // Calculate relative times on client side to prevent hydration mismatch
  useEffect(() => {
    const updateRelativeTimes = () => {
      setNotifications(prev => prev.map(notif => ({
        ...notif,
        relativeTime: getRelativeTime(notif.createdAt)
      })));
    };

    updateRelativeTimes();
    // Update every minute
    const interval = setInterval(updateRelativeTimes, 60000);
    return () => clearInterval(interval);
  }, [notifications.length]);

  const handleNotificationClick = async (notification: Notification) => {
    try {
      await markNotificationAsRead(notification.id);
      
      // Usuń z listy lokalnej
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      setIsOpen(false);
    } catch (error) {
      toast.error('Nie udało się oznaczyć powiadomienia');
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationLink = (notification: Notification): string => {
    // Używamy link lub konstruujemy z itemId i itemType
    if (notification.link) return notification.link;
    
    if (notification.itemId && notification.itemType) {
      return `/${notification.itemType}s/${notification.itemId}`;
    }
    
    return '/';
  };

  const getNotificationIcon = (type: Notification['type']): string => {
    switch (type) {
      case 'comment_reply':
        return '💬';      case 'forum_mention':
        return '👤';      case 'deal_approved':
        return '✅';
      case 'deal_rejected':
        return '❌';
      case 'new_deal':
        return '🎯';
      case 'system':
        return '🔔';
      default:
        return '�';
    }
  };

  const t = useTranslations('common');
  function getRelativeTime(isoDate: string): string {
    return formatTimeAgo(isoDate, t) || new Date(isoDate).toLocaleDateString();
  }

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Powiadomienia">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              aria-label={`${unreadCount} nowych powiadomień`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t('notifications')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Brak nowych powiadomień
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            {notifications.map(notification => (
              <DropdownMenuItem
                key={notification.id}
                asChild
                className="cursor-pointer"
              >
                <Link
                  href={getNotificationLink(notification)}
                  onClick={() => handleNotificationClick(notification)}
                  className="flex items-start gap-3 p-3"
                >
                  <span className="text-xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notification.relativeTime || ''}
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
