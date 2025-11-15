// Konwersja walut dla importu AliExpress
// Kursy aktualizowane ręcznie lub z API

export const EXCHANGE_RATES: Record<string, number> = {
  'USD': 4.0,
  'EUR': 4.3,
  'GBP': 5.0,
  'CNY': 0.55,
  'PLN': 1.0,
};

/**
 * Konwertuje kwotę z dowolnej waluty na PLN
 * @param amount - Kwota do konwersji
 * @param currency - Kod waluty (USD, EUR, etc.)
 * @returns Kwota w PLN zaokrąglona do 2 miejsc po przecinku
 */
export function convertToPLN(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()] || 1.0;
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Oblicza procent zniżki
 */
export function calculateDiscount(originalPrice: number, currentPrice: number): number {
  if (!originalPrice || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}
