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
  Timestamp,
  updateDoc,
  doc as firestoreDoc,
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
    const event: FirestoreAnalyticsEvent = {
      type,
      resourceType,
      resourceId,
      userId,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      }
    };

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

// ============================================
// M5: Enhanced Analytics & Session Tracking
// ============================================

import { SessionMetrics, KPISnapshot, HeatmapData } from './types';

/**
 * Start tracking a user session
 */
export async function startSession(userId?: string): Promise<string> {
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('analytics_session_id', sessionId);
      sessionStorage.setItem('session_start_time', new Date().toISOString());
      sessionStorage.setItem('session_page_views', '0');
    }

    const session: Omit<SessionMetrics, 'id'> = {
      sessionId,
      userId,
      startTime: new Date().toISOString(),
      pageViews: 0,
      interactions: {
        views: 0,
        clicks: 0,
        votes: 0,
        comments: 0,
        shares: 0,
        favorites: 0,
      },
      entryPage: typeof window !== 'undefined' ? window.location.pathname : '/',
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      device: getDeviceType(),
      converted: false,
    };

    await addDoc(collection(db, 'session_metrics'), session);
    return sessionId;
  } catch (error) {
    console.warn('Failed to start session tracking:', error);
    return 'error';
  }
}

/**
 * End a user session
 */
export async function endSession(sessionId: string): Promise<void> {
  try {
    const sessionsRef = collection(db, 'session_metrics');
    const q = query(sessionsRef, where('sessionId', '==', sessionId), firestoreLimit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const sessionDoc = snapshot.docs[0];
      const session = sessionDoc.data() as SessionMetrics;
      
      const endTime = new Date().toISOString();
      const startTime = new Date(session.startTime);
      const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);

      await updateDoc(firestoreDoc(db, 'session_metrics', sessionDoc.id), {
        endTime,
        durationSeconds,
        exitPage: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('analytics_session_id');
      sessionStorage.removeItem('session_start_time');
      sessionStorage.removeItem('session_page_views');
    }
  } catch (error) {
    console.warn('Failed to end session:', error);
  }
}

/**
 * Record page view in current session
 */
export async function recordPageView(sessionId: string, page: string): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      const pageViews = parseInt(sessionStorage.getItem('session_page_views') || '0') + 1;
      sessionStorage.setItem('session_page_views', String(pageViews));
    }

    const sessionsRef = collection(db, 'session_metrics');
    const q = query(sessionsRef, where('sessionId', '==', sessionId), firestoreLimit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const sessionDoc = snapshot.docs[0];
      const session = sessionDoc.data() as SessionMetrics;

      await updateDoc(firestoreDoc(db, 'session_metrics', sessionDoc.id), {
        pageViews: (session.pageViews || 0) + 1,
      });
    }
  } catch (error) {
    console.warn('Failed to record page view:', error);
  }
}

/**
 * Record interaction in current session
 */
export async function recordSessionInteraction(
  sessionId: string,
  type: 'view' | 'click' | 'vote' | 'comment' | 'share' | 'favorite'
): Promise<void> {
  try {
    const sessionsRef = collection(db, 'session_metrics');
    const q = query(sessionsRef, where('sessionId', '==', sessionId), firestoreLimit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const sessionDoc = snapshot.docs[0];
      const session = sessionDoc.data() as SessionMetrics;

      const updatedInteractions = { ...session.interactions };
      updatedInteractions[type] = (updatedInteractions[type] || 0) + 1;

      const updates: any = {
        interactions: updatedInteractions,
      };

      // Mark as converted if click occurred
      if (type === 'click') {
        updates.converted = true;
      }

      await updateDoc(firestoreDoc(db, 'session_metrics', sessionDoc.id), updates);
    }
  } catch (error) {
    console.warn('Failed to record session interaction:', error);
  }
}

/**
 * Get device type from user agent
 */
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent.toLowerCase();
  
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    return 'tablet';
  } else if (/windows|macintosh|linux/i.test(ua)) {
    return 'desktop';
  }
  
  return 'unknown';
}

/**
 * Calculate KPI snapshot for a given period
 */
export async function calculateKPISnapshot(
  period: 'hourly' | 'daily' | 'weekly' | 'monthly',
  startDate: Date,
  endDate: Date
): Promise<KPISnapshot> {
  try {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // Get all sessions in period
    const sessionsRef = collection(db, 'session_metrics');
    const sessionsQuery = query(
      sessionsRef,
      where('startTime', '>=', startISO),
      where('startTime', '<', endISO)
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const sessions = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SessionMetrics));

    // Get all analytics events in period
    const analyticsQuery = query(
      collection(db, 'analytics'),
      where('timestamp', '>=', startISO),
      where('timestamp', '<', endISO)
    );
    const analyticsSnapshot = await getDocs(analyticsQuery);
    const events = analyticsSnapshot.docs.map(doc => doc.data() as FirestoreAnalyticsEvent);

    // Calculate metrics
    const uniqueUserIds = new Set<string>();
    const newUserIds = new Set<string>();
    const returningUserIds = new Set<string>();
    
    let totalPageViews = 0;
    let totalSessionDuration = 0;
    let sessionsWithDuration = 0;
    let bounced = 0;
    let totalInteractions = 0;

    sessions.forEach(session => {
      if (session.userId) {
        uniqueUserIds.add(session.userId);
        // Would need historical data to determine new vs returning
      }
      
      totalPageViews += session.pageViews || 0;
      
      if (session.durationSeconds) {
        totalSessionDuration += session.durationSeconds;
        sessionsWithDuration++;
      }

      // Bounce = single page view and < 30 seconds
      if (session.pageViews === 1 && (session.durationSeconds || 0) < 30) {
        bounced++;
      }

      // Count interactions
      const interactions = session.interactions || {
        views: 0, clicks: 0, votes: 0, comments: 0, shares: 0, favorites: 0
      };
      totalInteractions += Object.values(interactions).reduce((a, b) => a + b, 0);
    });

    const totalSessions = sessions.length;
    const avgSessionDuration = sessionsWithDuration > 0
      ? totalSessionDuration / sessionsWithDuration
      : 0;
    const bounceRate = totalSessions > 0 ? (bounced / totalSessions) * 100 : 0;
    const avgPagesPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

    // Calculate CTR and conversion
    const views = events.filter(e => e.type === 'view').length;
    const clicks = events.filter(e => e.type === 'click').length;
    const ctr = views > 0 ? (clicks / views) * 100 : 0;
    const conversionRate = totalSessions > 0 ? (clicks / totalSessions) * 100 : 0;

    // Get top content
    const dealStats: Record<string, { views: number; clicks: number }> = {};
    const productStats: Record<string, { views: number; clicks: number }> = {};
    const categoryStats: Record<string, number> = {};

    events.forEach(event => {
      if (event.resourceType === 'deal') {
        if (!dealStats[event.resourceId]) {
          dealStats[event.resourceId] = { views: 0, clicks: 0 };
        }
        if (event.type === 'view') dealStats[event.resourceId].views++;
        if (event.type === 'click') dealStats[event.resourceId].clicks++;
      } else if (event.resourceType === 'product') {
        if (!productStats[event.resourceId]) {
          productStats[event.resourceId] = { views: 0, clicks: 0 };
        }
        if (event.type === 'view') productStats[event.resourceId].views++;
        if (event.type === 'click') productStats[event.resourceId].clicks++;
      }

      if (event.metadata?.categorySlug) {
        categoryStats[event.metadata.categorySlug] = 
          (categoryStats[event.metadata.categorySlug] || 0) + 1;
      }
    });

    const topDeals = Object.entries(dealStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const topProducts = Object.entries(productStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const topCategories = Object.entries(categoryStats)
      .map(([slug, views]) => ({ slug, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const snapshot: Omit<KPISnapshot, 'id'> = {
      period,
      timestamp: new Date().toISOString(),
      startDate: startISO,
      endDate: endISO,
      metrics: {
        totalUsers: uniqueUserIds.size,
        activeUsers: uniqueUserIds.size,
        newUsers: newUserIds.size,
        returningUsers: returningUserIds.size,
        totalSessions,
        avgSessionDuration,
        pageViews: totalPageViews,
        uniquePageViews: totalPageViews, // Simplified
        bounceRate,
        avgPagesPerSession,
        totalInteractions,
        ctr,
        conversionRate,
        retentionRate: 0, // Would need historical cohort analysis
        churnRate: 0, // Would need historical cohort analysis
      },
      topContent: {
        topDeals,
        topProducts,
        topCategories,
      },
      generatedAt: new Date().toISOString(),
    };

    // Store snapshot
    const snapshotDoc = await addDoc(collection(db, 'kpi_snapshots'), snapshot);
    
    return {
      id: snapshotDoc.id,
      ...snapshot,
    } as KPISnapshot;
  } catch (error) {
    console.error('Failed to calculate KPI snapshot:', error);
    throw error;
  }
}

/**
 * Get latest KPI snapshot
 */
export async function getLatestKPISnapshot(
  period: 'hourly' | 'daily' | 'weekly' | 'monthly'
): Promise<KPISnapshot | null> {
  try {
    const snapshotsRef = collection(db, 'kpi_snapshots');
    const q = query(
      snapshotsRef,
      where('period', '==', period),
      orderBy('timestamp', 'desc'),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as KPISnapshot;
  } catch (error) {
    console.error('Failed to get latest KPI snapshot:', error);
    return null;
  }
}

/**
 * Record heatmap click data
 */
export async function recordHeatmapClick(
  pageType: HeatmapData['pageType'],
  pageId: string | undefined,
  x: number,
  y: number,
  element?: string
): Promise<void> {
  try {
    // Store click in temporary collection for aggregation
    await addDoc(collection(db, 'heatmap_clicks'), {
      pageType,
      pageId,
      x,
      y,
      element,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to record heatmap click:', error);
  }
}

/**
 * Record scroll depth
 */
export async function recordScrollDepth(
  pageType: HeatmapData['pageType'],
  pageId: string | undefined,
  depth: number
): Promise<void> {
  try {
    const sessionId = typeof window !== 'undefined'
      ? sessionStorage.getItem('analytics_session_id')
      : null;

    if (sessionId) {
      await addDoc(collection(db, 'scroll_depths'), {
        sessionId,
        pageType,
        pageId,
        depth,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn('Failed to record scroll depth:', error);
  }
}
