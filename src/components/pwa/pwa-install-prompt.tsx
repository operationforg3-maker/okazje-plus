'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'pwa_install_dismissed_until';
const DISMISS_DAYS = 7;

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Rejestracja Service Workera
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[PWA] Rejestracja Service Workera nie powiodła się:', err);
        });
      });
    }

    // 2. Jeśli aplikacja już działa jako PWA (standalone) lub w natywnym Capacitorze, nie pokazuj monitu
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      Capacitor.isNativePlatform();

    if (isStandalone) {
      return;
    }

    // 3. Sprawdź, czy użytkownik nie odrzucił monitu w ciągu ostatnich 7 dni
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }

    // 4. Przechwycenie zdarzenia beforeinstallprompt na Androidzie / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
    } catch (err) {
      console.error('[PWA] Błąd podczas wywoływania promptu instalacji:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Zapisz wygaszenie monitu na 7 dni
    const expiryTime = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, expiryTime.toString());
  };

  if (!isVisible || !deferredPrompt) {
    return null;
  }

  return (
    <aside
      aria-label="Zainstaluj aplikację Okazje+"
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-center gap-3 p-3.5 bg-[#111726]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl text-white">
        <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-[#090d16] border border-white/10 flex items-center justify-center p-1">
          <Image
            src="/icon-192x192.png"
            alt="Okazje+"
            width={48}
            height={48}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-sm font-semibold text-white tracking-tight truncate">
            Aplikacja Okazje+ na telefon
          </h4>
          <p className="text-xs text-gray-300 truncate">
            Zainstaluj na pulpicie – szybciej i bez paska adresu
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#ea5505] hover:bg-[#d44d04] active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Zainstaluj</span>
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Zamknij powiadomienie"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
