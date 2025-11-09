'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
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

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const unread = await getUnreadNotifications(user.uid);
        setNotifications(unread);
        setUnreadCount(unread.length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();

    // Poll co 30 sekund dla nowych powiadomień
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

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
        return '💬';
      case 'deal_approved':
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

  function getRelativeTime(isoDate: string): string {
    const now = new Date();
    const posted = new Date(isoDate);
    const diffMs = now.getTime() - posted.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'teraz';
    if (diffMinutes < 60) return `${diffMinutes} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays === 1) return 'wczoraj';
    if (diffDays < 7) return `${diffDays} dni temu`;
    return new Date(isoDate).toLocaleDateString('pl-PL');
  }

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Powiadomienia</DropdownMenuLabel>
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
                      {getRelativeTime(notification.createdAt)}
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
