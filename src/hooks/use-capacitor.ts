'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Hook integrujący natywne funkcje Capacitor (Android / iOS) z aplikacją Next.js
 */
export function useCapacitor() {
  const router = useRouter();

  useEffect(() => {
    // Sprawdzamy, czy aplikacja działa w natywnym środowisku Capacitor (iOS/Android)
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. Ukryj Splash Screen po załadowaniu Reacta
    SplashScreen.hide().catch(() => {});

    // 2. Konfiguracja Status Bara (ciemny motyw / dopasowanie do tła)
    const configureStatusBar = async () => {
      try {
        const isDark = document.documentElement.classList.contains('dark') ||
                       document.documentElement.getAttribute('data-mode') === 'dark';
        
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light,
        });

        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({
            color: isDark ? '#090d16' : '#ffffff',
          });
        }
      } catch (e) {
        // Ignoruj błędy na platformach bez obsługi status bara
      }
    };

    configureStatusBar();

    // Obserwuj zmiany motywu w HTML
    const observer = new MutationObserver(() => {
      configureStatusBar();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-mode', 'data-theme'],
    });

    // 3. Obsługa sprzętowego przycisku 'Wstecz' na Androidzie
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (window.location.pathname === '/' || window.location.pathname === '/pl') {
        // Jeśli jesteśmy na stronie głównej, minimalizuj aplikację
        CapacitorApp.minimizeApp();
      } else if (canGoBack || window.history.length > 1) {
        // Cofnij w historii Next.js
        window.history.back();
      } else {
        router.push('/');
      }
    });

    // 4. Obsługa Deep Linków (otwieranie linków w aplikacji)
    const appUrlListener = CapacitorApp.addListener('appUrlOpen', (data) => {
      try {
        const url = new URL(data.url);
        const path = url.pathname + url.search + url.hash;
        if (path) {
          router.push(path);
        }
      } catch (e) {
        console.error('Błąd parsowania Deep Link:', e);
      }
    });

    return () => {
      observer.disconnect();
      backButtonListener.then((l) => l.remove()).catch(() => {});
      appUrlListener.then((l) => l.remove()).catch(() => {});
    };
  }, [router]);
}

/**
 * Komponent montujący hook useCapacitor w drzewie React
 */
export function CapacitorBridge() {
  useCapacitor();
  return null;
}
