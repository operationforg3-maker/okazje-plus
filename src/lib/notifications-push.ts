"use client";

/**
 * Web Push Notifications System
 * Handles browser notification permissions and display
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Check current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('Browser does not support notifications');
    return false;
  }

  // Already granted
  if (Notification.permission === 'granted') {
    return true;
  }

  // Already denied - can't request again
  if (Notification.permission === 'denied') {
    console.warn('Notification permission was denied');
    return false;
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Show a browser notification
 */
export async function showNotification(payload: NotificationPayload): Promise<Notification | null> {
  if (!isNotificationSupported()) {
    console.warn('Browser does not support notifications');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
      tag: payload.tag,
      data: payload.data,
      silent: false,
    } as NotificationOptions);

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      
      // Open app or specific page
      if (payload.data?.url) {
        window.open(payload.data.url, '_blank');
      } else {
        window.focus();
      }
      
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}

/**
 * Show notification for price drop
 */
export async function notifyPriceDrop(
  itemName: string,
  oldPrice: number,
  newPrice: number,
  itemType: 'deal' | 'product',
  itemId: string
): Promise<void> {
  const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  
  await showNotification({
    title: '🔥 Spadek ceny!',
    body: `${itemName} - taniej o ${discount}%! (${newPrice.toFixed(2)} zł)`,
    icon: '/icon-192x192.png',
    tag: `price-drop-${itemId}`,
    data: {
      url: `/${itemType === 'deal' ? 'deals' : 'products'}/${itemId}`,
      type: 'price-drop',
      itemId,
      itemType,
    },
  });
}

/**
 * Show notification for new deal in favorite category
 */
export async function notifyNewDealInCategory(
  dealTitle: string,
  categoryName: string,
  dealId: string
): Promise<void> {
  await showNotification({
    title: `✨ Nowa okazja w ${categoryName}`,
    body: dealTitle,
    icon: '/icon-192x192.png',
    tag: `new-deal-${dealId}`,
    data: {
      url: `/deals/${dealId}`,
      type: 'new-deal',
      dealId,
    },
  });
}

/**
 * Show notification for comment reply
 */
export async function notifyCommentReply(
  authorName: string,
  itemTitle: string,
  itemType: 'deal' | 'product',
  itemId: string
): Promise<void> {
  await showNotification({
    title: '💬 Nowa odpowiedź',
    body: `${authorName} odpowiedział na Twój komentarz w "${itemTitle}"`,
    icon: '/icon-192x192.png',
    tag: `reply-${itemId}`,
    data: {
      url: `/${itemType === 'deal' ? 'deals' : 'products'}/${itemId}#comments`,
      type: 'comment-reply',
      itemId,
    },
  });
}

/**
 * Show notification for deal expiring soon
 */
export async function notifyDealExpiring(
  dealTitle: string,
  expiresIn: string,
  dealId: string
): Promise<void> {
  await showNotification({
    title: '⏰ Okazja wygasa niedługo!',
    body: `${dealTitle} - zostało ${expiresIn}`,
    icon: '/icon-192x192.png',
    tag: `expiring-${dealId}`,
    data: {
      url: `/deals/${dealId}`,
      type: 'deal-expiring',
      dealId,
    },
  });
}

/**
 * Show notification for achievement/badge earned
 */
export async function notifyAchievement(
  badgeName: string,
  badgeDescription: string,
  badgeIcon: string
): Promise<void> {
  await showNotification({
    title: '🏆 Nowe osiągnięcie!',
    body: `${badgeName} - ${badgeDescription}`,
    icon: '/icon-192x192.png',
    tag: `achievement-${badgeName}`,
    data: {
      url: '/profile',
      type: 'achievement',
    },
  });
}

/**
 * Show notification for level up
 */
export async function notifyLevelUp(
  newLevel: number,
  levelName: string,
  levelIcon: string
): Promise<void> {
  await showNotification({
    title: '🎉 Awans na nowy poziom!',
    body: `Gratulacje! Osiągnąłeś poziom ${newLevel}: ${levelName}`,
    icon: '/icon-192x192.png',
    tag: `level-up-${newLevel}`,
    data: {
      url: '/profile',
      type: 'level-up',
      level: newLevel,
    },
  });
}

/**
 * Store notification preference in localStorage
 */
export function setNotificationPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('notificationsEnabled', enabled ? 'true' : 'false');
}

/**
 * Get notification preference from localStorage
 */
export function getNotificationPreference(): boolean {
  if (typeof window === 'undefined') return false;
  const preference = localStorage.getItem('notificationsEnabled');
  return preference === 'true';
}

/**
 * Subscribe to topic-based notifications (for future FCM integration)
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  // Placeholder for future Firebase Cloud Messaging integration
  console.log(`Subscribed to topic: ${topic}`);
  
  // Store subscription in localStorage for now
  if (typeof window === 'undefined') return;
  const topics = getSubscribedTopics();
  if (!topics.includes(topic)) {
    topics.push(topic);
    localStorage.setItem('notificationTopics', JSON.stringify(topics));
  }
}

/**
 * Unsubscribe from topic
 */
export async function unsubscribeFromTopic(topic: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const topics = getSubscribedTopics();
  const filtered = topics.filter(t => t !== topic);
  localStorage.setItem('notificationTopics', JSON.stringify(filtered));
}

/**
 * Get subscribed topics
 */
export function getSubscribedTopics(): string[] {
  if (typeof window === 'undefined') return [];
  const topics = localStorage.getItem('notificationTopics');
  return topics ? JSON.parse(topics) : [];
}
