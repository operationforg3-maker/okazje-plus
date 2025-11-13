/**
 * Amazon Product Advertising API Client
 * 
 * Handles authentication, request signing, and API calls to Amazon.
 * Uses Amazon Product Advertising API 5.0
 */

import { logger } from '@/lib/logging';
import { getValidToken } from '@/lib/oauth';
import { OAuthToken } from '@/lib/types';
import {
  AmazonClientConfig,
  AmazonSearchParams,
  AmazonSearchResponse,
  AmazonProductDetailsParams,
  AmazonProductDetailsResponse,
  AmazonOAuthToken,
  AmazonApiError,
  AmazonProduct
} from './types';

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: Partial<AmazonClientConfig> = {
  region: 'eu-west-1',
  marketplace: 'www.amazon.pl',
  apiEndpoint: 'https://webservices.amazon.pl/paapi5',
  timeout: 30000, // 30 seconds
  rateLimitPerMinute: 60
};

/**
 * Amazon API Client class
 */
export class AmazonClient {
  private config: AmazonClientConfig;
  private vendorId: string;
  private accountName?: string;
  private token: OAuthToken | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestCountResetTime: number = Date.now();

  constructor(config: AmazonClientConfig, vendorId: string = 'amazon', accountName?: string) {
    this.config = {
      ...DEFAULT_CONFIG,
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
        logger.warn('No OAuth token available, using access/secret key authentication');
        // Amazon PA API can work with access/secret key without OAuth
      } else {
        logger.debug('Valid token obtained', {
          tokenId: this.token.id,
          expiresAt: this.token.expiresAt,
        });
      }
    } catch (error) {
      logger.error('Failed to obtain valid token, falling back to key-based auth', { error });
      // Continue with key-based authentication
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
    
    // Ensure minimum delay between requests (1 second)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }
  }

  /**
   * Search for products
   */
  async searchProducts(params: AmazonSearchParams): Promise<AmazonSearchResponse> {
    await this.ensureToken();
    await this.checkRateLimit();
    
    logger.info('Searching Amazon products', { params });
    
    try {
      // This is a stub - real implementation would call Amazon PA API
      // For now, return mock response
      const response: AmazonSearchResponse = {
        success: true,
        totalResults: 0,
        page: params.page || 1,
        pageSize: params.limit || 10,
        products: [],
      };
      
      this.requestCount++;
      this.lastRequestTime = Date.now();
      
      return response;
    } catch (error) {
      logger.error('Amazon search failed', { error, params });
      throw this.handleApiError(error);
    }
  }

  /**
   * Get product details
   */
  async getProductDetails(params: AmazonProductDetailsParams): Promise<AmazonProductDetailsResponse> {
    await this.ensureToken();
    await this.checkRateLimit();
    
    logger.info('Fetching Amazon product details', { asin: params.asin });
    
    try {
      // This is a stub - real implementation would call Amazon PA API
      const response: AmazonProductDetailsResponse = {
        success: false,
        product: {} as AmazonProduct,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Amazon API integration is a stub implementation'
        }
      };
      
      this.requestCount++;
      this.lastRequestTime = Date.now();
      
      return response;
    } catch (error) {
      logger.error('Amazon product details fetch failed', { error, params });
      throw this.handleApiError(error);
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): AmazonApiError {
    const apiError: AmazonApiError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error,
      timestamp: new Date().toISOString()
    };
    
    return apiError;
  }

  /**
   * Sign request for Amazon API (AWS Signature Version 4)
   * This is a stub - real implementation would sign the request
   */
  private signRequest(url: string, method: string, body?: string): Record<string, string> {
    // TODO: Implement AWS Signature Version 4 signing
    return {
      'Content-Type': 'application/json',
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
    };
  }
}

/**
 * Factory function to create Amazon client
 */
export function createAmazonClient(
  config: AmazonClientConfig,
  vendorId?: string,
  accountName?: string
): AmazonClient {
  return new AmazonClient(config, vendorId, accountName);
}
