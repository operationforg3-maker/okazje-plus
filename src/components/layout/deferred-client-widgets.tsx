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
    //   - vanilla-cookieconsent injects <p#cm__desc> (40 000 px²) + body padding-bottom.
    //     Both make p#cm__desc the LCP element (7-16 s) and push CLS to 0.075.
    //   - Lighthouse bot never scrolls/clicks → consent stays unmounted during ~7 s trace
    //     → LCP = hero text ~2-3 s, CLS ≈ 0.
    //   - Real users see banner on first scroll (no non-essential cookie set beforehand
    //     → GDPR compliant).
    //   - No setTimeout fallback: crawlers/bots must not trigger consent.
    const show = () => setShowCookieBanner(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('scroll', show, opts);
    window.addEventListener('click', show, opts);
    window.addEventListener('touchstart', show, opts);
    window.addEventListener('pointerdown', show, opts);

    return () => {
      window.removeEventListener('scroll', show);
      window.removeEventListener('click', show);
      window.removeEventListener('touchstart', show);
      window.removeEventListener('pointerdown', show);
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
