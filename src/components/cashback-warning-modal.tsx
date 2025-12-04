'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCashbackDetector } from '@/hooks/use-cashback-detector';
import { useState, useEffect } from 'react';

/**
 * Warning modal displayed when cashback extension is detected
 * Informs user that their extension might hijack affiliate links
 */
export function CashbackWarningModal() {
  const { hasCashbackExtension, extensionName } = useCashbackDetector();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (hasCashbackExtension && !isDismissed) {
      // Show warning after short delay to allow page to load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCashbackExtension, isDismissed]);

  if (!isVisible || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    // Store dismissal for session
    sessionStorage.setItem('cashback-warning-dismissed', 'true');
  };

  const handleDisableExtension = () => {
    alert(
      `Aby wyłączyć wtyczkę ${extensionName || 'cashback'}:\n\n` +
      `1. Kliknij ikonę rozszerzenia w pasku przeglądarki\n` +
      `2. Wybierz "Zarządzaj rozszerzeniami" lub "Wyłącz"\n` +
      `3. Odśwież stronę\n\n` +
      `Dzięki temu uzyskasz najlepszą cenę bez pośrednictwa innych platform!`
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 max-w-md rounded-lg border border-yellow-200 bg-yellow-50 p-6 shadow-2xl dark:bg-yellow-900/20 dark:border-yellow-700">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          aria-label="Zamknij"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
            Wykryto wtyczkę cashback
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Twoja wtyczka <strong>{extensionName || 'cashback'}</strong> może zmienić nasze linki partnerskie na swoje. 
            W rezultacie będziesz kupować przez inną platformę, a my nie dostaniemy prowizji.
          </p>

          <div className="rounded bg-yellow-100/50 dark:bg-yellow-900/30 p-3 text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium mb-1">💡 Co się stanie?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Będziesz kupować bez bezpośredniego dostępu do najlepszej ceny</li>
              <li>Nasza społeczność nie będzie zarabiać na prowizjach</li>
              <li>Może to wpłynąć na rozwój platformy</li>
            </ul>
          </div>

          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            ✅ Jeśli wyłączysz wtyczkę dla naszej domeny, uzyskasz najlepszą cenę i pomożesz nam rosnąć!
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <Button
            onClick={handleDisableExtension}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600"
          >
            Jak wyłączyć?
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="flex-1"
          >
            Rozumiem
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-xs text-center text-yellow-700 dark:text-yellow-400">
          To ostrzeżenie pojawi się tylko raz per sesję
        </p>
      </div>
    </div>
  );
}
