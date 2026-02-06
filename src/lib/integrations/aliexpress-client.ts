/**
 * AliExpress API Client
 * - OAuth 2.0 + token refresh
 * - Signing (HMAC-MD5)
 * - Retry + exponential backoff
 * - Per-method adapter dla różnych pól
 */

import crypto from "crypto";
import { logger } from "../logger";

export interface AliExpressConfig {
  appKey: string;
  appSecret: string;
  baseUrl?: string; // default: https://api-eu.aliexpress.com/router/rest (region selectable)
  region?: "eu" | "sg" | "us";
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AliExpressError {
  error_code?: string;
  error_message?: string;
  sub_code?: string;
  sub_msg?: string;
}

// ===== Generator sygnatury =====
function generateSign(
  params: Record<string, string | number | boolean>,
  appSecret: string,
  method: "hmac_md5" | "md5" = "md5"
): string {
  // Posortuj klucze alfabetycznie
  const sortedKeys = Object.keys(params).sort();

  // Zbuduj string bez kodowania URL
  let stringToSign = "";
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== null && value !== undefined && value !== "") {
      stringToSign += key + value;
    }
  }

  // HMAC-MD5 (opcjonalnie)
  if (method === "hmac_md5") {
    return crypto
      .createHmac("md5", appSecret)
      .update(stringToSign)
      .digest("hex")
      .toUpperCase();
  }

  // MD5 (AOP): appSecret + params + appSecret
  return crypto
    .createHash("md5")
    .update(appSecret + stringToSign + appSecret)
    .digest("hex")
    .toUpperCase();
}

// ===== Timestamp formatter =====
function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// ===== AliExpress Client =====
export class AliExpressClient {
  private config: AliExpressConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: number;
  private baseUrl: string;
  private retryAttempts = 3;
  private retryDelayMs = 1000;

  constructor(config: AliExpressConfig) {
    this.config = config;
    const region = config.region || "eu";
    this.baseUrl =
      config.baseUrl ||
      {
        eu: "https://api-eu.aliexpress.com/router/rest",
        sg: "https://api-sg.aliexpress.com/router/rest",
        us: "https://api-us.aliexpress.com/router/rest",
      }[region];
  }

  // ===== Setowanie tokenów (dla restore z cache) =====
  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
    logger.info("AliExpress tokens set", { expiresIn });
  }

  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.tokenExpiresAt,
    };
  }

  // ===== Token refresh (jeśli wygasł) =====
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const params: Record<string, string | number> = {
      app_key: this.config.appKey,
      refresh_token: this.refreshToken,
      method: "aliexpress.oauth.token",
      timestamp: formatTimestamp(),
      sign_method: "md5",
      v: "1.0",
    };

    params.sign = generateSign(
      params as Record<string, string | number | boolean>,
      this.config.appSecret
    );

    try {
      const response = await this.post<TokenResponse>(
        this.baseUrl,
        new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
      );

      this.accessToken = response.access_token;
      this.tokenExpiresAt =
        Date.now() + (response.expires_in || 3600) * 1000;

      logger.info("AliExpress token refreshed", {
        expiresIn: response.expires_in,
      });

      return this.accessToken;
    } catch (error) {
      logger.error("Failed to refresh AliExpress token", { error });
      throw error;
    }
  }

  // ===== Main request method =====
  private async call<T>(
    method: string,
    params?: Record<string, unknown>,
    useSession: boolean = true
  ): Promise<T> {
    // Sprawdź czy token wygasł
    if (
      useSession &&
      this.tokenExpiresAt &&
      Date.now() > this.tokenExpiresAt - 60000
    ) {
      await this.refreshAccessToken();
    }

    const requestParams: Record<string, string | number> = {
      app_key: this.config.appKey,
      method,
      timestamp: formatTimestamp(),
      sign_method: "md5",
      v: "1.0",
      format: "json",
    };

    // Dodaj session (access_token) jeśli wymagany
    if (useSession && this.accessToken) {
      requestParams.session = this.accessToken;
    }

    // Dodaj parametry specifyczne dla metody
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          requestParams[key] = String(value);
        }
      });
    }

    // Generuj sygnaturę
    requestParams.sign = generateSign(
      requestParams as Record<string, string | number | boolean>,
      this.config.appSecret
    );

    return this.executeWithRetry<T>(() =>
      this.post<T>(this.baseUrl, new URLSearchParams(Object.entries(requestParams).map(([k, v]) => [k, String(v)])))
    );
  }

  // ===== Retry logic z exponential backoff =====
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const status = error.response?.status;
      const isRetryable = status === 429 || status === 500 || status === 503;

      if (isRetryable && attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn("AliExpress request retrying", {
          attempt,
          delay,
          status,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeWithRetry<T>(fn, attempt + 1);
      }

      throw error;
    }
  }

  // ===== POST helper =====
  private async post<T>(url: string, body: URLSearchParams): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`AliExpress API error: ${response.status} - ${rawText.substring(0, 300)}`);
    }

    if (!contentType.includes("application/json") && !rawText.trim().startsWith("{")) {
      throw new Error(`AliExpress API non-JSON response: ${rawText.substring(0, 300)}`);
    }

    const data = JSON.parse(rawText);

    // Sprawdź AliExpress error response
    if (data.error_code) {
      const err: AliExpressError = data;
      logger.error("AliExpress API error response", {
        error_code: err.error_code,
        error_message: err.error_message,
        sub_code: err.sub_code,
        sub_msg: err.sub_msg,
      });
      throw new Error(
        `AliExpress error ${err.error_code}: ${err.error_message}`
      );
    }

    return data as T;
  }

  // ===== Public API Methods =====

  // Pobierz szczegóły produktu (SKU Dimension API)
  async getProductInfo(productId: string): Promise<any> {
    // endpoint: aliexpress.solution.product.info.get (docId w portalu)
    return this.call("aliexpress.solution.product.info.get", {
      product_id: productId,
    });
  }

  // Hot products (Advanced API)
  async getHotProducts(
    filters?: Record<string, unknown>
  ): Promise<any> {
    // endpoint: aliexpress.solution.product.hot.query.get (docId w portalu)
    return this.call("aliexpress.solution.product.hot.query.get", filters);
  }

  // Hot products for affiliates (Affiliate API) - returns products with affiliate links and pricing
  async getAffiliateHotProducts(
    categoryIds?: string[],
    pageSize: number = 50
  ): Promise<any> {
    const params: Record<string, any> = {
      page_size: pageSize,
      target_currency: 'PLN',
      target_language: 'PL',
      sort: 'SALE_PRICE_ASC'
    };
    
    if (categoryIds && categoryIds.length > 0) {
      params.category_ids = categoryIds.join(',');
    }
    
    // endpoint: aliexpress.affiliate.hotproduct.query
    return this.call("aliexpress.affiliate.hotproduct.query", params);
  }

  /**
   * Search for products (Affiliate API)
   * Doc: https://developers.aliexpress.com/en/doc.htm?docId=45803&docType=2
   */
  async searchAffiliateProducts(
    params: {
        keywords?: string;
        category_ids?: string;
        min_price?: number;
        max_price?: number;
        page_no?: number;
        page_size?: number;
        sort?: 'SALE_PRICE_ASC' | 'SALE_PRICE_DESC' | 'LAST_VOLUME_ASC' | 'LAST_VOLUME_DESC';
        target_currency?: string;
        target_language?: string;
        ship_to_country?: string;
        delivery_days?: number;
    }
  ): Promise<any> {
    const requestParams = {
        target_currency: 'PLN',
        target_language: 'PL',
        ship_to_country: 'PL',
        page_size: 20,
        ...params
    };
    
    // endpoint: aliexpress.affiliate.product.query
    return this.call("aliexpress.affiliate.product.query", requestParams);
  }

  /**
   * Get product details with affiliate links (Affiliate API)
   * Doc: https://developers.aliexpress.com/en/doc.htm?docId=45802&docType=2
   */
  async getAffiliateProductDetails(
     productIds: string[]
  ): Promise<any> {
      if (productIds.length > 50) {
          throw new Error("Max 50 product IDs per request");
      }
      
      const params = {
          product_ids: productIds.join(','),
          target_currency: 'PLN',
          target_language: 'PL',
          ship_to_country: 'PL'
      };
      
      // endpoint: aliexpress.affiliate.product.detail.get
      return this.call("aliexpress.affiliate.product.detail.get", params);
  }
  
  /**
   * Smart Match Recommendations (Affiliate API)
   * Doc: https://developers.aliexpress.com/en/doc.htm?docId=45804&docType=2
   */
   async smartMatchAffiliate(productId: string): Promise<any> {
       const params = {
           product_id: productId,
           target_currency: 'PLN',
           target_language: 'PL',
           ship_to_country: 'PL'
       };

       // endpoint: aliexpress.affiliate.product.smartmatch
       return this.call("aliexpress.affiliate.product.smartmatch", params);
   }

  // Smart match (Advanced API)
  async smartMatch(keywords: string): Promise<any> {
    // endpoint: aliexpress.solution.product.smart.match (docId w portalu)
    return this.call("aliexpress.solution.product.smart.match", {
      keywords,
    });
  }

  // Generuj tracking link (Affiliates API)
  async generateTrackingLink(productId: string): Promise<any> {
    // endpoint: aliexpress.solution.affiliate.link.generate (docId w portalu)
    return this.call("aliexpress.solution.affiliate.link.generate", {
      product_id: productId,
    });
  }

  // Get Xinghe Merchant License
  async getMerchantLicense(sellerId: string): Promise<any> {
    // endpoint: aliexpress.solution.xinghe.merchant.get (docId w portalu)
    return this.call("aliexpress.solution.xinghe.merchant.get", {
      seller_id: sellerId,
    });
  }

  // Logowanie lub exchange auth code na access_token
  async getTokenFromAuthCode(authCode: string): Promise<TokenResponse> {
    const params: Record<string, string | number> = {
      app_key: this.config.appKey,
      code: authCode,
      method: "aliexpress.oauth.authorize",
      timestamp: formatTimestamp(),
      sign_method: "hmac_md5",
      v: "1.0",
    };

    params.sign = generateSign(
      params as Record<string, string | number | boolean>,
      this.config.appSecret
    );

    const response = await this.post<TokenResponse>(
      this.baseUrl,
      new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    );

    this.setTokens(
      response.access_token,
      response.refresh_token,
      response.expires_in
    );

    return response;
  }
}

// ===== Singleton instance =====
let clientInstance: AliExpressClient | null = null;

export function getAliExpressClient(): AliExpressClient {
  if (!clientInstance) {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;

    if (!appKey || !appSecret) {
      throw new Error(
        "ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET environment variables are required"
      );
    }

    clientInstance = new AliExpressClient({
      appKey,
      appSecret,
      baseUrl: process.env.ALIEXPRESS_API_ENDPOINT || process.env.ALIEXPRESS_API_BASE || undefined,
      region: (process.env.ALIEXPRESS_REGION as any) || "eu",
    });
  }

  return clientInstance;
}
