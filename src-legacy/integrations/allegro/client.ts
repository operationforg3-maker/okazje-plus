/**
 * Allegro API Client
 * 
 * Handles authentication, request signing, and API calls to Allegro.
 * Uses Allegro REST API with OAuth 2.0
 */

import { logger } from '@/lib/logging';
import { getValidToken } from '@/lib/oauth';
import { OAuthToken } from '@/lib/types';
import {
  AllegroClientConfig,
  AllegroSearchParams,
  AllegroSearchResponse,
  AllegroProductDetailsParams,
  AllegroProductDetailsResponse,
  AllegroOAuthToken,
  AllegroApiError,
  AllegroProduct
} from './types';

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: Partial<AllegroClientConfig> = {
  apiEndpoint: 'https://api.allegro.pl',
  authEndpoint: 'https://allegro.pl/auth/oauth',
  sandbox: false,
  timeout: 30000, // 30 seconds
  rateLimitPerMinute: 60
};

const SANDBOX_CONFIG: Partial<AllegroClientConfig> = {
  apiEndpoint: 'https://api.allegro.pl.allegrosandbox.pl',
  authEndpoint: 'https://allegro.pl.allegrosandbox.pl/auth/oauth',
};

/**
 * Allegro API Client class
 */
export class AllegroClient {
  private config: AllegroClientConfig;
  private vendorId: string;
  private accountName?: string;
  private token: OAuthToken | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestCountResetTime: number = Date.now();

  constructor(config: AllegroClientConfig, vendorId: string = 'allegro', accountName?: string) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...(config.sandbox ? SANDBOX_CONFIG : {}),
      ...config
    };
    this.vendorId = vendorId;
    this.accountName = accountName;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureToken(): Promise<void> {
    logger.debug('Ensuring valid access token', {
      vendorId: this.vendorId,
      accountName: this.accountName,
    });
    
    try {
      this.token = await getValidToken(this.vendorId, this.accountName);
      
      if (!this.token) {
        throw new Error(
          `No valid OAuth token available for vendor ${this.vendorId}` +
          (this.accountName ? ` (account: ${this.accountName})` : '')
        );
      }
      
      logger.debug('Valid token obtained', {
        tokenId: this.token.id,
        expiresAt: this.token.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to obtain valid token', { error });
      throw error;
    }
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinute = 60000;
    
    // Reset counter if more than a minute has passed
    if (now - this.requestCountResetTime > oneMinute) {
      this.requestCount = 0;
      this.requestCountResetTime = now;
    }
    
    // Check if we've exceeded rate limit
    if (this.requestCount >= (this.config.rateLimitPerMinute || 60)) {
      const waitTime = oneMinute - (now - this.requestCountResetTime);
      logger.warn('Rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestCountResetTime = Date.now();
    }
    
    // Ensure minimum delay between requests (500ms)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 500) {
      await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest));
    }
  }

  /**
   * Search for offers/products
   */
  async searchOffers(params: AllegroSearchParams): Promise<AllegroSearchResponse> {
    await this.ensureToken();
    await this.checkRateLimit();
    
    logger.info('Searching Allegro offers', { params });
    
    try {
      // This is a stub - real implementation would call Allegro REST API
      // Endpoint: GET /offers/listing
      const response: AllegroSearchResponse = {
        items: {
          promoted: [],
          regular: [],
        },
        count: 0,
        totalCount: 0,
      };
      
      this.requestCount++;
      this.lastRequestTime = Date.now();
      
      return response;
    } catch (error) {
      logger.error('Allegro search failed', { error, params });
      throw this.handleApiError(error);
    }
  }

  /**
   * Get offer/product details
   */
  async getOfferDetails(params: AllegroProductDetailsParams): Promise<AllegroProductDetailsResponse> {
    await this.ensureToken();
    await this.checkRateLimit();
    
    logger.info('Fetching Allegro offer details', { offerId: params.offerId });
    
    try {
      // This is a stub - real implementation would call Allegro REST API
      // Endpoint: GET /sale/offers/{offerId}
      const response: AllegroProductDetailsResponse = {
        offer: {} as AllegroProduct,
      };
      
      this.requestCount++;
      this.lastRequestTime = Date.now();
      
      return response;
    } catch (error) {
      logger.error('Allegro offer details fetch failed', { error, params });
      throw this.handleApiError(error);
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.token) {
      throw new Error('No valid token available');
    }

    const url = `${this.config.apiEndpoint}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token.accessToken}`,
      'Accept': 'application/vnd.allegro.public.v1+json',
      'Content-Type': 'application/vnd.allegro.public.v1+json',
    };

    // This is a stub - real implementation would make HTTP request
    throw new Error('Not implemented');
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): AllegroApiError {
    const apiError: AllegroApiError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error,
      timestamp: new Date().toISOString()
    };
    
    return apiError;
  }
}

/**
 * Factory function to create Allegro client
 */
export function createAllegroClient(
  config: AllegroClientConfig,
  vendorId?: string,
  accountName?: string
): AllegroClient {
  return new AllegroClient(config, vendorId, accountName);
}
