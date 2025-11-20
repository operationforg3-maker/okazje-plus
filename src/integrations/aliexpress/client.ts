/**
 * AliExpress API Client (M2 Enhanced)
 * 
 * Handles authentication, request signing, and API calls to AliExpress.
 * 
 * M2 Enhancements:
 * ✅ Real OAuth token integration
 * ✅ Automatic token refresh
 * ✅ Multi-account support via vendorId
 * ✅ TOP API signature authentication (fallback when no OAuth)
 * - Add retry logic with exponential backoff (TODO)
 * - Add request/response logging (partial)
 */

import { logger } from '@/lib/logging';
import { getValidToken } from '@/lib/oauth';
import { OAuthToken } from '@/lib/types';
import { createHash } from 'crypto';
import {
  AliExpressClientConfig,
  AliExpressSearchParams,
  AliExpressSearchResponse,
  AliExpressProductDetailsParams,
  AliExpressProductDetailsResponse,
  AliExpressOAuthToken,
  AliExpressApiError
} from './types';

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: Partial<AliExpressClientConfig> = {
  apiEndpoint: 'https://api-sg.aliexpress.com/sync',
  apiVersion: '2.0',
  timeout: 30000, // 30 seconds
  rateLimitPerMinute: 60
};

/**
 * AliExpress API Client class (M2 Enhanced)
 */
export class AliExpressClient {
  private config: AliExpressClientConfig;
  private vendorId: string;
  private accountName?: string;
  private token: OAuthToken | null = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestCountResetTime: number = Date.now();

  constructor(config: AliExpressClientConfig, vendorId: string = 'aliexpress', accountName?: string) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    this.vendorId = vendorId;
    this.accountName = accountName;
  }

  /**
   * Ensure we have a valid access token (M2 Enhanced)
   * 
   * Now integrates with OAuth token management system:
   * - Fetches token from Firestore
   * - Automatically refreshes if expired
   * - Supports multi-account
   * 
   * FALLBACK: If no OAuth token exists, client can still work
   * with APP_KEY/APP_SECRET for non-authenticated endpoints
   */
  private async ensureToken(): Promise<void> {
    logger.debug('Ensuring valid access token', {
      vendorId: this.vendorId,
      accountName: this.accountName,
    });
    
    try {
      // Try to get valid OAuth token (will refresh if needed)
      this.token = await getValidToken(this.vendorId, this.accountName);
      
      if (this.token) {
        logger.debug('Valid OAuth token obtained', {
          tokenId: this.token.id,
          expiresAt: this.token.expiresAt,
        });
        return;
      }
      
      // FALLBACK: No OAuth token - log warning but continue
      // Client will use APP_KEY/APP_SECRET for public endpoints
      logger.warn('No OAuth token available - using APP_KEY/APP_SECRET fallback', {
        vendorId: this.vendorId,
        accountName: this.accountName,
      });
    } catch (error) {
      // OAuth system error - log but continue with fallback
      logger.warn('OAuth token fetch failed - using APP_KEY/APP_SECRET fallback', { error });
    }
  }

  /**
   * Generate signature for TOP API (gateway.do) requests
   * 
   * AliExpress TOP API uses HMAC-MD5 signature authentication:
   * sign = MD5(app_secret + sorted_params + app_secret).toUpperCase()
   */
  private generateSignature(params: Record<string, any>): string {
    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();
    
    // Concatenate key-value pairs
    let signString = this.config.appSecret || '';
    for (const key of sortedKeys) {
      signString += key + params[key];
    }
    signString += this.config.appSecret || '';
    
    // MD5 hash and uppercase
    const hash = createHash('md5').update(signString).digest('hex');
    return hash.toUpperCase();
  }

  /**
   * Refresh OAuth token (M2 - Deprecated)
   * 
   * Token refresh is now handled automatically by getValidToken()
   * This method is kept for backwards compatibility but is no longer used
   */
  private async refreshToken(): Promise<void> {
    logger.info('Token refresh is handled automatically by OAuth service');
    await this.ensureToken();
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.requestCountResetTime >= 60000) {
      this.requestCount = 0;
      this.requestCountResetTime = now;
    }
    
    // Check if we've exceeded rate limit
    const rateLimit = this.config.rateLimitPerMinute || 60;
    if (this.requestCount >= rateLimit) {
      const waitTime = 60000 - (now - this.requestCountResetTime);
      logger.warn('Rate limit reached, waiting', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestCountResetTime = Date.now();
    }
    
    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Make an API request (M2 Enhanced)
   * 
   * Supports two authentication methods:
   * 1. OAuth token (new API: api-sg.aliexpress.com)
   * 2. Signature auth (TOP API: openapi.aliexpress.com/gateway.do)
   * 
   * Falls back to signature auth if no OAuth token available
   */
  private async request<T>(
    method: string,
    params: Record<string, any>
  ): Promise<T> {
    await this.ensureToken();
    await this.applyRateLimit();
    
    logger.debug('Making API request', { method, params });
    
    // Determine authentication method
    const useOAuth = !!this.token;
    const apiBase = this.config.apiEndpoint || process.env.ALIEXPRESS_API_BASE || 'https://openapi.aliexpress.com/gateway.do';
    
    if (useOAuth) {
      // New API with OAuth
      logger.debug('Using OAuth authentication');
      const url = `${apiBase}${method}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `${this.token!.tokenType} ${this.token!.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.error('OAuth API request failed', {
            status: response.status,
            error: errorText,
          });
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        logger.debug('OAuth API request successful');
        return data;
      } catch (error) {
        logger.error('OAuth API request error', { method, error });
        throw error;
      }
    } else {
      // TOP API with signature auth (fallback)
      logger.debug('Using signature authentication (TOP API)');
      
      const requestParams: Record<string, any> = {
        method,
        app_key: this.config.appKey,
        sign_method: 'md5',
        timestamp: new Date().getTime().toString(),
        format: 'json',
        v: '2.0',
        simplify: 'true',
        ...params,
      };
      
      // Generate signature
      const sign = this.generateSignature(requestParams);
      requestParams.sign = sign;
      
      // Build query string
      const queryString = Object.keys(requestParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(requestParams[key])}`)
        .join('&');
      
      const url = `${apiBase}?${queryString}`;
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.error('TOP API request failed', {
            status: response.status,
            error: errorText,
          });
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        logger.debug('TOP API request successful', { data });
        return data;
      } catch (error) {
        logger.error('TOP API request error', { method, error });
        throw error;
      }
    }
  }

  /**
   * Transform TOP API response to our standard format
   */
  private transformTopApiResponse(result: any, page: number, pageSize: number): AliExpressSearchResponse {
    try {
      // TOP API wraps response in method-specific key
      const responseKey = Object.keys(result)[0]; // e.g., 'aliexpress_affiliate_product_query_response'
      const responseData = result[responseKey];
      
      if (!responseData || responseData.resp_result?.resp_code !== '200') {
        logger.warn('TOP API returned error', { responseData });
        return {
          success: false,
          total: 0,
          page,
          page_size: pageSize,
          products: [],
          error: {
            code: responseData?.resp_result?.resp_code || 'UNKNOWN',
            message: responseData?.resp_result?.resp_msg || 'API error',
          },
        };
      }
      
      const resultData = JSON.parse(responseData.resp_result.result);
      const products = resultData.products?.product || [];
      
      logger.info(`TOP API returned ${products.length} products`);
      
      // Transform products to our format
      const transformedProducts = products.map((p: any) => ({
        item_id: p.product_id || p.item_id,
        title: p.product_title || p.title,
        image_urls: [p.product_main_image_url || p.image_url].filter(Boolean),
        price: {
          current: parseFloat(p.target_sale_price || p.sale_price || '0'),
          original: parseFloat(p.target_original_price || p.original_price || '0'),
          currency: 'USD',
        },
        product_url: p.promotion_link || p.product_detail_url,
        discount_percent: p.discount ? parseFloat(p.discount) : undefined,
        rating: p.evaluate_rate ? {
          score: parseFloat(p.evaluate_rate),
          count: 0,
        } : undefined,
        shipping: {
          free: p.ship_to_days === '0',
          cost: 0,
        },
      }));
      
      return {
        success: true,
        total: resultData.total_record_count || products.length,
        page,
        page_size: pageSize,
        products: transformedProducts,
      };
    } catch (error) {
      logger.error('Failed to transform TOP API response', { error, result });
      return {
        success: false,
        total: 0,
        page,
        page_size: pageSize,
        products: [],
        error: {
          code: 'TRANSFORM_ERROR',
          message: error instanceof Error ? error.message : 'Failed to parse response',
        },
      };
    }
  }

  /**
   * Search for products (M2 Enhanced)
   * 
   * Supports both OAuth API and TOP API with signature auth
   * TOP API method: aliexpress.affiliate.product.query
   */
  async searchProducts(params: AliExpressSearchParams): Promise<AliExpressSearchResponse> {
    logger.info('Searching products', { 
      query: params.q,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      limit: params.limit 
    });
    
    try {
      // Map params to TOP API format
      const topApiParams: Record<string, any> = {
        keywords: params.q,
        page_no: params.page || 1,
        page_size: Math.min(params.limit || 20, 50), // TOP API max 50
      };
      
      // Add optional filters
      if (params.minPrice) {
        topApiParams.min_price = params.minPrice;
      }
      if (params.maxPrice) {
        topApiParams.max_price = params.maxPrice;
      }
      if (params.sort) {
        // Map sort param if needed
        topApiParams.sort = params.sort;
      }
      
      const result = await this.request<any>('aliexpress.affiliate.product.query', topApiParams);
      
      // Transform TOP API response to our format
      // TOP API response structure: { aliexpress_affiliate_product_query_response: { resp_result: { result: { products: [] } } } }
      logger.debug('Raw API response', { result });
      
      return this.transformTopApiResponse(result, topApiParams.page_no, topApiParams.page_size);
    } catch (error) {
      logger.error('Product search failed', { error });
      
      // Return empty result on error for graceful degradation
      return {
        success: false,
        total: 0,
        page: params.page || 1,
        page_size: params.limit || 50,
        products: [],
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get product details (M2 Enhanced)
   * 
   * Now makes real API calls with OAuth token
   */
  async getProductDetails(
    params: AliExpressProductDetailsParams
  ): Promise<AliExpressProductDetailsResponse> {
    logger.info('Getting product details', { productId: params.productId });
    
    try {
      return await this.request<AliExpressProductDetailsResponse>('/product/details', params);
    } catch (error) {
      logger.error('Product details fetch failed', { error });
      throw error;
    }
  }

  /**
   * Get client configuration (for debugging)
   */
  getConfig(): AliExpressClientConfig {
    return { ...this.config };
  }
}

/**
 * Create a new AliExpress client instance (M2 Enhanced)
 * 
 * Configuration is read from environment variables:
 * - ALIEXPRESS_APP_KEY
 * - ALIEXPRESS_APP_SECRET
 * - ALIEXPRESS_API_ENDPOINT (optional)
 * 
 * M2: Now supports multi-account via accountName parameter
 * Tokens are managed via OAuth system, no longer using env vars
 */
export function createAliExpressClient(accountName?: string): AliExpressClient {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  
  if (!appKey || !appSecret) {
    logger.error('AliExpress credentials not configured');
    throw new Error(
      'AliExpress API credentials not found. ' +
      'Set ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET environment variables.'
    );
  }
  
  const config: AliExpressClientConfig = {
    appKey,
    appSecret,
    apiEndpoint: process.env.ALIEXPRESS_API_ENDPOINT,
    rateLimitPerMinute: process.env.ALIEXPRESS_RATE_LIMIT 
      ? parseInt(process.env.ALIEXPRESS_RATE_LIMIT, 10) 
      : undefined
  };
  
  return new AliExpressClient(config, 'aliexpress', accountName);
}
