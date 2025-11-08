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
