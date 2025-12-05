/**
 * Convertiser API Client
 * - Token-based authentication
 * - Paginacja, filtrowanie, sortowanie
 * - Retry + exponential backoff
 * - Type-safe wrappers dla głównych endpointów
 */

import logger from "../logger";

export interface ConvertiserConfig {
  apiToken: string;
  baseUrl?: string; // default: https://api.convertiser.com/
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface ConvertiserListResponse<T> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

// ===== Convertiser Client =====
export class ConvertiserClient {
  private config: ConvertiserConfig;
  private baseUrl: string;
  private retryAttempts = 3;
  private retryDelayMs = 1000;

  constructor(config: ConvertiserConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || "https://api.convertiser.com/";
  }

  // ===== Private: HTTP request =====
  private async request<T>(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
      body?: any;
      query?: Record<string, any>;
    }
  ): Promise<T> {
    return this.executeWithRetry<T>(() =>
      this.makeRequest<T>(endpoint, options)
    );
  }

  private async makeRequest<T>(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
      body?: any;
      query?: Record<string, any>;
    }
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    // Dodaj query parameters
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: HeadersInit = {
      Authorization: `Token ${this.config.apiToken}`,
      "Content-Type": "application/json",
    };

    const fetchOptions: RequestInit = {
      method: options?.method || "GET",
      headers,
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Handle redirects (Convertiser wymaga trailing slash)
    if (response.status === 301 || response.status === 302) {
      logger.warn("Convertiser redirect detected", {
        originalUrl: url.toString(),
        status: response.status,
      });
      // Retry z trailing slash
      return this.makeRequest<T>(endpoint + "/", options);
    }

    if (!response.ok) {
      const error = await response.text();
      logger.error("Convertiser API error", {
        status: response.status,
        endpoint,
        error,
      });
      throw new Error(`Convertiser error ${response.status}: ${error}`);
    }

    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ===== Retry logic =====
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const status = error.message?.match(/error (\d+)/)?.[1];
      const isRetryable =
        status === "429" || status === "500" || status === "503";

      if (isRetryable && attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn("Convertiser request retrying", {
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

  // ===== Public: Websites API =====
  async listWebsites(
    pagination?: PaginationParams,
    filters?: { status?: string; country?: string }
  ): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/websites/",
      {
        method: "GET",
        query: { ...pagination, ...filters },
      }
    );
  }

  async getWebsite(uuid: string): Promise<any> {
    return this.request<any>(`publisher/websites/${uuid}/`, {
      method: "GET",
    });
  }

  async createWebsite(data: any): Promise<any> {
    return this.request<any>("publisher/websites/", {
      method: "POST",
      body: data,
    });
  }

  async updateWebsite(uuid: string, data: any): Promise<any> {
    return this.request<any>(`publisher/websites/${uuid}/`, {
      method: "PUT",
      body: data,
    });
  }

  async patchWebsite(uuid: string, data: any): Promise<any> {
    return this.request<any>(`publisher/websites/${uuid}/`, {
      method: "PATCH",
      body: data,
    });
  }

  async deleteWebsite(uuid: string): Promise<void> {
    await this.request<void>(`publisher/websites/${uuid}/`, {
      method: "DELETE",
    });
  }

  async verifyWebsite(uuid: string): Promise<any> {
    return this.request<any>(`publisher/websites/${uuid}/verify/`, {
      method: "PUT",
    });
  }

  // ===== Public: Offers API =====
  async listOffers(
    pagination?: PaginationParams,
    filters?: { status?: string; country?: string; category?: string }
  ): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/offers/",
      {
        method: "GET",
        query: { ...pagination, ...filters },
      }
    );
  }

  async findOffers(filters: Record<string, any>): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/offers/find/",
      {
        method: "GET",
        query: filters,
      }
    );
  }

  async getOfferDetail(uuid: string): Promise<any> {
    return this.request<any>(`publisher/offers/${uuid}/`, {
      method: "GET",
    });
  }

  async generateOfferTrackingLink(uuid: string, params?: any): Promise<any> {
    return this.request<any>(
      `publisher/offers/${uuid}/tracking_link/`,
      {
        method: "PUT",
        body: params || {},
      }
    );
  }

  // ===== Public: Products API =====
  async searchProducts(query: any, pagination?: PaginationParams): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/products/",
      {
        method: "POST",
        body: { ...query, ...pagination },
      }
    );
  }

  async searchProductsV2(query: any, pagination?: PaginationParams): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/products/v2/",
      {
        method: "POST",
        body: { ...query, ...pagination },
      }
    );
  }

  async generateProductTrackingLink(
    productId: string,
    params?: any
  ): Promise<any> {
    return this.request<any>(
      `publisher/products/${productId}/tracking_link/`,
      {
        method: "PUT",
        body: params || {},
      }
    );
  }

  async getProductStats(productIds: string[]): Promise<any> {
    return this.request<any>("publisher/products/stats/", {
      method: "POST",
      body: { product_ids: productIds },
    });
  }

  async listExportTemplates(pagination?: PaginationParams): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/products/export_templates/",
      {
        method: "GET",
        query: pagination,
      }
    );
  }

  async getExportTemplate(uuid: string): Promise<any> {
    return this.request<any>(
      `publisher/products/export_templates/${uuid}/`,
      {
        method: "GET",
      }
    );
  }

  async createExportTemplate(data: any): Promise<any> {
    return this.request<any>(
      "publisher/products/export_templates/",
      {
        method: "POST",
        body: data,
      }
    );
  }

  async updateExportTemplate(uuid: string, data: any): Promise<any> {
    return this.request<any>(
      `publisher/products/export_templates/${uuid}/`,
      {
        method: "PUT",
        body: data,
      }
    );
  }

  async patchExportTemplate(uuid: string, data: any): Promise<any> {
    return this.request<any>(
      `publisher/products/export_templates/${uuid}/`,
      {
        method: "PATCH",
        body: data,
      }
    );
  }

  async deleteExportTemplate(uuid: string): Promise<void> {
    await this.request<void>(
      `publisher/products/export_templates/${uuid}/`,
      {
        method: "DELETE",
      }
    );
  }

  // ===== Public: Billing API =====
  async getBillingAccounts(): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/billing_accounts/",
      {
        method: "GET",
      }
    );
  }

  async getUnifiedBalance(): Promise<any> {
    return this.request<any>(
      "publisher/billing_accounts/unified_balance/",
      {
        method: "GET",
      }
    );
  }

  async listTransactions(pagination?: PaginationParams): Promise<ConvertiserListResponse<any>> {
    return this.request<ConvertiserListResponse<any>>(
      "publisher/transactions/",
      {
        method: "GET",
        query: pagination,
      }
    );
  }

  async getTransaction(id: string): Promise<any> {
    return this.request<any>(`publisher/transactions/${id}/`, {
      method: "GET",
    });
  }

  // ===== Public: System Info =====
  async getCountries(): Promise<any[]> {
    const response = await this.request<{ results: any[] }>(
      "system/countries/",
      { method: "GET" }
    );
    return response.results || [];
  }

  async getCurrencies(): Promise<any[]> {
    const response = await this.request<{ results: any[] }>(
      "system/currencies/",
      { method: "GET" }
    );
    return response.results || [];
  }

  async getLanguages(): Promise<any[]> {
    const response = await this.request<{ results: any[] }>(
      "system/languages/",
      { method: "GET" }
    );
    return response.results || [];
  }

  async getOfferCategories(): Promise<any[]> {
    const response = await this.request<{ results: any[] }>(
      "system/offer_categories/",
      { method: "GET" }
    );
    return response.results || [];
  }
}

// ===== Singleton instance =====
let clientInstance: ConvertiserClient | null = null;

export function getConvertiserClient(): ConvertiserClient {
  if (!clientInstance) {
    const token = process.env.CONVERTISER_API_TOKEN;
    if (!token) {
      throw new Error(
        "CONVERTISER_API_TOKEN environment variable is required"
      );
    }

    clientInstance = new ConvertiserClient({ apiToken: token });
  }

  return clientInstance;
}
