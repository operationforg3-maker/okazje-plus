// Okazje+ PWA Service Worker
const CACHE_VERSION = 'okazjeplus-v1';
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-512x512.png',
  '/icon_okazjeplus.svg',
  '/favicon.ico',
];

// Instalacja Service Workera i precache podstawowych zasobów
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache failed:', err);
      })
  );
});

// Aktywacja i czyszczenie starych wersji cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('okazjeplus-') && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Obsługa żądań sieciowych (Fetch)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Obsługujemy tylko zapytania GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignorujemy zapytania spoza protokołu http/https (np. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Wykluczamy zapytania API, autoryzację Firebase, panel admina i analitykę
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('googletagmanager.com')
  ) {
    return;
  }

  // 1. Obsługa nawigacji (dokumenty HTML / strony) -> Network First z fallbackiem do offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cachedOffline = await cache.match('/offline.html');
        return cachedOffline || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // 2. Statyczne zasoby Next.js (_next/static) -> Cache First z dociąganiem z sieci
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Obrazy i ikony z domeny aplikacji -> Stale-While-Revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico)$/) || url.pathname.startsWith('/preview/'))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_VERSION).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
