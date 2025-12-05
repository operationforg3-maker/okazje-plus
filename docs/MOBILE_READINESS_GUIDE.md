# 📱 Mobile App Readiness Guide
## Przygotowanie Okazje Plus do aplikacji Android/iOS

> **Data**: 5 grudnia 2025  
> **Cel**: Dokumentacja gotowości platformy do rozwoju mobilnego

---

## 📊 Executive Summary

### Aktualny Stan Mobilny

| Element | Status | Gotowość |
|---------|--------|----------|
| **Responsive Web** | ✅ | 100% |
| **PWA Ready** | ⚠️ | 30% - wymaga pracy |
| **API for Native** | ✅ | 95% - ready |
| **Firebase SDK** | ✅ | 100% - kompatybilne |
| **TypeScript Types** | ✅ | 100% - exportowalne |

### Rekomendowane Ścieżki

| Opcja | Czas do MVP | Koszt | Zalety |
|-------|-------------|-------|--------|
| **1. PWA** | 1-2 dni | Niski | Szybki, jeden codebase |
| **2. Capacitor** | 1-2 tygodnie | Średni | Native features, jeden codebase |
| **3. React Native** | 1-2 miesiące | Wysoki | Pełna native experience |
| **4. Flutter** | 2-3 miesiące | Wysoki | Cross-platform, nowy codebase |

---

## 🌐 Opcja 1: Progressive Web App (PWA)

### Co już mamy ✅

```typescript
// next.config.ts - responsive images
images: {
  remotePatterns: [...], // Already configured
}

// Tailwind - mobile-first
// Wszystkie komponenty używają responsive classes
// sm:, md:, lg:, xl: breakpoints
```

### Co trzeba dodać 📋

#### 1. Web App Manifest (`public/manifest.json`)

```json
{
  "name": "Okazje Plus",
  "short_name": "Okazje+",
  "description": "Najlepsze okazje i produkty w Polsce",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#E3F2FD",
  "theme_color": "#2979FF",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/mobile-home.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/desktop-home.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "categories": ["shopping", "lifestyle"],
  "lang": "pl-PL",
  "dir": "ltr"
}
```

#### 2. Service Worker (`public/sw.js`)

```javascript
const CACHE_NAME = 'okazje-plus-v1';
const STATIC_ASSETS = [
  '/',
  '/deals',
  '/products',
  '/manifest.json',
  '/icons/icon-192x192.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests (always fresh)
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        // Update cache in background
        fetch(event.request).then((freshResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, freshResponse);
          });
        });
        return response;
      }
      
      // Fetch from network
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

#### 3. Meta Tags (`src/app/layout.tsx`)

```tsx
// Dodać do <head>
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2979FF" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Okazje+" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
```

#### 4. Service Worker Registration

```tsx
// src/components/pwa-register.tsx
'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
        });
    }
  }, []);

  return null;
}
```

### Szacowany Czas: 1-2 dni

---

## 📦 Opcja 2: Capacitor (Ionic)

### Dlaczego Capacitor?

- ✅ Używa istniejącego Next.js kodu
- ✅ Native APIs (kamera, geolokalizacja, push notifications)
- ✅ Publikacja w App Store / Google Play
- ✅ Hot reload podczas developmentu
- ✅ Mniejszy overhead niż React Native

### Setup

```bash
# Instalacja
npm install @capacitor/core @capacitor/cli
npx cap init "Okazje Plus" "plus.okazje.app"

# Platformy
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# Przydatne pluginy
npm install @capacitor/push-notifications
npm install @capacitor/share
npm install @capacitor/haptics
npm install @capacitor/status-bar
```

### Konfiguracja (`capacitor.config.ts`)

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'plus.okazje.app',
  appName: 'Okazje Plus',
  webDir: 'out', // Static export z Next.js
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // Dla development:
    // url: 'http://192.168.x.x:9002',
    // cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#E3F2FD',
      showSpinner: true,
      spinnerColor: '#2979FF',
    },
  },
};

export default config;
```

### Next.js Static Export

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'export', // Dla Capacitor
  // ... reszta konfiguracji
};
```

### Build Process

```bash
# 1. Build Next.js
npm run build

# 2. Sync z Capacitor
npx cap sync

# 3. Otwórz w IDE
npx cap open android  # Android Studio
npx cap open ios      # Xcode
```

### Szacowany Czas: 1-2 tygodnie (z testowaniem)

---

## ⚛️ Opcja 3: React Native

### Architektura Reużycia

```
okazje-plus/
├── packages/
│   ├── shared/           # Wspólna logika
│   │   ├── types/        # Export z src/lib/types.ts
│   │   ├── api/          # API client
│   │   ├── hooks/        # Shared hooks (bez DOM)
│   │   └── utils/        # Helper functions
│   ├── web/              # Next.js app (current)
│   └── mobile/           # React Native app
```

### Reużywalne Elementy

| Element | Reużywalność | Uwagi |
|---------|--------------|-------|
| `types.ts` | 100% | Bezpośredni import |
| Firebase config | 90% | Różne SDK |
| API calls | 80% | Fetch vs native |
| Business logic | 90% | Hooks bez DOM |
| UI Components | 0% | Nowy design system |

### Firebase dla React Native

```bash
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/messaging
```

### Szacowany Czas: 1-2 miesiące

---

## 🎯 Rekomendacja

### Dla Szybkiego Startu: **PWA + Capacitor**

```
Faza 1 (1-2 dni):
└── PWA Implementation
    ├── manifest.json
    ├── Service Worker
    └── Meta tags

Faza 2 (1 tydzień):
└── Capacitor Wrapper
    ├── Android build
    ├── iOS build
    └── Push notifications

Faza 3 (opcjonalne):
└── Native Features
    ├── Haptics
    ├── Share sheet
    └── Biometrics
```

### Korzyści Tego Podejścia

1. **Jeden codebase** - mniej maintenance
2. **Szybkie iteracje** - web + mobile razem
3. **SEO zachowane** - web version nadal indeksowana
4. **Stopniowa migracja** - można dodawać native features

---

## 📋 Checklist: Mobile-Ready

### Responsive Design ✅
- [x] Mobile-first Tailwind classes
- [x] Touch-friendly button sizes (min 44px)
- [x] Responsive images (next/image)
- [x] Viewport meta tag
- [x] No horizontal scroll
- [x] Readable font sizes (16px+ base)

### Performance ✅
- [x] Image optimization
- [x] Code splitting (Next.js automatic)
- [x] Lazy loading
- [ ] Service Worker caching

### PWA Requirements ❌
- [ ] Web App Manifest
- [ ] Service Worker
- [ ] Offline page
- [ ] App icons (all sizes)
- [ ] Splash screens

### Native Considerations
- [x] API REST endpoints (27 available)
- [x] Firebase Auth (compatible)
- [x] Firestore (compatible)
- [x] TypeScript types (exportable)
- [ ] Push notification tokens
- [ ] Deep linking configuration

---

## 🔧 API dla Native Clients

### Dostępne Endpointy

```typescript
// Publiczne (bez auth)
GET  /api/search?q={query}
GET  /api/search/autocomplete?q={query}
GET  /api/trending
GET  /api/categories/{slug}/hot-deals
GET  /api/categories/{slug}/top-rated
GET  /api/categories/{slug}/trending

// Z Auth (Firebase ID Token w header)
POST /api/deals/{id}/vote
POST /api/comments
GET  /api/notifications
POST /api/favorites

// Admin (role check)
GET/POST /api/admin/*
```

### Auth Header

```typescript
// React Native example
const idToken = await firebase.auth().currentUser?.getIdToken();

const response = await fetch('https://api.okazje.plus/api/deals/123/vote', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ direction: 'up' }),
});
```

### Types Export

```bash
# Generowanie types dla native
npx tsc src/lib/types.ts --declaration --emitDeclarationOnly --outDir ./packages/shared/types
```

---

## 📱 Push Notifications

### Web Push (PWA)

```typescript
// Wymagane: Firebase Cloud Messaging setup
// 1. Dodać firebase-messaging-sw.js
// 2. Zarejestrować token w Firestore
// 3. Cloud Function do wysyłania

// src/lib/notifications-push.ts już istnieje
// Wymaga: VAPID key configuration
```

### Native Push (Capacitor/RN)

```typescript
// Capacitor
import { PushNotifications } from '@capacitor/push-notifications';

// Rejestracja
await PushNotifications.requestPermissions();
await PushNotifications.register();

// Listener
PushNotifications.addListener('registration', (token) => {
  // Zapisz token.value w Firestore
  saveTokenToFirestore(userId, token.value, 'fcm');
});
```

---

## 📊 Metryki Sukcesu Mobile

### KPIs do śledzenia

| Metryka | Cel | Jak mierzyć |
|---------|-----|-------------|
| Lighthouse PWA Score | >90 | Chrome DevTools |
| First Contentful Paint | <2s | Web Vitals |
| Time to Interactive | <3.5s | Web Vitals |
| Install Rate (PWA) | >5% | Custom analytics |
| Push Notification CTR | >10% | Firebase Analytics |
| App Store Rating | >4.0 | Store analytics |

---

## 🚀 Next Steps

### Natychmiastowe (1-2 dni)
1. Stworzyć `manifest.json`
2. Dodać Service Worker
3. Dodać PWA meta tags
4. Przetestować na mobile

### Krótkoterminowe (1-2 tygodnie)
1. Setup Capacitor
2. Build Android APK
3. Build iOS IPA
4. Testy na urządzeniach

### Średnioterminowe (1 miesiąc)
1. Publikacja w sklepach
2. Push notifications
3. Analytics mobile-specific
4. A/B testing install prompts

---

**Odpowiedzialny**: Frontend Team  
**Review**: Po implementacji PWA  
**Deadline PWA**: TBD
