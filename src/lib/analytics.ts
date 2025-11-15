/**
 * Google Analytics 4 helpers
 * Dokumentacja: https://developers.google.com/analytics/devguides/collection/ga4/events
 */

// Rozszerz interfejs Window o gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export const GA_TRACKING_ID = 'G-4M4NQB0PQD';

/**
 * Sprawdź czy GA jest dostępne
 */
export const isGAAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

/**
 * Wyślij event do Google Analytics
 */
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (!isGAAvailable()) {
    console.warn('Google Analytics nie jest dostępne');
    return;
  }

  window.gtag('event', eventName, eventParams);
};

/**
 * Wyślij event pageview (automatycznie trackowane przez Next.js router)
 */
export const trackPageView = (url: string) => {
  if (!isGAAvailable()) return;

  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

// ===========================================
// Custom Events dla Okazje Plus
// ===========================================

/**
 * Track głosowanie na okazję/produkt
 */
export const trackVote = (type: 'deal' | 'product', itemId: string, voteType: 'up' | 'down') => {
  trackEvent('vote', {
    content_type: type,
    item_id: itemId,
    vote_type: voteType,
  });
};

/**
 * Track wyświetlenie szczegółów okazji/produktu
 */
export const trackItemView = (type: 'deal' | 'product', itemId: string, categorySlug?: string) => {
  trackEvent('view_item', {
    content_type: type,
    item_id: itemId,
    category: categorySlug,
  });
};

/**
 * Track kliknięcie w link zewnętrzny (Go to Deal/Product)
 */
export const trackOutboundClick = (
  type: 'deal' | 'product',
  itemId: string,
  url: string,
  temperature?: number
) => {
  trackEvent('click', {
    content_type: type,
    item_id: itemId,
    outbound_url: url,
    temperature,
    event_category: 'outbound_link',
  });
};

/**
 * Track dodanie komentarza
 */
export const trackComment = (type: 'deal' | 'product', itemId: string) => {
  trackEvent('comment', {
    content_type: type,
    item_id: itemId,
  });
};

/**
 * Track wyszukiwanie
 */
export const trackSearch = (searchTerm: string, resultsCount?: number) => {
  trackEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount,
  });
};

/**
 * Track dodanie nowej okazji/produktu
 */
export const trackAddContent = (type: 'deal' | 'product', categorySlug?: string) => {
  trackEvent('add_content', {
    content_type: type,
    category: categorySlug,
  });
};

/**
 * Track logowanie użytkownika
 */
export const trackLogin = (method: string) => {
  trackEvent('login', {
    method,
  });
};

/**
 * Track rejestrację użytkownika
 */
export const trackSignUp = (method: string) => {
  trackEvent('sign_up', {
    method,
  });
};

/**
 * Track udostępnienie treści
 */
export const trackShare = (type: 'deal' | 'product', itemId: string, method: string) => {
  trackEvent('share', {
    content_type: type,
    item_id: itemId,
    method, // 'facebook', 'twitter', 'copy_link', etc.
  });
};

/**
 * Track filtrowanie według kategorii
 */
export const trackCategoryFilter = (mainCategory: string, subCategory?: string) => {
  trackEvent('filter_category', {
    main_category: mainCategory,
    sub_category: subCategory,
  });
};

/**
 * Track error events
 */
export const trackError = (errorName: string, errorMessage?: string) => {
  trackEvent('exception', {
    description: errorName,
    error_message: errorMessage,
    fatal: false,
  });
};

// ===========================================
// Firestore Analytics Tracking (for Admin Dashboard)
// ===========================================

import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getCountFromServer,
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';

export type FirestoreEventType = 'view' | 'click' | 'share' | 'favorite' | 'comment' | 'vote';
export type ResourceType = 'deal' | 'product';

export interface FirestoreAnalyticsEvent {
  type: FirestoreEventType;
  resourceType: ResourceType;
  resourceId: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  metadata?: {
    source?: string;
    referrer?: string;
    userAgent?: string;
    [key: string]: any;
  };
}

/**
 * Pobiera lub generuje session ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Śledzi zdarzenie w Firestore (dla statystyk admina)
 */
export async function trackFirestoreEvent(
  type: FirestoreEventType,
  resourceType: ResourceType,
  resourceId: string,
  userId?: string,
  metadata?: FirestoreAnalyticsEvent['metadata']
): Promise<void> {
  try {
    // Nie zapisuj pól z wartością undefined (Firestore tego nie akceptuje)
    const baseEvent: FirestoreAnalyticsEvent = {
      type,
      resourceType,
      resourceId,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      }
    } as any;

    if (userId) {
      (baseEvent as any).userId = userId;
    }

    const event: FirestoreAnalyticsEvent = baseEvent;

    await addDoc(collection(db, 'analytics'), event);
  } catch (error) {
    // Silent fail - nie przerywamy UX
    console.warn('Firestore analytics tracking failed:', error);
  }
}

/**
 * Śledzi wyświetlenie (debounced - 1x per session per resource)
 */
export async function trackFirestoreView(
  resourceType: ResourceType,
  resourceId: string,
  userId?: string
): Promise<void> {
  const viewKey = `viewed_${resourceType}_${resourceId}`;
  if (typeof window !== 'undefined' && sessionStorage.getItem(viewKey)) {
    return;
  }
  
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(viewKey, 'true');
  }
  
  await trackFirestoreEvent('view', resourceType, resourceId, userId);
  
  // Track też w GA
  trackItemView(resourceType, resourceId);
}

/**
 * Śledzi kliknięcie w link
 */
export async function trackFirestoreClick(
  resourceType: ResourceType,
  resourceId: string,
  userId?: string,
  url?: string
): Promise<void> {
  await trackFirestoreEvent('click', resourceType, resourceId, userId, { destination: url });
  
  // Track też w GA
  if (url) {
    trackOutboundClick(resourceType, resourceId, url);
  }
}

/**
 * Śledzi udostępnienie
 */
export async function trackFirestoreShare(
  resourceType: ResourceType,
  resourceId: string,
  userId?: string,
  platform?: string
): Promise<void> {
  await trackFirestoreEvent('share', resourceType, resourceId, userId, { platform });
  
  // Track też w GA
  trackShare(resourceType, resourceId, platform || 'unknown');
}

/**
 * Śledzi polubienie (favorite add/remove) - traktujemy każde dodanie jako event
 */
export async function trackFirestoreFavorite(
  resourceType: ResourceType,
  resourceId: string,
  userId?: string,
  action: 'add' | 'remove' = 'add'
): Promise<void> {
  // Rejestrujemy tylko dodania jako zdarzenia analityczne
  if (action === 'add') {
    await trackFirestoreEvent('favorite', resourceType, resourceId, userId, { action });
    trackEvent('favorite', { content_type: resourceType, item_id: resourceId });
  }
}

/**
 * Śledzi dodanie komentarza
 */
export async function trackFirestoreComment(
  resourceType: ResourceType,
  resourceId: string,
  userId?: string,
  length?: number
): Promise<void> {
  await trackFirestoreEvent('comment', resourceType, resourceId, userId, { length });
  trackComment(resourceType, resourceId);
}

/**
 * Śledzi głos (vote) - up/down
 */
export async function trackFirestoreVote(
  resourceType: ResourceType,
  resourceId: string,
  userId: string | undefined,
  direction: 'up' | 'down'
): Promise<void> {
  await trackFirestoreEvent('vote', resourceType, resourceId, userId, { direction });
  trackVote(resourceType, resourceId, direction);
}

// ===========================================
// FUNKCJE AGREGACJI DLA ADMINA
// ===========================================

export interface AnalyticsStats {
  views: number;
  clicks: number;
  shares: number;
  favorites: number;
  comments: number;
  votes: number;
  conversionRate: number;
  uniqueUsers: number;
}

/**
 * Pobiera globalne statystyki analytics dla dashboardu admina
 */
export async function getGlobalAnalytics(daysBack: number = 7): Promise<{
  totalViews: number;
  totalClicks: number;
  totalShares: number;
  avgConversionRate: number;
  uniqueUsers: number;
  uniqueSessions: number;
  viewsByDay: Array<{ date: string; count: number }>;
  topDeals: Array<{ id: string; views: number; clicks: number }>;
  topProducts: Array<{ id: string; views: number; clicks: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const analyticsQuery = query(
    collection(db, 'analytics'),
    where('timestamp', '>=', startDate.toISOString()),
    orderBy('timestamp', 'desc'),
    limit(10000)
  );

  const snapshot = await getDocs(analyticsQuery);
  const events = snapshot.docs.map(doc => doc.data() as FirestoreAnalyticsEvent);

  const totalViews = events.filter(e => e.type === 'view').length;
  const totalClicks = events.filter(e => e.type === 'click').length;
  const totalShares = events.filter(e => e.type === 'share').length;

  // Liczenie unikalnych użytkowników i sesji
  const uniqueUserIds = new Set<string>();
  const uniqueSessionIds = new Set<string>();
  events.forEach(event => {
    if (event.userId) uniqueUserIds.add(event.userId);
    if (event.sessionId) uniqueSessionIds.add(event.sessionId);
  });

  const avgConversionRate = totalViews > 0 
    ? Math.round((totalClicks / totalViews) * 1000) / 10 
    : 0;

  // Views by day
  const viewsByDay: Record<string, number> = {};
  events.filter(e => e.type === 'view').forEach(event => {
    const date = event.timestamp.split('T')[0];
    viewsByDay[date] = (viewsByDay[date] || 0) + 1;
  });

  const viewsByDayArray = Object.entries(viewsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top deals
  const dealStats: Record<string, { views: number; clicks: number }> = {};
  events.filter(e => e.resourceType === 'deal').forEach(event => {
    if (!dealStats[event.resourceId]) {
      dealStats[event.resourceId] = { views: 0, clicks: 0 };
    }
    if (event.type === 'view') dealStats[event.resourceId].views++;
    if (event.type === 'click') dealStats[event.resourceId].clicks++;
  });

  const topDeals = Object.entries(dealStats)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Top products
  const productStats: Record<string, { views: number; clicks: number }> = {};
  events.filter(e => e.resourceType === 'product').forEach(event => {
    if (!productStats[event.resourceId]) {
      productStats[event.resourceId] = { views: 0, clicks: 0 };
    }
    if (event.type === 'view') productStats[event.resourceId].views++;
    if (event.type === 'click') productStats[event.resourceId].clicks++;
  });

  const topProducts = Object.entries(productStats)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    totalViews,
    totalClicks,
    totalShares,
    avgConversionRate,
    uniqueUsers: uniqueUserIds.size,
    uniqueSessions: uniqueSessionIds.size,
    viewsByDay: viewsByDayArray,
    topDeals,
    topProducts
  };
}

/**
 * Pobiera count eventów dla danego typu
 */
export async function getEventCount(
  type: FirestoreEventType,
  resourceType?: ResourceType,
  daysBack: number = 7
): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  let q = query(
    collection(db, 'analytics'),
    where('type', '==', type),
    where('timestamp', '>=', startDate.toISOString())
  );

  if (resourceType) {
    q = query(q, where('resourceType', '==', resourceType));
  }

  const countSnapshot = await getCountFromServer(q);
  return countSnapshot.data().count;
}
