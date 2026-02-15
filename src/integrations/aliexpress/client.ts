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
import { createHash, createHmac } from 'crypto';
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
   * 
   * NOTE: For AliExpress TOP API (gw.api.taobao.com), we MUST use
   * APP_KEY/APP_SECRET signature auth, not OAuth. OAuth is only for
   * newer endpoints. Set ALIEXPRESS_FORCE_SIGNATURE_AUTH=true to skip OAuth.
   */
  private async ensureToken(): Promise<void> {
    logger.debug('Ensuring valid access token', {
      vendorId: this.vendorId,
      accountName: this.accountName,
    });
    
    // For TOP API (gw.api.taobao.com), force signature auth instead of OAuth
    const forceSignatureAuth = process.env.ALIEXPRESS_FORCE_SIGNATURE_AUTH === 'true';
    if (forceSignatureAuth) {
      logger.debug('Forcing signature authentication (TOP API mode)');
      this.token = null;
      return;
    }
    
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
   * AliExpress TOP API uses MD5 signature authentication:
   * sign = MD5(app_secret + sorted_params + app_secret).toUpperCase()
   * 
   * CRITICAL POINTS:
   * 1. Parameters MUST NOT be URL-encoded before hashing
   * 2. All values must be converted to strings (toString())
   * 3. Parameter keys are sorted alphabetically (ASCII sort)
   * 4. app_secret is trimmed to remove trailing whitespace
   * 5. Exact format: SECRET + key1 + value1 + key2 + value2 + ... + SECRET
   */
  private generateSignature(params: Record<string, any>, method: 'md5' | 'sha256' = 'md5'): string {
    // Get app secret and TRIM to remove trailing whitespace
    const appSecret = (this.config.appSecret || '').trim();
    
    // Sort parameters alphabetically (critical for signature match)
    const sortedKeys = Object.keys(params).sort();
    
    // Build signature string
    // - MD5: SECRET + key1 + value1 + ... + SECRET
    // - HMAC-SHA256: key1 + value1 + ... (no secret prefix)
    // CRITICAL: Values MUST NOT be URL-encoded at this stage
    let signString = method === 'md5' ? appSecret : '';
    for (const key of sortedKeys) {
      // Convert value to string without URL encoding
      const value = String(params[key]);
      signString += key + value;
    }
    if (method === 'md5') {
      signString += appSecret;
    }
    
    // Debug log the raw signature string (first 200 chars only for security)
    logger.debug('Signature calculation', {
      appSecretLength: appSecret.length,
      paramsCount: sortedKeys.length,
      sortedKeys: sortedKeys.slice(0, 5), // First 5 keys
      signStringPreview: signString.substring(0, 100) + '...',
      signStringLength: signString.length
    });
    
    // Generate signature
    if (method === 'sha256') {
      const hash = createHmac('sha256', appSecret).update(signString).digest('hex');
      return hash.toUpperCase();
    }

    // Generate plain MD5 signature (not HMAC)
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
    const isPathMethod = method.startsWith('/');
    const useOAuth = Boolean(this.token && isPathMethod);
    const apiBase = this.config.apiEndpoint || process.env.ALIEXPRESS_API_BASE || 'https://openapi.aliexpress.com/gateway.do';
    const isSingaporeEndpoint = apiBase.includes('api-sg.aliexpress.com');
    const isSyncEndpoint = apiBase.includes('/sync');
    
    // AFFILIATE API: Singapore /sync IS the correct endpoint for Affiliate API
    // Methods like 'aliexpress.affiliate.productdetail.get' ONLY work on Singapore /sync
    // TOP API (gateway.do) returns errors for Affiliate API app category
    
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

      if (this.token?.accessToken && !params.session) {
        params.session = this.token.accessToken;
      }

      const forceRestMethods = new Set([
        'aliexpress.hot.product.query',
      ]);

      if (isSingaporeEndpoint && isSyncEndpoint && forceRestMethods.has(method)) {
        const restBase = apiBase.replace('/sync', '/rest');
        logger.warn('Routing method to Singapore /rest instead of /sync', {
          method,
          apiBase,
          restBase,
        });

        try {
          const data = await this.executeRestApiRequest(method, params, restBase, false, method);
          const errorCode = data?.error_response?.code || data?.code;
          if (errorCode === 'InvalidApiPath' || errorCode === 'IllegalTimestamp' || data?.type === 'ISV') {
            throw new Error(`Singapore rest path error: ${errorCode || 'ISV'}`);
          }
          return data;
        } catch (error) {
          logger.warn('Singapore /rest path attempt failed, retrying with method param', {
            method,
            restBase,
            error: error instanceof Error ? error.message : String(error),
          });

          try {
            const data = await this.executeRestApiRequest(method, params, restBase, true);
            const errorCode = data?.error_response?.code || data?.code;
            if (errorCode === 'InvalidApiPath' || errorCode === 'IllegalTimestamp' || data?.type === 'ISV') {
              throw new Error(`Singapore rest param error: ${errorCode || 'ISV'}`);
            }
            return data;
          } catch (err) {
            logger.warn('Singapore /rest failed, falling back to TOP API gateway', {
              method,
              apiBase: restBase,
              error: err instanceof Error ? err.message : String(err),
            });
            return this.executeTopApiRequest(method, params, 'https://openapi.aliexpress.com/gateway.do');
          }
        }
      }

      if (isSingaporeEndpoint && process.env.ALIEXPRESS_FORCE_SIGNATURE_AUTH === 'true') {
        return this.executeTopApiRequest(method, params, 'https://openapi.aliexpress.com/gateway.do');
      }
      
      // Build request params
      // Timestamp format: yyyy-MM-dd HH:mm:ss (STRING in UTC)
      // CRITICAL: AliExpress TOP API requires exact format for signature validation
      // Must NOT be URL-encoded before signature calculation
      const now = new Date();
      // Format timestamp based on endpoint requirements:
      // - TOP API (gateway.do): "YYYY-MM-DD HH:mm:ss" UTC
      // - Singapore router/rest: milliseconds since epoch (string)
      const timestamp = isSingaporeEndpoint
        ? String(now.getTime())
        : now.toISOString().replace('T', ' ').substring(0, 19); // Exact format: 2026-02-01 05:10:21
      
      // Build base parameters (system params)
      const requestParams: Record<string, any> = {
        method,
        app_key: this.config.appKey,
        sign_method: 'md5', // Always use md5 for signature auth (both /sync and gateway.do)
        timestamp: timestamp,
        format: 'json',
        v: '2.0',
        simplify: 'true',
        ...params, // Business parameters
      };
      
      logger.debug('Request params before signing', {
        method,
        timestamp,
        paramKeys: Object.keys(requestParams).sort().slice(0, 10)
      });
      
      // Singapore /sync endpoint uses direct POST with signature (no /rest conversion)
      if (isSingaporeEndpoint && isSyncEndpoint) {
        return await this.executeSyncApiRequest(method, params, apiBase);
      }
      
      // Singapore endpoint with /rest path requires different parameter structure
      if (isSingaporeEndpoint) {
        // Use /rest endpoint for system APIs per AliExpress docs
        const restBase = apiBase.includes('/rest')
          ? apiBase
          : apiBase.replace('/sync', '/rest');

        try {
          // Attempt 1: /rest/{api_path} with method in URL path
          let data = await this.executeRestApiRequest(method, params, restBase, false, method);
          const errorCode1 = data?.error_response?.code || data?.code;
          if (errorCode1 === 'InvalidApiPath' || errorCode1 === 'IllegalTimestamp' || data?.type === 'ISV') {
            throw new Error(`Singapore rest path error: ${errorCode1 || 'ISV'}`);
          }
          return data;
        } catch (error) {
          logger.warn('Singapore API path attempt failed, retrying with method param', {
            method,
            restBase,
            error: error instanceof Error ? error.message : String(error),
          });

          try {
            // Attempt 2: /rest with method param
            const data = await this.executeRestApiRequest(method, params, restBase, true);
            const errorCode2 = data?.error_response?.code || data?.code;
            if (errorCode2 === 'InvalidApiPath' || errorCode2 === 'IllegalTimestamp' || data?.type === 'ISV') {
              throw new Error(`Singapore rest param error: ${errorCode2 || 'ISV'}`);
            }
            return data;
          } catch (err) {
            logger.warn('Singapore API returned error, falling back to TOP API gateway', {
              method,
              apiBase: restBase,
              error: err instanceof Error ? err.message : String(err),
            });
            return await this.executeTopApiRequest(
              method,
              params,
              'https://openapi.aliexpress.com/gateway.do'
            );
          }
        }
      }
      
      return this.executeTopApiRequest(method, params, apiBase);
    }
  }

  /**
   * Execute Singapore /sync API request (signature auth, md5)
   * Used by api-sg.aliexpress.com/sync endpoint
   */
  private async executeSyncApiRequest(
    method: string,
    params: Record<string, any>,
    syncBase: string
  ): Promise<any> {
    const now = new Date();
    const timestamp = String(now.getTime()); // Milliseconds since epoch for Singapore
    
    const requestParams: Record<string, any> = {
      method,
      app_key: this.config.appKey,
      sign_method: 'md5',
      timestamp: timestamp,
      format: 'json',
      v: '2.0',
      simplify: 'true',
      ...params,
    };

    // Add tracking ID if available
    if (this.config.trackingId || this.config.affiliateId) {
      requestParams.tracking_id = this.config.trackingId || this.config.affiliateId;
    }

    // Signature must be calculated BEFORE URL encoding
    const paramsForSigning = Object.entries(requestParams)
      .filter(([key]) => key !== 'sign')
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    const sign = this.generateSignature(paramsForSigning, 'md5');
    requestParams.sign = sign;

    logger.info('Singapore /sync API Signature Debug', {
      appKey: this.config.appKey,
      timestamp: timestamp,
      signMethod: 'md5',
      paramsForSigning: Object.keys(paramsForSigning).sort().join(', '),
      generatedSign: sign.substring(0, 16) + '...',
      totalParams: Object.keys(requestParams).length,
      apiBase: syncBase,
    });

    const body = new URLSearchParams(
      Object.entries(requestParams).map(([key, value]) => [key, String(value)])
    ).toString();

    logger.info('Singapore /sync API Request', {
      url: syncBase,
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      paramCount: Object.keys(requestParams).length,
    });

    const response = await fetch(syncBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: body,
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    logger.info('Singapore /sync API Response', {
      status: response.status,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Singapore /sync API request failed', {
        status: response.status,
        errorPreview: errorText.substring(0, 500),
      });
      throw new Error(`API request failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const responseText = await response.text();
    logger.debug('Singapore /sync API raw response', {
      text: responseText.substring(0, 500),
    });

    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE')) {
      logger.error('Singapore /sync API returned HTML instead of JSON', {
        method,
        statusCode: response.status,
        contentType: response.headers.get('content-type'),
        responsePreview: responseText.substring(0, 200),
      });
      
      return {
        error_response: {
          code: 'HTML_RESPONSE',
          msg: 'API returned HTML instead of JSON. Endpoint may be incorrect or method not supported.',
          sub_code: 'isv.invalid-endpoint',
        },
      };
    }

    const data = JSON.parse(responseText);
    logger.debug('Singapore /sync API request successful', { data });
    return data;
  }

  /**
   * Execute TOP API request via gateway.do (signature auth)
   */
  private async executeTopApiRequest(
    method: string,
    params: Record<string, any>,
    apiBaseOverride?: string
  ): Promise<any> {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const apiBase = apiBaseOverride || this.config.apiEndpoint || 'https://openapi.aliexpress.com/gateway.do';

    const requestParams: Record<string, any> = {
      method,
      app_key: this.config.appKey,
      sign_method: 'md5',
      timestamp: timestamp,
      format: 'json',
      v: '2.0',
      simplify: 'true',
      ...params,
    };

    // Signature must be calculated BEFORE URL encoding
    const paramsForSigning = Object.entries(requestParams)
      .filter(([key]) => key !== 'sign')
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    const sign = this.generateSignature(paramsForSigning, 'md5');
    requestParams.sign = sign;

    logger.info('TOP API Signature Debug', {
      appKey: this.config.appKey,
      timestamp: timestamp,
      signMethod: 'md5',
      paramsForSigning: Object.keys(paramsForSigning).sort().join(', '),
      generatedSign: sign.substring(0, 16) + '...',
      totalParams: Object.keys(requestParams).length,
      apiBase,
    });

    const body = Object.keys(requestParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(requestParams[key]))}`)
      .join('&');

    logger.info('TOP API Request', {
      url: apiBase,
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      paramCount: Object.keys(requestParams).length,
    });

    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body,
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      logger.info('TOP API Response', {
        status: response.status,
        contentType: response.headers.get('content-type'),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('TOP API request failed', {
          status: response.status,
          errorPreview: errorText.substring(0, 500),
          sign: sign.substring(0, 16) + '...'
        });
        throw new Error(`API request failed: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const responseText = await response.text();
      logger.debug('TOP API raw response', {
        text: responseText.substring(0, 500),
      });

      // Check if response is HTML (404 page) instead of JSON
      if (responseText.trim().startsWith('<') || responseText.includes('<!DOCTYPE')) {
        logger.error('TOP API returned HTML instead of JSON', {
          method,
          statusCode: response.status,
          contentType: response.headers.get('content-type'),
          responsePreview: responseText.substring(0, 200),
        });
        
        // Return error response in expected format instead of throwing
        return {
          error_response: {
            code: 'HTML_RESPONSE',
            msg: 'API returned HTML (404 page) instead of JSON. Method may not exist or APP_KEY lacks permissions.',
            sub_code: 'isv.invalid-method',
            sub_msg: `Method ${method} not available or APP_KEY unauthorized`,
          },
        };
      }

      const data = JSON.parse(responseText);
      logger.debug('TOP API request successful', { data });
      return data;
    } catch (error) {
      logger.error('TOP API request error', { method, error });
      // Return error response instead of throwing to allow graceful handling
      return {
        error_response: {
          code: 'EXCEPTION',
          msg: error instanceof Error ? error.message : 'Unknown error',
          sub_code: 'isv.request-failed',
        },
      };
    }
  }

  private async executeRestApiRequest(
    method: string,
    params: Record<string, any>,
    restBase: string,
    includeMethodParam: boolean,
    apiPath?: string
  ): Promise<any> {
    const useEpochTimestamp = restBase.includes('api-sg.aliexpress.com');
    const restTimestamp = useEpochTimestamp
      ? String(Date.now())
      : new Date().toISOString().replace('T', ' ').substring(0, 19);
    const requestParams: Record<string, any> = {
      app_key: this.config.appKey,
      sign_method: 'md5',
      timestamp: restTimestamp,
      format: 'json',
      v: '2.0',
      simplify: 'true',
      ...params,
    };

    if (includeMethodParam) {
      requestParams.method = method;
    }

    const paramsForSigning = Object.entries(requestParams)
      .filter(([key]) => key !== 'sign')
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

    const sign = this.generateSignature(paramsForSigning, 'md5');
    requestParams.sign = sign;

    const url = apiPath
      ? `${restBase.replace(/\/$/, '')}/${apiPath}`
      : restBase;

    logger.info('Singapore API Signature Debug', {
      appKey: this.config.appKey,
      timestamp: restTimestamp,
      signMethod: requestParams.sign_method,
      allParamsForSigning: Object.keys(paramsForSigning).sort().join(', '),
      paramsCount: Object.keys(paramsForSigning).length,
      restBase: url,
    });

    const body = new URLSearchParams(
      Object.entries(requestParams).map(([key, value]) => [key, String(value)])
    ).toString();

    logger.info('Singapore API Request', {
      url,
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: body,
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    logger.info('Singapore API Response', {
      status: response.status,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Singapore API request failed', {
        status: response.status,
        errorPreview: errorText.substring(0, 500),
        sign: sign.substring(0, 16) + '...'
      });
      throw new Error(`API request failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const responseText = await response.text();
    logger.debug('Singapore API raw response', {
      text: responseText.substring(0, 500)
    });

    const data = JSON.parse(responseText);
    logger.debug('Singapore API request successful', { data });
    return data;
  }

  /**
   * Transform TOP API response to our standard format
   */
  private transformTopApiResponse(result: any, page: number, pageSize: number): AliExpressSearchResponse {
    try {
      // TOP API wraps response in method-specific key
      const responseKey = Object.keys(result)[0]; // e.g., 'aliexpress_affiliate_product_query_response'
      const responseData = result[responseKey];
      
      // Check response code (can be string "200" or number 200)
      // Response structure: { resp_code: 200, resp_msg: "...", result: {...} }
      const respCode = responseData?.resp_code;
      if (!responseData || (respCode !== 200 && respCode !== '200')) {
        logger.warn('TOP API returned error', { responseData });
        return {
          success: false,
          total: 0,
          page,
          page_size: pageSize,
          products: [],
          error: {
            code: responseData?.resp_code || 'UNKNOWN',
            message: responseData?.resp_msg || 'API error',
          },
        };
      }
      
      // Response structure: { resp_code: 200, result: { products: [...], total_record_count: N } }
      const resultData = responseData.result;
      const products = Array.isArray(resultData.products) ? resultData.products : [];
      
      logger.info(`TOP API returned ${products.length} products`, { 
        total: resultData.total_record_count,
        page,
      });
      
      // Transform products to our format
      const transformedProducts = products
        .filter((p: any) => {
          // Quality validation: filter out low-rated products
          const rating = p.evaluate_rate ? parseFloat(p.evaluate_rate) : 0;
          if (rating > 0 && rating < 4.0) {
            logger.debug('Filtering out low-rated product', { 
              productId: p.product_id, 
              title: p.product_title,
              rating 
            });
            return false;
          }
          return true;
        })
        .map((p: any) => {
        // Zbierz wszystkie dostępne zdjęcia
        const imageUrls: string[] = [];
        
        // Główne zdjęcie
        if (p.product_main_image_url || p.image_url) {
          imageUrls.push(p.product_main_image_url || p.image_url);
        }
        
        // Galeria zdjęć (AliExpress zwraca jako string z separatorem ";" lub array)
        if (p.product_small_image_urls) {
          if (typeof p.product_small_image_urls === 'string') {
            const urls = p.product_small_image_urls.split(';').filter(Boolean);
            imageUrls.push(...urls);
          } else if (Array.isArray(p.product_small_image_urls)) {
            imageUrls.push(...p.product_small_image_urls.filter(Boolean));
          }
        }
        
        // Dodatkowe pola ze zdjęciami
        if (p.second_level_image_url) imageUrls.push(p.second_level_image_url);
        if (p.first_level_image_url) imageUrls.push(p.first_level_image_url);
        
        // Deduplikacja
        const uniqueImages = [...new Set(imageUrls.filter(Boolean))];
        
        const rating = p.evaluate_rate ? parseFloat(p.evaluate_rate) : 0;
        const salesVolume = p.volume ? parseInt(p.volume, 10) : 0;
        
        return {
          item_id: p.product_id || p.item_id,
          title: p.product_title || p.title,
          image_urls: uniqueImages.length > 0 ? uniqueImages : [p.product_main_image_url || p.image_url].filter(Boolean),
          product_video_url: p.product_video_url || null,
          price: {
            current: parseFloat(p.target_sale_price || p.sale_price || '0'),
            original: parseFloat(p.target_original_price || p.original_price || '0'),
            currency: 'PLN', // M6: Always PLN from API
          },
          product_url: p.promotion_link || p.product_detail_url,
          discount_percent: p.discount ? parseFloat(p.discount) : undefined,
          rating: rating > 0 ? {
            score: rating,
            count: p.volume || 0, // Use volume as rating count proxy
          } : undefined,
          sales_volume: salesVolume, // Track sales volume for hot deal calculation
          shipping: {
            free: p.ship_to_days === '0',
            cost: 0,
          },
        };
      });
      
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
      // Map sort options
      let sort = params.sort || 'LAST_VOLUME_DESC';
      if (sort === 'price_asc') sort = 'SALE_PRICE_ASC';
      if (sort === 'price_desc') sort = 'SALE_PRICE_DESC';
      if (sort === 'rating') sort = 'LAST_VOLUME_DESC'; // API logic: Volume is best proxy for rating

      // Map params to TOP API format
      const topApiParams: Record<string, any> = {
        keywords: params.q,
        page_no: params.page || 1,
        page_size: Math.min(params.limit || 20, 50), // TOP API max 50
        target_currency: params.targetCurrency || 'PLN', // Default M6: PLN
        target_language: params.targetLanguage || 'PL',  // Default M6: PL
        ship_to_country: params.shipToCountry || 'PL',   // Default M6: PL
        sort: sort,
      };
      
      // Add tracking ID for commission tracking if available
      if (this.config.trackingId || this.config.affiliateId) {
        topApiParams.tracking_id = this.config.trackingId || this.config.affiliateId;
      }
      
      // Add optional filters
      if (params.minPrice) {
        topApiParams.min_price = params.minPrice;
      }
      if (params.maxPrice) {
        topApiParams.max_price = params.maxPrice;
      }
      
      // M6 Update: Use correct Affiliate API endpoint
      const result = await this.request<any>('aliexpress.affiliate.product.query', topApiParams);
      
      // Check for error_response from API (including HTML_RESPONSE case)
      if (result && result.error_response) {
        logger.error('API returned error', {
          code: result.error_response.code,
          msg: result.error_response.msg,
          sub_code: result.error_response.sub_code,
        });
        
        return {
          success: false,
          total: 0,
          page: topApiParams.page_no,
          page_size: topApiParams.page_size,
          products: [],
          error: {
            code: result.error_response.code,
            message: result.error_response.msg || result.error_response.sub_msg || 'API error',
          },
        };
      }
      
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

    // Enforce Polish buyer context and deep fields (M6+ Enhanced)
    const baseParams: Record<string, any> = {
      // Geo/currency/language context (CRITICAL for PL availability)
      ship_to_country: params.shipToCountry || 'PL',
      target_currency: params.targetCurrency || 'PLN',
      target_language: params.targetLanguage || 'PL',
      // Mandatory deep fields (M6+ complete set)
      fields: [
        'product_id',
        'product_title',
        'product_video_url',          // M6+: Video URL for conversion boost
        'product_main_image_url',
        'all_images',
        'product_small_image_urls',   // Additional gallery images
        'product_props',              // M6+: Technical attributes (limited by Affiliate API)
        'target_sale_price',
        'original_price',
        'discount',
        'ship_to_days',
        'evaluate_rate',
        'volume',                     // Sales volume
        'promotion_link',
        'app_sale_price',
        'store_info',                 // M6+: Seller trust data
        'ships_from_countries',       // M6+: Warehouse locations (PL detection)
        'sku_list',                   // M6+: Variant pricing for real price ranges
        'second_level_image_url',     // Additional images
        'first_level_image_url',      // Additional images
        'product_description',        // Fetch HTML description for scraping
      ].join(','),
    };

    // Add tracking ID for commission tracking if available
    if (this.config.trackingId || this.config.affiliateId) {
      baseParams.tracking_id = this.config.trackingId || this.config.affiliateId;
    }

    try {
      // NOTE: Affiliate API app category does NOT support OAuth
      // Always use Singapore /sync with signature auth for Affiliate API
      // Use only if you have Oversea Solution / Dropshipping app category
      if (this.token && process.env.ALIEXPRESS_USE_OAUTH === 'true') {
        logger.debug('Attempting OAuth endpoint (only if app supports it)');
        const body = {
          product_id: params.productId,
          ...baseParams,
        };
        return await this.request<AliExpressProductDetailsResponse>('/product/details', body);
      }

      // Singapore /sync with signature auth (PRIMARY for Affiliate API)
      const topParams = {
        product_id: params.productId,
        ...baseParams,
      };

      const methodCandidates = [
        'aliexpress.affiliate.productdetail.get',  // Singapore /sync compatible (PRIMARY)
        'aliexpress.affiliate.product.detail.get', // TOP API style (fallback, may not work on /sync)
      ];

      const isApiError = (result: any) => {
        const errorCode = result?.error_response?.code || result?.code;
        return Boolean(errorCode) || result?.type === 'ISV';
      };

      let lastResponse: AliExpressProductDetailsResponse | null = null;
      for (const method of methodCandidates) {
        const response = await this.request<AliExpressProductDetailsResponse>(method, topParams);
        lastResponse = response;
        if (!isApiError(response)) {
          return response;
        }
        logger.warn('Product details method failed, trying fallback', {
          method,
          error: (response as any)?.error_response?.code || (response as any)?.code || (response as any)?.type,
        });
      }

      return lastResponse as AliExpressProductDetailsResponse;
    } catch (error) {
      logger.error('Product details fetch failed', { error });
      throw error;
    }
  }

  /**
   * Fetch deep product details with PL context (M6)
   * Returns the first product payload or null when unavailable
   */
  async getDetails(productId: string) {
    console.log(`[AliExpress M6] Fetching details for ${productId} with PL context...`);

    const response = await this.getProductDetails({ productId });

    const product = (response as any)?.resp_result?.result?.products?.product?.[0];
    if (!product) {
      console.warn(`[AliExpress M6] No data found for ${productId}`);
      return null;
    }

    return product;
  }

  /**
   * Get logistics information for a product (shipping costs, methods, delivery time)
   * 
   * Uses AliExpress Logistics API to get comprehensive shipping data
   * Method: aliexpress.logistics.buyer.freight.get
   * 
   * @param productId AliExpress product ID
   * @param countryCode Target country code (default: PL)
   * @param quantity Product quantity (default: 1)
   * @returns Logistics info with shipping options or null if unavailable
   */
  async getLogisticsInfo(
    productId: string,
    countryCode: string = 'PL',
    quantity: number = 1
  ): Promise<{
    shippingCost: number;
    currency: string;
    isFreeShipping: boolean;
    estimatedDays: number;
    shippingMethod: string;
    options: Array<{
      method: string;
      cost: number;
      days: number;
      company: string;
    }>;
  } | null> {
    logger.info('Fetching logistics info', { productId, countryCode, quantity });
    
    try {
      const params = {
        product_id: productId,
        product_num: quantity.toString(),
        country_code: countryCode,
        send_goods_country_code: 'CN', // Most AliExpress products ship from China
      };
      
      const result = await this.request<any>('aliexpress.logistics.buyer.freight.get', params);
      
      // Parse response
      const responseKey = Object.keys(result)[0];
      const responseData = result[responseKey];
      
      if (!responseData || responseData.resp_code !== 200) {
        logger.warn('Logistics API returned error, assuming free shipping', { responseData });
        return {
          shippingCost: 0,
          currency: 'PLN',
          isFreeShipping: true,
          estimatedDays: 14,
          shippingMethod: 'Standard Shipping',
          options: [],
        };
      }
      
      const freight = responseData.result?.freight;
      if (!Array.isArray(freight) || freight.length === 0) {
        logger.info('No shipping options found, assuming free shipping');
        return {
          shippingCost: 0,
          currency: 'PLN',
          isFreeShipping: true,
          estimatedDays: 14,
          shippingMethod: 'Standard Shipping',
          options: [],
        };
      }
      
      // Parse all shipping options
      const shippingOptions = freight.map((option: any) => ({
        method: option.service_name || 'Standard',
        cost: parseFloat(option.freight_amount?.amount || '0'),
        days: parseInt(option.estimated_delivery_time || '14', 10),
        company: option.company || 'AliExpress',
      }));
      
      // Find cheapest shipping option
      const cheapestShipping = shippingOptions.reduce((min, current) => 
        current.cost < min.cost ? current : min
      , shippingOptions[0]);
      
      logger.info('Logistics info retrieved', {
        productId,
        shippingCost: cheapestShipping.cost,
        optionsCount: shippingOptions.length,
      });
      
      return {
        shippingCost: cheapestShipping.cost,
        currency: 'PLN',
        isFreeShipping: cheapestShipping.cost === 0,
        estimatedDays: cheapestShipping.days,
        shippingMethod: cheapestShipping.method,
        options: shippingOptions,
      };
    } catch (error) {
      logger.error('Logistics API error, assuming free shipping', { error });
      // Graceful degradation - assume free shipping on error
      return {
        shippingCost: 0,
        currency: 'PLN',
        isFreeShipping: true,
        estimatedDays: 14,
        shippingMethod: 'Standard Shipping',
        options: [],
      };
    }
  }

  /**
   * Calculate shipping cost to Poland (M4 Smart Pricing)
   * 
   * Simplified wrapper around getLogisticsInfo that returns only the cost
   * 
   * @param productId AliExpress product ID
   * @param country Target country code (default: PL)
   * @param quantity Product quantity (default: 1)
   * @returns Shipping cost in USD or 0 if free shipping
   */
  async calculateShipping(
    productId: string,
    country: string = 'PL',
    quantity: number = 1
  ): Promise<number> {
    logger.info('Calculating shipping cost', { productId, country, quantity });
    
    try {
      const params = {
        product_id: productId,
        product_num: quantity.toString(),
        country_code: country,
        send_goods_country_code: 'CN', // Most AliExpress products ship from China
      };
      
      const result = await this.request<any>('aliexpress.logistics.buyer.freight.get', params);
      
      // Parse response
      // Response structure: { aliexpress_logistics_buyer_freight_get_response: { result: { freight: [...] } } }
      const responseKey = Object.keys(result)[0];
      const responseData = result[responseKey];
      
      if (!responseData || responseData.resp_code !== 200) {
        logger.warn('Shipping calculation failed, assuming free shipping', { responseData });
        return 0;
      }
      
      const freight = responseData.result?.freight;
      if (!Array.isArray(freight) || freight.length === 0) {
        logger.info('No shipping cost found, assuming free shipping');
        return 0;
      }
      
      // Find cheapest shipping option
      const cheapestShipping = freight.reduce((min: any, current: any) => {
        const currentPrice = parseFloat(current.freight_amount?.amount || '0');
        const minPrice = parseFloat(min.freight_amount?.amount || '999999');
        return currentPrice < minPrice ? current : min;
      }, freight[0]);
      
      const shippingCost = parseFloat(cheapestShipping.freight_amount?.amount || '0');
      
      logger.info('Shipping cost calculated', {
        productId,
        shippingCost,
        shippingMethod: cheapestShipping.service_name,
        estimatedDays: cheapestShipping.estimated_delivery_time,
      });
      
      return shippingCost;
    } catch (error) {
      logger.error('Shipping calculation error, assuming free shipping', { error });
      // Graceful degradation - assume free shipping on error
      return 0;
    }
  }

  /**
   * Get hot products / bestsellers (M4 Smart Importing)
   * 
   * Method: aliexpress.affiliate.hotproduct.query
   * Returns best-selling products filtered by category and quality
   * 
   * @param categoryIds Category IDs to filter (optional)
   * @param targetCurrency Target currency (default: PLN)
   * @param limit Max products to return (default: 20, max: 50)
   * @returns Hot products with high conversion rates
   */
  async getHotProducts(
    categoryIds?: string[],
    targetCurrency: string = 'PLN',
    limit: number = 20
  ): Promise<any[]> {
    logger.info('Fetching hot products', { categoryIds, limit });
    
    try {
      const params: Record<string, any> = {
        target_currency: targetCurrency,
        target_language: 'PL',
        page_size: Math.min(limit, 50),
      };
      
      if (categoryIds && categoryIds.length > 0) {
        params.category_ids = categoryIds.join(',');
      }
      
      const result = await this.request<any>('aliexpress.affiliate.hotproduct.query', params);
      
      // Parse response
      const responseKey = Object.keys(result)[0];
      const responseData = result[responseKey];
      
      if (!responseData || responseData.resp_code !== 200) {
        logger.warn('Hot products fetch failed', { responseData });
        return [];
      }
      
      const products = responseData.result?.products || [];
      
      logger.info(`Fetched ${products.length} hot products`);
      
      return products;
    } catch (error) {
      logger.error('Hot products fetch failed', { error });
      return [];
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
 * - ALIEXPRESS_APP_KEY (required)
 * - ALIEXPRESS_APP_SECRET (required)
 * - ALIEXPRESS_API_ENDPOINT (optional)
 * - ALIEXPRESS_AFFILIATE_ID (optional - for tracking commissions)
 * - ALIEXPRESS_TRACKING_ID (optional - alternative to AFFILIATE_ID)
 * - ALIEXPRESS_REGION (optional - 'eu', 'us', 'sg')
 * - ALIEXPRESS_RATE_LIMIT (optional)
 * 
 * M2: Now supports multi-account via accountName parameter
 * Tokens are managed via OAuth system, no longer using env vars
 */
export function createAliExpressClient(accountName?: string): AliExpressClient {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  // Do NOT hard-fail here: OAuth token may be available via getValidToken()
  // If APP_KEY/APP_SECRET are missing, we will attempt OAuth and only fail
  // if signature auth is required without credentials.
  if (!appKey || !appSecret) {
    logger.warn('AliExpress APP_KEY/APP_SECRET not set – will attempt OAuth token authentication');
  }

  const config: AliExpressClientConfig = {
    appKey: appKey || '',
    appSecret: appSecret || '',
    apiEndpoint: process.env.ALIEXPRESS_API_ENDPOINT,
    affiliateId: process.env.ALIEXPRESS_AFFILIATE_ID || process.env.ALIEXPRESS_TRACKING_ID,
    trackingId: process.env.ALIEXPRESS_TRACKING_ID || process.env.ALIEXPRESS_AFFILIATE_ID,
    region: process.env.ALIEXPRESS_REGION,
    rateLimitPerMinute: process.env.ALIEXPRESS_RATE_LIMIT 
      ? parseInt(process.env.ALIEXPRESS_RATE_LIMIT, 10) 
      : undefined
  };
  
  return new AliExpressClient(config, 'aliexpress', accountName);
}
