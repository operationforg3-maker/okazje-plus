'use client';

import dynamic from 'next/dynamic';

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
  return (
    <>
      <ComparisonListener />
      <ExtensionWarningBanner />
      <CashbackWarningModal />
      <CookieConsentBanner />
      <Toaster />
    </>
  );
}
