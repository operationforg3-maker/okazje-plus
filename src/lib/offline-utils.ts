/**
 * Offline & Retry Utilities
 * Handles offline detection, retry logic, and graceful fallbacks for Firestore errors
 */

/**
 * Check if browser is online (based on navigator.onLine + connectivity test)
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true; // SSR
  return navigator.onLine;
}

/**
 * Wait for app to go online (max 30 seconds by default)
 */
export async function waitForOnline(maxWaitMs: number = 30000): Promise<boolean> {
  if (isOnline()) return true;
  
  const startTime = Date.now();
  return new Promise((resolve) => {
    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      resolve(true);
    };
    const handleOffline = () => {
      if (Date.now() - startTime > maxWaitMs) {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        resolve(false);
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Fallback timeout
    setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      resolve(isOnline());
    }, maxWaitMs);
  });
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default 3)
 * @param initialDelayMs - Initial delay in milliseconds (default 500)
 * @param maxDelayMs - Maximum delay in milliseconds (default 10000)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500,
  maxDelayMs: number = 10000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      // If offline, wait before trying
      if (i > 0 && !isOnline()) {
        const online = await waitForOnline(5000);
        if (!online) {
          throw new Error('Client offline - cannot proceed');
        }
      }
      
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      const isOfflineError = errorMsg.includes('offline') || 
                            errorMsg.includes('PERMISSION_DENIED') ||
                            errorMsg.includes('UNAUTHENTICATED');
      
      // Don't retry on permission errors unless retrying connection
      if (i < maxRetries && (isOfflineError || errorMsg.includes('INTERNAL'))) {
        const delayMs = Math.min(initialDelayMs * Math.pow(2, i), maxDelayMs);
        console.debug(`[retryWithBackoff] Attempt ${i + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms...`, errorMsg);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else if (i === maxRetries) {
        console.error(`[retryWithBackoff] All ${maxRetries + 1} attempts failed:`, errorMsg);
        throw error;
      } else {
        throw error;
      }
    }
  }
  
  if (lastError) throw lastError;
  throw new Error('Unknown error in retryWithBackoff');
}

/**
 * Wrap a data fetching function with offline detection and retry
 * @param name - Name for logging
 * @param fn - Function to execute
 * @param fallbackValue - Value to return if offline/failed
 */
export async function fetchWithOfflineSupport<T>(
  name: string,
  fn: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    if (!isOnline()) {
      console.warn(`[${name}] Client appears offline, waiting...`);
      const online = await waitForOnline(5000);
      if (!online) {
        console.warn(`[${name}] Still offline after 5s timeout, using fallback`);
        return fallbackValue;
      }
    }
    
    return await retryWithBackoff(fn, 2, 500, 5000);
  } catch (error) {
    console.error(`[${name}] Failed to fetch data, using fallback:`, error);
    return fallbackValue;
  }
}

/**
 * Check if error is an offline-related error
 */
export function isOfflineError(error: any): boolean {
  const msg = error?.message || String(error);
  return msg.includes('offline') || 
         msg.includes('PERMISSION_DENIED') ||
         msg.includes('UNAUTHENTICATED') ||
         msg.includes('Failed to get document because the client is offline');
}
