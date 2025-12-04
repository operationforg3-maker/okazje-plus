/**
 * Google Indexing API Integration
 * 
 * Auto-indexes new deals in Google Search Console using the Indexing API.
 * Requires Service Account with Indexing API permissions.
 */

import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/indexing'];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app';

/**
 * Get authenticated JWT client for Google Indexing API
 */
async function getAuthClient() {
  try {
    // Use Application Default Credentials (works with GOOGLE_APPLICATION_CREDENTIALS)
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
    });

    const authClient = await auth.getClient();
    return authClient;
  } catch (error) {
    console.error('[Google Indexing] Failed to get auth client:', error);
    throw new Error('Failed to authenticate with Google Indexing API');
  }
}

/**
 * Request Google to index a URL
 * 
 * @param url - Full URL to index (e.g., https://okazjeplus.pl/deals/awesome-deal)
 * @param type - Type of update ('URL_UPDATED' | 'URL_DELETED')
 * @returns Response from Google Indexing API
 */
export async function requestIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log(`[Google Indexing] Requesting indexing for: ${url} (${type})`);

    const authClient = await getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth: authClient as any });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    console.log('[Google Indexing] Success:', response.data);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error('[Google Indexing] Error:', error);
    
    // Extract useful error message
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Request indexing for a deal by its slug
 * 
 * @param dealSlug - Deal slug (e.g., 'awesome-deal-123')
 * @returns Response from Google Indexing API
 */
export async function requestDealIndexing(
  dealSlug: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<{ success: boolean; data?: any; error?: string }> {
  const dealUrl = `${SITE_URL}/deals/${dealSlug}`;
  return requestIndexing(dealUrl, type);
}

/**
 * Batch request indexing for multiple URLs
 * 
 * @param urls - Array of URLs to index
 * @returns Array of results
 */
export async function batchRequestIndexing(
  urls: string[]
): Promise<Array<{ url: string; success: boolean; error?: string }>> {
  const results = [];

  for (const url of urls) {
    const result = await requestIndexing(url);
    results.push({
      url,
      success: result.success,
      error: result.error,
    });

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Get indexing status for a URL (quota check)
 * 
 * @param url - URL to check
 * @returns Metadata about the URL's indexing status
 */
export async function getIndexingStatus(url: string): Promise<any> {
  try {
    const authClient = await getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth: authClient as any });

    const response = await indexing.urlNotifications.getMetadata({ url });
    
    console.log('[Google Indexing] Status:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[Google Indexing] Failed to get status:', error);
    throw error;
  }
}
