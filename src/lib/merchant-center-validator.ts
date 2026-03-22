export type MerchantValidationCode =
  | 'missing_title'
  | 'missing_image'
  | 'missing_landing_url'
  | 'invalid_landing_url'
  | 'missing_price'
  | 'invalid_currency';

export interface MerchantListingInput {
  title?: unknown;
  imageUrl?: unknown;
  landingUrl?: unknown;
  price?: unknown;
  currency?: unknown;
}

export interface MerchantValidationIssue {
  code: MerchantValidationCode;
  message: string;
}

export interface MerchantValidationResult {
  valid: boolean;
  normalized: {
    title: string;
    imageUrl: string;
    landingUrl: string;
    price: number;
    currency: string;
  };
  issues: MerchantValidationIssue[];
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCurrency(value: unknown): string {
  const raw = normalizeString(value).toUpperCase();
  if (!raw) return 'PLN';
  return /^[A-Z]{3}$/.test(raw) ? raw : 'PLN';
}

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function normalizeHttpUrl(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function validateMerchantListingInput(input: MerchantListingInput): MerchantValidationResult {
  const title = normalizeString(input.title);
  const imageUrl = normalizeHttpUrl(input.imageUrl);
  const landingUrl = normalizeHttpUrl(input.landingUrl);
  const price = parsePrice(input.price);
  const currency = normalizeCurrency(input.currency);

  const issues: MerchantValidationIssue[] = [];

  if (!title) {
    issues.push({ code: 'missing_title', message: 'Brak tytułu produktu/oferty.' });
  }

  if (!imageUrl) {
    issues.push({ code: 'missing_image', message: 'Brak poprawnego URL obrazka.' });
  }

  const rawLanding = normalizeString(input.landingUrl);
  if (!rawLanding) {
    issues.push({ code: 'missing_landing_url', message: 'Brak URL strony docelowej.' });
  } else if (!landingUrl) {
    issues.push({ code: 'invalid_landing_url', message: 'Niepoprawny URL strony docelowej.' });
  }

  if (!(price > 0)) {
    issues.push({ code: 'missing_price', message: 'Brak poprawnej ceny > 0.' });
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    issues.push({ code: 'invalid_currency', message: 'Waluta nie ma formatu ISO 4217.' });
  }

  return {
    valid: issues.length === 0,
    normalized: {
      title,
      imageUrl,
      landingUrl,
      price,
      currency,
    },
    issues,
  };
}
