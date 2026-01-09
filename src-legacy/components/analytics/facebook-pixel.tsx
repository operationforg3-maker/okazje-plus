'use client';

import { useEffect } from 'react';

/**
 * Facebook Pixel - Lazy loaded component
 * Loads FB Pixel script asynchronously after page render to avoid blocking main bundle
 */
export function FacebookPixel() {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  if (!pixelId) return null;

  useEffect(() => {
    // Load Facebook Pixel asynchronously after component mounts
    const loadFBPixel = async () => {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);

      script.onload = () => {
        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('init', pixelId);
          (window as any).fbq('track', 'PageView');
        }
      };
    };

    // Initialize fbq function before script loads
    if (typeof window !== 'undefined') {
      (window as any).fbq = (window as any).fbq || function () {
        ((window as any).fbq as any).callMethod
          ? ((window as any).fbq as any).callMethod.apply((window as any).fbq, arguments)
          : ((window as any).fbq as any).queue.push(arguments);
      };
      ((window as any).fbq as any).push = (window as any).fbq;
      ((window as any).fbq as any).loaded = true;
      ((window as any).fbq as any).version = '2.0';
      ((window as any).fbq as any).queue = [];
    }

    // Use requestIdleCallback for better performance
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadFBPixel(), { timeout: 2000 });
    } else {
      setTimeout(loadFBPixel, 1500);
    }
  }, [pixelId]);

  return (
    <>
      {/* Facebook Pixel noscript fallback */}
      {pixelId && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  );
}
