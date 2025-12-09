'use client';

import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/use-notifications';
import { MessageSquare, Flame, Check, AlertCircle, Info, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Notification } from '@/lib/types';
import { deleteNotification } from '@/lib/data';
import { toast } from 'sonner';

interface NotificationWithRelativeTime extends Notification {
  relativeTime?: string;
}

export function NotificationBell() {
  const { notifications: rawNotifications, unreadCount, markAsRead } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationWithRelativeTime[]>([]);
  const recentNotifications = notifications.slice(0, 5);

  // Calculate relative times on client side to prevent hydration mismatch
  useEffect(() => {
    const updateRelativeTimes = () => {
      setNotifications(rawNotifications.map(notif => ({
        ...notif,
        relativeTime: formatRelativeTime(notif.createdAt)
      })));
    };

    updateRelativeTimes();
    // Update every minute
    const interval = setInterval(updateRelativeTimes, 60000);
    return () => clearInterval(interval);
  }, [rawNotifications]);

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await deleteNotification(notificationId);
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Powiadomienie usunięte');
    } catch (error) {
      toast.error('Nie udało się usunąć powiadomienia');
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment_reply':
        return <MessageSquare className="h-4 w-4 text-blue-600" />;
      case 'new_deal':
        return <Flame className="h-4 w-4 text-orange-500" />;
      case 'deal_approved':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'deal_rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'system':
        return <Info className="h-4 w-4 text-gray-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationBgClass = (type: string) => {
    switch (type) {
      case 'comment_reply':
        return 'bg-blue-100 dark:bg-blue-900/20';
      case 'new_deal':
        return 'bg-orange-100 dark:bg-orange-900/20';
      case 'deal_approved':
        return 'bg-green-100 dark:bg-green-900/20';
      case 'deal_rejected':
        return 'bg-red-100 dark:bg-red-900/20';
      case 'system':
        return 'bg-gray-100 dark:bg-gray-900/20';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / 60000);

    if (diffInMinutes < 1) return 'przed chwilą';
    if (diffInMinutes < 60) return `${diffInMinutes} min temu`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} godz. temu`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} dni temu`;
    
    return notificationDate.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Powiadomienia</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="font-semibold text-sm">Powiadomienia</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} nowych
            </Badge>
          )}
        </div>
        <Separator />
        
        {recentNotifications.length > 0 ? (
          <>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 p-2">
                {recentNotifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        getNotificationBgClass(notification.type)
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1 line-clamp-1">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {notification.relativeTime || ''}
                          </span>
                          <div className="flex items-center gap-1">
                            {notification.link && (
                              <Link 
                                href={notification.link}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                onClick={() => !notification.read && markAsRead(notification.id)}
                              >
                                <span>Zobacz</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDeleteNotification(e, notification.id)}
                              title="Usuń powiadomienie"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {!notification.read && (
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary" title="Nieprzeczytane" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-2">
              <Link href="/profile?tab=notifications">
                <Button variant="ghost" className="w-full text-sm" size="sm">
                  Zobacz wszystkie powiadomienia
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-12 px-4">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              Brak powiadomień
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
