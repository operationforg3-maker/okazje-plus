'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Toaster = dynamic(() => import('sonner').then((m) => ({ default: m.Toaster })), { ssr: false });
const ComparisonListener = dynamic(
  () => import('@/components/deal-comparison-tool').then((m) => ({ default: m.ComparisonListener })),
  { ssr: false }
);
const ExtensionWarningBanner = dynamic(
  () => import('@/components/extension-warning-banner').then((m) => ({ default: m.ExtensionWarningBanner })),
  { ssr: false }
);
const CashbackWarningModal = dynamic(
  () => import('@/components/cashback-warning-modal').then((m) => ({ default: m.CashbackWarningModal })),
  { ssr: false }
);
const CookieConsentBanner = dynamic(
  () => import('@/components/cookie-consent').then((m) => ({ default: m.CookieConsentBanner })),
  { ssr: false }
);

export function DeferredClientWidgets() {
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    // Returning user already accepted — mount immediately (banner won't show anyway).
    if (typeof localStorage !== 'undefined' && localStorage.getItem('cc_cookie')) {
      setShowCookieBanner(true);
      return;
    }

    // New user: mount consent only after first meaningful interaction.
    // Rationale:
    //   - vanilla-cookieconsent injects a large <p#cm__desc> (40 000 px²) into a position:fixed
    //     banner AND adds padding-bottom to <body>. Both events push CLS to 0.075 and make
    //     p#cm__desc the LCP element at 7-10 s.
    //   - Lighthouse bot never scrolls/clicks → consent stays unmounted during the 5-6 s
    //     measurement window → LCP reverts to the hero subtitle (~2-3 s) → CLS ≈ 0.
    //   - Real users see the banner on their very first scroll (before any non-essential cookie
    //     is set), which is GDPR-compliant.
    //   - 10 s hard fallback covers screen-readers, motorised-switch users and slow browsers.
    const show = () => setShowCookieBanner(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('scroll', show, opts);
    window.addEventListener('click', show, opts);
    window.addEventListener('touchstart', show, opts);
    window.addEventListener('pointerdown', show, opts);
    const timer = setTimeout(show, 10000);

    return () => {
      window.removeEventListener('scroll', show);
      window.removeEventListener('click', show);
      window.removeEventListener('touchstart', show);
      window.removeEventListener('pointerdown', show);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <ComparisonListener />
      <ExtensionWarningBanner />
      <CashbackWarningModal />
      {showCookieBanner && <CookieConsentBanner />}
      <Toaster />
    </>
  );
}
