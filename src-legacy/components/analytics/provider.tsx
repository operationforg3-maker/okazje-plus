'use client';

import dynamic from 'next/dynamic';

// Lazy load analytics components to reduce main bundle size
const GoogleTagManager = dynamic(() => import('./google-tag-manager').then(mod => ({ default: mod.GoogleTagManager })), {
  ssr: false,
  loading: () => null
});

const FacebookPixel = dynamic(() => import('./facebook-pixel').then(mod => ({ default: mod.FacebookPixel })), {
  ssr: false,
  loading: () => null
});

/**
 * Analytics wrapper component
 * Loads GTM and FB Pixel asynchronously after page render
 * to reduce main bundle size and improve Core Web Vitals
 */
export function AnalyticsProvider() {
  return (
    <>
      <GoogleTagManager />
      <FacebookPixel />
    </>
  );
}
