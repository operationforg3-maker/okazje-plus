"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXTENSION_ERROR_PATTERNS = [
  'chrome-extension://',
  'content_script.js',
  'content-script.js',
  'extension://'
];

export function ExtensionWarningBanner() {
  const [visible, setVisible] = useState(false);
  const [errorSource, setErrorSource] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const filename = typeof event.filename === 'string' ? event.filename : '';
      const message = typeof event.message === 'string' ? event.message : '';
      const matchesPattern = EXTENSION_ERROR_PATTERNS.some((pattern) =>
        filename.includes(pattern) || message.includes(pattern)
      );
      if (!matchesPattern) return;
      setErrorSource(filename || message || 'unknown-extension');
      setVisible(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const hint = useMemo(() => {
    if (!errorSource) return null;
    if (errorSource.includes('chrome-extension://')) return 'Rozszerzenie Chrome ingeruje w działanie strony';
    if (errorSource.includes('content_script')) return 'Zewnetrzny content script spowodowal blad';
    return null;
  }, [errorSource]);

  if (!isMounted || !visible) return null;

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-yellow-400 bg-yellow-50 p-4 shadow-lg',
      'text-sm text-yellow-900'
    )}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold">Wykryto konflikt z rozszerzeniem przegladarki</p>
          <p>
            Jedno z Twoich rozszerzen (np. blokery reklam/kuponow) wstrzykuje skrypt, ktory powoduje bledy
            <span className="font-semibold"> content_script.js</span>. Tymczasowo wylacz rozszerzenie dla Okazje+ lub dodaj strone do wyjatkow.
          </p>
          {hint && <p className="text-xs text-yellow-800">Szczegoly: {hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-full p-1 text-yellow-900 transition hover:bg-yellow-100"
          aria-label="Zamknij komunikat o rozszerzeniu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
