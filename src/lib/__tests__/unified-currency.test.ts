/**
 * Tests for Unified Currency System
 * 
 * Tests CurrencyManager singleton and formatPrice functionality
 */

import { CurrencyManager } from '@/lib/unified-currency';

describe('CurrencyManager', () => {
  describe('convertFromPLN', () => {
    it('should convert PLN to USD correctly', () => {
      // 400 PLN / 4.0 (USD rate) = 100 USD
      const result = CurrencyManager.convertFromPLN(400, 'USD');
      expect(result).toBe(100);
    });

    it('should convert PLN to EUR correctly', () => {
      // 430 PLN / 4.3 (EUR rate) = 100 EUR
      const result = CurrencyManager.convertFromPLN(430, 'EUR');
      expect(result).toBe(100);
    });

    it('should return same amount for PLN to PLN', () => {
      const result = CurrencyManager.convertFromPLN(400, 'PLN');
      expect(result).toBe(400);
    });

    it('should handle zero amount', () => {
      const result = CurrencyManager.convertFromPLN(0, 'USD');
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // 405 PLN / 4.0 = 101.25 USD
      const result = CurrencyManager.convertFromPLN(405, 'USD');
      expect(result).toBe(101.25);
    });
  });

  describe('convertToPLN', () => {
    it('should convert USD to PLN correctly', () => {
      // 100 USD * 4.0 = 400 PLN
      const result = CurrencyManager.convertToPLN(100, 'USD');
      expect(result).toBe(400);
    });

    it('should convert EUR to PLN correctly', () => {
      // 100 EUR * 4.3 = 430 PLN
      const result = CurrencyManager.convertToPLN(100, 'EUR');
      expect(result).toBe(430);
    });

    it('should return same amount for PLN to PLN', () => {
      const result = CurrencyManager.convertToPLN(400, 'PLN');
      expect(result).toBe(400);
    });

    it('should handle decimal amounts', () => {
      // 50.50 USD * 4.0 = 202 PLN
      const result = CurrencyManager.convertToPLN(50.5, 'USD');
      expect(result).toBe(202);
    });
  });

  describe('formatPrice', () => {
    it('should format price in PLN correctly', () => {
      const result = CurrencyManager.formatPrice(400, 'PLN');
      // Polish locale should use "400,00 zł" or similar
      expect(result).toMatch(/400[.,]00/);
      expect(result).toMatch(/zł/);
    });

    it('should format price in USD correctly', () => {
      // 400 PLN = 100 USD
      const result = CurrencyManager.formatPrice(400, 'USD');
      expect(result).toMatch(/100[.,]00/);
      expect(result).toMatch(/\$/);
    });

    it('should format price in EUR correctly', () => {
      // 430 PLN = 100 EUR
      const result = CurrencyManager.formatPrice(430, 'EUR');
      expect(result).toMatch(/100[.,]00/);
      expect(result).toMatch(/€/);
    });

    it('should handle zero amount', () => {
      const result = CurrencyManager.formatPrice(0, 'PLN');
      expect(result).toMatch(/0[.,]00/);
    });

    it('should handle large amounts', () => {
      const result = CurrencyManager.formatPrice(999999.99, 'PLN');
      expect(result).toMatch(/999[.,]999/);
    });
  });

  describe('getSymbol', () => {
    it('should return correct symbol for PLN', () => {
      const symbol = CurrencyManager.getSymbol('PLN');
      expect(symbol).toBe('zł');
    });

    it('should return correct symbol for USD', () => {
      const symbol = CurrencyManager.getSymbol('USD');
      expect(symbol).toBe('$');
    });

    it('should return correct symbol for EUR', () => {
      const symbol = CurrencyManager.getSymbol('EUR');
      expect(symbol).toBe('€');
    });

    it('should return correct symbol for GBP', () => {
      const symbol = CurrencyManager.getSymbol('GBP');
      expect(symbol).toBe('£');
    });
  });

  describe('getRatesSync', () => {
    it('should return all supported rates', () => {
      const rates = CurrencyManager.getRatesSync();
      
      expect(rates.PLN).toBeDefined();
      expect(rates.USD).toBeDefined();
      expect(rates.EUR).toBeDefined();
      expect(rates.GBP).toBeDefined();
    });

    it('should return PLN as base (1.0)', () => {
      const rates = CurrencyManager.getRatesSync();
      expect(rates.PLN).toBe(1.0);
    });

    it('should return positive rates', () => {
      const rates = CurrencyManager.getRatesSync();
      
      expect(rates.USD).toBeGreaterThan(0);
      expect(rates.EUR).toBeGreaterThan(0);
      expect(rates.GBP).toBeGreaterThan(0);
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain value after round-trip conversion', () => {
      const original = 100;
      
      // USD -> PLN -> USD
      const toPLN = CurrencyManager.convertToPLN(original, 'USD');
      const backToUSD = CurrencyManager.convertFromPLN(toPLN, 'USD');
      
      expect(backToUSD).toBe(original);
    });

    it('should maintain value for EUR round-trip', () => {
      const original = 50;
      
      // EUR -> PLN -> EUR
      const toPLN = CurrencyManager.convertToPLN(original, 'EUR');
      const backToEUR = CurrencyManager.convertFromPLN(toPLN, 'EUR');
      
      expect(backToEUR).toBe(original);
    });
  });
});

describe('useCurrency hook', () => {
  // Note: Full hook testing requires React Testing Library
  // This is a placeholder for component tests
  
  it('should be importable', () => {
    expect(require('@/lib/unified-currency').useCurrency).toBeDefined();
  });

  it('should export CurrencyManager', () => {
    expect(require('@/lib/unified-currency').CurrencyManager).toBeDefined();
  });
});
