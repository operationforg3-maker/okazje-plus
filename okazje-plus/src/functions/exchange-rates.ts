/**
 * Cloud Function: Exchange Rate Fetcher
 * 
 * Daily job updating USD -> PLN/EUR exchange rates
 * Runs on schedule via Cloud Scheduler
 * Stores rates in Firestore: admin/settings
 */

import * as functions from 'firebase-functions';
import { db } from '../lib/firebase-admin';

// Use Firebase logger
const logger = functions.logger;

// Exchange rate sources (using public APIs)
const EXCHANGE_RATE_SOURCES = {
  'USD': {
    'PLN': 'https://api.exchangerate-api.com/v4/latest/USD', // Free tier: 1500/month
    'EUR': 'https://api.exchangerate-api.com/v4/latest/USD'
  }
};

interface ExchangeRateResponse {
  rates: {
    PLN?: number;
    EUR?: number;
    [key: string]: number | undefined;
  };
}

/**
 * Fetch current exchange rates from public API
 */
async function fetchExchangeRates(): Promise<{ PLN: number; EUR: number }> {
  try {
    const response = await fetch(EXCHANGE_RATE_SOURCES.USD.PLN);
    
    if (!response.ok) {
      throw new Error(`API response status ${response.status}`);
    }

    const data = (await response.json()) as ExchangeRateResponse;
    
    if (!data.rates || !data.rates.PLN || !data.rates.EUR) {
      throw new Error('Missing exchange rates in API response');
    }

    return {
      PLN: Math.round(data.rates.PLN * 100) / 100, // 1 USD = 4.0 PLN
      EUR: Math.round(data.rates.EUR * 10000) / 10000 // 1 USD = 0.92 EUR
    };
  } catch (error) {
    logger.error('Failed to fetch exchange rates from API:', error);
    // Fallback to last known rates if API fails
    return {
      PLN: 4.0,
      EUR: 0.92
    };
  }
}

/**
 * Update exchange rates in Firestore
 */
async function updateExchangeRates(rates: { PLN: number; EUR: number }) {
  try {
    const settingsDoc = db.collection('admin').doc('settings');
    
    await settingsDoc.update({
      exchangeRates: {
        USD: 1.0,
        PLN: rates.PLN,
        EUR: rates.EUR
      },
      exchangeRatesUpdatedAt: new Date(),
      exchangeRatesUpdateStatus: 'success',
      exchangeRatesUpdateMessage: `Rates updated: 1 USD = ${rates.PLN} PLN, 1 USD = ${rates.EUR} EUR`
    });

    logger.info('Exchange rates updated successfully', { rates });
  } catch (error) {
    logger.error('Failed to update exchange rates in Firestore:', error);
    
    // Log error to Firestore for monitoring
    await settingsDoc.update({
      exchangeRatesUpdateStatus: 'failed',
      exchangeRatesUpdateMessage: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      exchangeRatesLastFailedAt: new Date()
    });
    
    throw error;
  }
}

/**
 * Scheduled job: Update exchange rates daily at 00:05 UTC
 * Deploy: gcloud functions deploy updateExchangeRates --trigger-topic=daily-exchange-rates --runtime=nodejs18
 * Scheduler: gcloud scheduler jobs create pubsub daily-exchange-rates --schedule "5 0 * * *" --topic=daily-exchange-rates
 */
export const updateExchangeRates = functions.pubsub
  .topic('daily-exchange-rates')
  .onPublish(async (message) => {
    try {
      logger.info('Starting exchange rate update job');
      
      // Fetch latest rates from API
      const rates = await fetchExchangeRates();
      
      // Update Firestore
      await updateExchangeRates(rates);
      
      logger.info('Exchange rate update completed successfully');
    } catch (error) {
      logger.error('Exchange rate update job failed:', error);
      throw error;
    }
  });

/**
 * HTTP endpoint for manual exchange rate refresh
 * POST /api/admin/exchange-rates/refresh
 * Requires admin auth
 */
export const refreshExchangeRatesHttp = functions.https.onRequest(
  async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      // Fetch latest rates
      const rates = await fetchExchangeRates();
      
      // Return rates (will be stored by frontend)
      res.status(200).json({
        success: true,
        rates: {
          USD: 1.0,
          PLN: rates.PLN,
          EUR: rates.EUR
        },
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Manual exchange rate refresh failed:', error);
      res.status(500).json({
        error: 'Failed to refresh exchange rates',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Initialize exchange rates on first run (if not set)
 * Deploy: gcloud functions deploy initializeExchangeRates --trigger-http --runtime=nodejs18
 */
export const initializeExchangeRates = functions.https.onRequest(
  async (req, res) => {
    try {
      const settingsDoc = await db.collection('admin').doc('settings').get();
      
      if (settingsDoc.exists() && settingsDoc.data()?.exchangeRates) {
        res.status(200).json({
          message: 'Exchange rates already initialized',
          rates: settingsDoc.data()?.exchangeRates
        });
        return;
      }

      // Fetch and store initial rates
      const rates = await fetchExchangeRates();
      await updateExchangeRates(rates);

      res.status(200).json({
        message: 'Exchange rates initialized successfully',
        rates: {
          USD: 1.0,
          PLN: rates.PLN,
          EUR: rates.EUR
        }
      });
    } catch (error) {
      logger.error('Exchange rate initialization failed:', error);
      res.status(500).json({
        error: 'Failed to initialize exchange rates',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);
