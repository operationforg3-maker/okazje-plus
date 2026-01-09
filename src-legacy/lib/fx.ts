import { logger } from './logger';

// Lightweight in-memory cache for FX rates
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache: Record<string, { rates: Record<string, number>; expiresAt: number }> = {};

const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { PLN: 4.0, EUR: 0.92, USD: 1.0 },
  PLN: { PLN: 1.0, EUR: 0.23, USD: 0.25 },
  EUR: { PLN: 4.35, EUR: 1.0, USD: 1.09 },
};

function buildUrl(base: string): string {
  const apiBase = process.env.FX_API_URL || 'https://api.exchangerate.host/latest';
  const url = new URL(apiBase);
  url.searchParams.set('base', base);
  return url.toString();
}

async function fetchRates(base: string): Promise<Record<string, number>> {
  const url = buildUrl(base);
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`FX API error ${res.status}`);
  }
  const body = await res.json();
  if (!body?.rates || typeof body.rates !== 'object') {
    throw new Error('FX API malformed response');
  }
  return body.rates as Record<string, number>;
}

export async function getFxRate(base: string, target: string): Promise<number> {
  const upperBase = base.toUpperCase();
  const upperTarget = target.toUpperCase();

  const cached = cache[upperBase];
  if (cached && cached.expiresAt > Date.now()) {
    const rate = cached.rates[upperTarget];
    if (rate) return rate;
  }

  try {
    const rates = await fetchRates(upperBase);
    cache[upperBase] = { rates, expiresAt: Date.now() + CACHE_TTL_MS };
    const rate = rates[upperTarget];
    if (rate) return rate;
    throw new Error('Rate not found');
  } catch (error) {
    logger.warn('FX API failed, using fallback', { error, base: upperBase, target: upperTarget });
    const rate = FALLBACK_RATES[upperBase]?.[upperTarget];
    if (rate) return rate;
    return 1.0;
  }
}

export async function convertPrice(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  const rate = await getFxRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}
