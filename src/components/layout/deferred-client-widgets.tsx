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
  // Delay the cookie consent banner so it does not become the LCP element.
  // vanilla-cookieconsent renders a large paragraph (p#cm__desc ≈ 40K px²) which
  // dominates LCP at ~7-8 s when loaded immediately via dynamic import after hydration.
  // Delaying to 3 s still provides GDPR compliance while allowing actual content to
  // establish LCP first. Returning visitors (cc_cookie already set) skip the banner.
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCookieBanner(true), 3000);
    return () => clearTimeout(timer);
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
