"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  setNotificationPreference,
  getNotificationPreference,
  subscribeToTopic,
  unsubscribeFromTopic,
  getSubscribedTopics,
  showNotification,
} from '@/lib/notifications-push';

interface NotificationTopic {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const NOTIFICATION_TOPICS: NotificationTopic[] = [
  {
    id: 'price-drops',
    name: 'Spadki cen',
    description: 'Powiadomienia o spadkach cen ulubionych produktów',
    icon: '💰',
  },
  {
    id: 'new-deals',
    name: 'Nowe okazje',
    description: 'Nowe okazje w Twoich ulubionych kategoriach',
    icon: '✨',
  },
  {
    id: 'comment-replies',
    name: 'Odpowiedzi',
    description: 'Odpowiedzi na Twoje komentarze',
    icon: '💬',
  },
  {
    id: 'deal-expiring',
    name: 'Wygasające okazje',
    description: 'Przypomnienia o wygasających okazjach',
    icon: '⏰',
  },
  {
    id: 'achievements',
    name: 'Osiągnięcia',
    description: 'Odznaki, poziomy i nagrody',
    icon: '🏆',
  },
  {
    id: 'weekly-digest',
    name: 'Tygodniowe podsumowanie',
    description: 'Najlepsze okazje tygodnia',
    icon: '📧',
  },
];

export function NotificationSettingsCard() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    setIsSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
    setEnabled(getNotificationPreference());
    setSubscribedTopics(getSubscribedTopics());
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      setPermission(getNotificationPermission());
      
      if (granted) {
        setEnabled(true);
        setNotificationPreference(true);
        toast.success('Powiadomienia włączone!');
        
        // Show test notification
        await showNotification({
          title: '🎉 Powiadomienia aktywne!',
          body: 'Będziesz otrzymywać powiadomienia o najlepszych okazjach',
          icon: '/icon-192x192.png',
        });
      } else {
        toast.error('Powiadomienia zostały zablokowane. Zmień ustawienia w przeglądarce.');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Wystąpił błąd podczas włączania powiadomień');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    setNotificationPreference(checked);
    toast.success(checked ? 'Powiadomienia włączone' : 'Powiadomienia wyłączone');
  };

  const handleToggleTopic = async (topicId: string, subscribe: boolean) => {
    try {
      if (subscribe) {
        await subscribeToTopic(topicId);
        setSubscribedTopics([...subscribedTopics, topicId]);
        toast.success('Subskrypcja aktywna');
      } else {
        await unsubscribeFromTopic(topicId);
        setSubscribedTopics(subscribedTopics.filter(t => t !== topicId));
        toast.success('Subskrypcja anulowana');
      }
    } catch (error) {
      console.error('Error toggling topic:', error);
      toast.error('Wystąpił błąd');
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Powiadomienia
          </CardTitle>
          <CardDescription>
            Twoja przeglądarka nie obsługuje powiadomień push
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Powiadomienia
        </CardTitle>
        <CardDescription>
          Zarządzaj powiadomieniami o okazjach i aktywności
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">Status powiadomień</p>
              {permission === 'granted' && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  Aktywne
                </Badge>
              )}
              {permission === 'denied' && (
                <Badge variant="destructive" className="gap-1">
                  <X className="h-3 w-3" />
                  Zablokowane
                </Badge>
              )}
              {permission === 'default' && (
                <Badge variant="outline">Nieaktywne</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {permission === 'granted' && 'Powiadomienia są włączone'}
              {permission === 'denied' && 'Zmień ustawienia w przeglądarce, aby włączyć powiadomienia'}
              {permission === 'default' && 'Kliknij poniżej, aby włączyć powiadomienia'}
            </p>
          </div>
          {permission === 'default' && (
            <Button onClick={handleRequestPermission} disabled={isRequesting}>
              {isRequesting ? 'Włączam...' : 'Włącz powiadomienia'}
            </Button>
          )}
          {permission === 'granted' && (
            <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
          )}
        </div>

        {/* Topics */}
        {permission === 'granted' && enabled && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Rodzaje powiadomień</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Wybierz, o czym chcesz być informowany
              </p>
            </div>

            <div className="space-y-3">
              {NOTIFICATION_TOPICS.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{topic.icon}</span>
                    <div>
                      <Label htmlFor={`topic-${topic.id}`} className="font-medium cursor-pointer">
                        {topic.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {topic.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={`topic-${topic.id}`}
                    checked={subscribedTopics.includes(topic.id)}
                    onCheckedChange={(checked) => handleToggleTopic(topic.id, checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Powiadomienia wymagają włączenia w przeglądarce</p>
          <p>• Możesz je wyłączyć w każdej chwili</p>
          <p>• Nie wysyłamy spamu - tylko ważne informacje</p>
        </div>
      </CardContent>
    </Card>
  );
}
