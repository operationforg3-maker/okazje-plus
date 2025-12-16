// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect cashback extensions that might hijack affiliate links
 * Detects: Rakuten, Shoop, Honey, GetResponse, Pouch, Capital One Shopping, etc.
 */
export function useCashbackDetector() {
  const [cashbackState, setCashbackState] = useState<{ 
    hasCashbackExtension: boolean; 
    extensionName: string | null;
  }>({ hasCashbackExtension: false, extensionName: null });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Known cashback extension window objects and identifiers
    const cashbackExtensions: Record<string, string[]> = {
      'Rakuten': ['rakuten', '__RAKUTEN__', 'window.rakuten'],
      'Shoop': ['shoop', '__SHOOP__', 'window.shoop'],
      'Honey': ['honey', '__HONEY__', 'window.honey'],
      'Capital One Shopping': ['capone', '__CAPONE__', 'window.capone'],
      'Pouch': ['pouch', '__POUCH__', 'window.pouch'],
      'GetResponse': ['getresponse', '__GR__', 'window.__gr'],
      'Ebates': ['ebates', '__EBATES__'],
      'TopCashback': ['topcashback', '__TC__'],
      'CashbackMonitor': ['cbm', '__CBM__'],
      'InboxDollars': ['inboxdollars', '__ID__'],
      'BeFrugal': ['befrugal', '__BF__'],
    };

    // Check window objects
    for (const [name, identifiers] of Object.entries(cashbackExtensions)) {
      for (const identifier of identifiers) {
        try {
          if ((window as any)[identifier] !== undefined) {
            console.warn(`[Cashback Detector] Detected: ${name}`);
            setCashbackState({ hasCashbackExtension: true, extensionName: name });
            return;
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    // Check for injected styles (some extensions add custom CSS)
    try {
      const styles = document.styleSheets;
      for (let i = 0; i < styles.length; i++) {
        try {
          const cssRules = styles[i].cssRules;
          if (cssRules) {
            for (let j = 0; j < cssRules.length; j++) {
              const rule = cssRules[j];
              if (
                rule.cssText?.includes('cashback') ||
                rule.cssText?.includes('rakuten') ||
                rule.cssText?.includes('shoop')
              ) {
                setCashbackState({ hasCashbackExtension: true, extensionName: 'Unknown Cashback Extension' });
                return;
              }
            }
          }
        } catch (e) {
          // CORS or access denied - expected for cross-origin stylesheets
        }
      }
    } catch (e) {
      // Ignore errors
    }

    // Check for chrome extension API (less reliable but worth trying)
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime?.sendMessage?.(
          { type: 'cashback-check' },
          (response: any) => {
            if (response && response.detected) {
              setCashbackState({ hasCashbackExtension: true, extensionName: 'Browser Extension (Cashback)' });
            }
          }
        );
      } catch (e) {
        // Extension not available or blocked
      }
    }
    }, []);

  return {
    hasCashbackExtension: cashbackState.hasCashbackExtension,
    extensionName: cashbackState.extensionName,
    shouldWarnUser: cashbackState.hasCashbackExtension,
  };
}
