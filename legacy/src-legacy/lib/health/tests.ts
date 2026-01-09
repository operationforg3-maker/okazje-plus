'use server';

import { createAliExpressClient } from '@/integrations/aliexpress/client';

export type HealthCheckResult = {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  message?: string;
  duration: number;
};

export type HealthCheck = () => Promise<HealthCheckResult>;

const aliexpressApiConnection: HealthCheck = async () => {
  const startTime = Date.now();

  const client = createAliExpressClient();
  const { appKey, appSecret } = client.getConfig();

  if (!appKey || !appSecret) {
    return {
      id: 'aliexpress-api-connection',
      name: 'Integration-001: AliExpress API Connection',
      status: 'skipped',
      message: 'Missing API credentials (ALIEXPRESS_APP_KEY or ALIEXPRESS_APP_SECRET)',
      duration: 0,
    };
  }

  try {
    const response = await client.searchProducts({ q: 'phone case', limit: 1 });

    if (response.success && response.products.length > 0) {
      return {
        id: 'aliexpress-api-connection',
        name: 'Integration-001: AliExpress API Connection',
        status: 'passed',
        message: `Successfully connected to API and found ${response.total} products.`,
        duration: Date.now() - startTime,
      };
    } else if (response.success && response.products.length === 0) {
      return {
        id: 'aliexpress-api-connection',
        name: 'Integration-001: AliExpress API Connection',
        status: 'warning',
        message: 'API connection successful, but no products were returned for test query.',
        duration: Date.now() - startTime,
      };
    } else {
      return {
        id: 'aliexpress-api-connection',
        name: 'Integration-001: AliExpress API Connection',
        status: 'failed',
        message: `API error: ${response.error?.message || 'Unknown error'}`,
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      id: 'aliexpress-api-connection',
      name: 'Integration-01: AliExpress API Connection',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

export const healthChecks = [aliexpressApiConnection];
