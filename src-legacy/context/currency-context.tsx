"use client";

import React, { createContext, useContext, useMemo, useState } from 'react';

type Currency = 'USD' | 'PLN' | 'EUR';

type ExchangeRates = {
  USD: number;
  PLN: number;
  EUR: number;
};

type CurrencyContextValue = {
  currentCurrency: Currency;
  setCurrency: (c: Currency) => void;
  exchangeRates: ExchangeRates;
  formatPrice: (amountInUSD: number) => string;
  usePrice: (amountInUSD: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currentCurrency, setCurrency] = useState<Currency>('PLN');
  const exchangeRates = useMemo<ExchangeRates>(
    () => ({ USD: 1.0, PLN: 4.0, EUR: 0.92 }),
    []
  );

  const formatIntl = (amount: number, currency: Currency) =>
    new Intl.NumberFormat(
      currency === 'PLN' ? 'pl-PL' : currency === 'EUR' ? 'de-DE' : 'en-US',
      { style: 'currency', currency }
    ).format(amount);

  const convertFromUSD = (amountInUSD: number, currency: Currency) => {
    const rate = currency === 'USD' ? exchangeRates.USD : currency === 'PLN' ? exchangeRates.PLN : exchangeRates.EUR;
    return amountInUSD * rate;
  };

  const formatPrice = (amountInUSD: number) => formatIntl(convertFromUSD(amountInUSD, currentCurrency), currentCurrency);
  const usePrice = (amountInUSD: number) => formatIntl(convertFromUSD(amountInUSD, currentCurrency), currentCurrency);

  const value: CurrencyContextValue = {
    currentCurrency,
    setCurrency,
    exchangeRates,
    formatPrice,
    usePrice,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
