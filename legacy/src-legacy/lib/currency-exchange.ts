/**
 * Currency Exchange Service - NBP API Integration
 * 
 * Pobiera aktualne kursy walut z API Narodowego Banku Polskiego
 * https://api.nbp.pl/
 */

interface NBPExchangeRate {
  currency: string;
  code: string;
  mid: number;
}

interface NBPResponse {
  table: string;
  no: string;
  effectiveDate: string;
  rates: NBPExchangeRate[];
}

// Cache dla kursów (ważny 24h)
const exchangeRateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 godziny

/**
 * Pobierz kurs waluty z NBP API
 * @param currency Kod waluty (USD, EUR, GBP, etc.)
 * @returns Kurs wymiany względem PLN
 */
export async function getExchangeRate(currency: string): Promise<number> {
  // PLN to PLN = 1
  if (currency === 'PLN') {
    return 1;
  }

  const currencyUpper = currency.toUpperCase();
  
  // Sprawdź cache
  const cached = exchangeRateCache.get(currencyUpper);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[NBP] Using cached rate for ${currencyUpper}: ${cached.rate}`);
    return cached.rate;
  }

  try {
    // Pobierz z NBP API (tabela A - kursy średnie)
    const url = `https://api.nbp.pl/api/exchangerates/rates/a/${currencyUpper}/?format=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NBP API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { rates: Array<{ mid: number }> };
    const rate = data.rates[0].mid;

    // Zapisz do cache
    exchangeRateCache.set(currencyUpper, {
      rate,
      timestamp: Date.now(),
    });

    console.log(`[NBP] Fetched fresh rate for ${currencyUpper}: ${rate} PLN`);
    return rate;

  } catch (error) {
    console.error(`[NBP] Failed to fetch exchange rate for ${currencyUpper}:`, error);
    
    // Fallback - użyj stałych wartości (aktualne na grudzień 2024)
    const fallbackRates: Record<string, number> = {
      USD: 4.0,
      EUR: 4.3,
      GBP: 5.1,
      CNY: 0.55, // Chinese Yuan
    };

    const fallbackRate = fallbackRates[currencyUpper];
    if (fallbackRate) {
      console.warn(`[NBP] Using fallback rate for ${currencyUpper}: ${fallbackRate} PLN`);
      return fallbackRate;
    }

    throw new Error(`No exchange rate available for ${currencyUpper}`);
  }
}

/**
 * Przelicz cenę z jednej waluty na PLN
 * @param amount Kwota
 * @param fromCurrency Waluta źródłowa (USD, EUR, etc.)
 * @returns Kwota w PLN
 */
export async function convertToPLN(amount: number, fromCurrency: string): Promise<number> {
  if (fromCurrency === 'PLN') {
    return amount;
  }

  const rate = await getExchangeRate(fromCurrency);
  const pln = amount * rate;
  
  console.log(`[Currency] ${amount} ${fromCurrency} = ${pln.toFixed(2)} PLN (rate: ${rate})`);
  
  return Math.round(pln * 100) / 100; // Zaokrąglij do 2 miejsc po przecinku
}

/**
 * Wyczyść cache kursów (przydatne do testów)
 */
export function clearExchangeRateCache(): void {
  exchangeRateCache.clear();
  console.log('[NBP] Exchange rate cache cleared');
}
