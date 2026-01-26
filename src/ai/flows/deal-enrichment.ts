import { z } from 'zod';

/**
 * Deal enrichment schema and utilities
 * Generates translations and selling points for deals
 */

export const dealEnrichmentInputSchema = z.object({
  dealTitle: z.string().describe('Polish deal title'),
  merchantName: z.string().describe('Seller name'),
  merchantRating: z.number().min(0).max(5).describe('Seller rating 0-5'),
  dealType: z.string().describe('Deal type: sale, coupon, flash_deal, etc'),
  source: z.string().describe('Source: aliexpress, amazon, allegro'),
  price: z.number().describe('Price in PLN'),
  shippingCost: z.number().describe('Shipping cost in PLN'),
  shippingDays: z.number().describe('Estimated delivery days'),
});

export const dealEnrichmentOutputSchema = z.object({
  titlePL: z.string().optional().describe('Title in Polish (if translation needed)'),
  titleEN: z.string().describe('Title in English'),
  titleDE: z.string().describe('Title in German'),
  sellingPoints: z.object({
    pl: z.array(z.string()),
    en: z.array(z.string()),
    de: z.array(z.string()),
  }).describe('Key selling points per language'),
  offerSummary: z.object({
    pl: z.string(),
    en: z.string(),
    de: z.string(),
  }).describe('Short offer summary per language'),
  description: z.object({
    pl: z.string().describe('Formatted HTML description (Polish)'),
    en: z.string().describe('Formatted HTML description (English)'),
    de: z.string().describe('Formatted HTML description (German)'),
  }).optional().describe('Rich formatted deal description with HTML markup'),
  highlights: z.object({
    pl: z.array(z.string()),
    en: z.array(z.string()),
    de: z.array(z.string()),
  }).optional().describe('Key highlights/features of this specific offer'),
});

export type DealEnrichmentInput = z.infer<typeof dealEnrichmentInputSchema>;
export type DealEnrichmentOutput = z.infer<typeof dealEnrichmentOutputSchema>;

/**
 * Generate deal enrichment with AI
 * For now, uses template-based approach. Can integrate with Genkit later.
 */
export async function enrichDeal(
  input: DealEnrichmentInput
): Promise<DealEnrichmentOutput> {
  // TODO: Integrate with Genkit flow for full AI translation
  // For now, return structured data based on rules
  
  return {
    titlePL: undefined, // Not translating to Polish, we already have it
    titleEN: input.dealTitle, // Placeholder for translation
    titleDE: input.dealTitle, // Placeholder for translation
    sellingPoints: {
      pl: generateSellingPoints(input, 'pl'),
      en: generateSellingPoints(input, 'en'),
      de: generateSellingPoints(input, 'de'),
    },
    offerSummary: {
      pl: generateSummary(input, 'pl'),
      en: generateSummary(input, 'en'),
      de: generateSummary(input, 'de'),
    },
    description: {
      pl: generateRichDescription(input, 'pl'),
      en: generateRichDescription(input, 'en'),
      de: generateRichDescription(input, 'de'),
    },
    highlights: {
      pl: generateHighlights(input, 'pl'),
      en: generateHighlights(input, 'en'),
      de: generateHighlights(input, 'de'),
    },
  };
}

function generateSellingPoints(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de'): string[] {
  const points: string[] = [];

  const translations: Record<string, Record<string, string>> = {
    pl: {
      highRating: `Sprzedawca ${context.source} z oceną ${context.merchantRating}/5`,
      freeShipping: 'Bezpłatna dostawa',
      fastShipping: `Szybka dostawa (${context.shippingDays} dni)`,
      lowPrice: 'Konkurencyjna cena',
      flashDeal: 'Flash sale - ograniczona ilość',
    },
    en: {
      highRating: `Highly-rated seller on ${context.source} (${context.merchantRating}/5)`,
      freeShipping: 'Free shipping',
      fastShipping: `Fast delivery (${context.shippingDays} days)`,
      lowPrice: 'Competitive price',
      flashDeal: 'Flash sale - limited stock',
    },
    de: {
      highRating: `Hochwertiger Verkäufer auf ${context.source} (${context.merchantRating}/5)`,
      freeShipping: 'Versand frei',
      fastShipping: `Schnelle Lieferung (${context.shippingDays} Tage)`,
      lowPrice: 'Wettbewerbsfähiger Preis',
      flashDeal: 'Flash-Angebot - begrenzte Menge',
    },
  };

  const t = translations[lang] || translations.pl;

  if (context.merchantRating >= 4.5) {
    points.push(t.highRating);
  }

  if (context.shippingCost === 0) {
    points.push(t.freeShipping);
  } else if (context.shippingDays <= 5) {
    points.push(t.fastShipping);
  }

  if (context.dealType === 'flash_deal') {
    points.push(t.flashDeal);
  }

  if (points.length === 0) {
    points.push(t.lowPrice);
  }

  return points;
}

function generateSummary(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de'): string {
  const translations: Record<string, string> = {
    pl: `${context.dealTitle} od ${context.merchantName}. ${context.shippingCost === 0 ? 'Darmowa dostawa.' : `Dostawa: ${context.shippingDays} dni.`} Cena: ${context.price} PLN.`,
    en: `${context.dealTitle} from ${context.merchantName}. ${context.shippingCost === 0 ? 'Free shipping.' : `Delivery: ${context.shippingDays} days.`} Price: ${context.price} PLN.`,
    de: `${context.dealTitle} von ${context.merchantName}. ${context.shippingCost === 0 ? 'Versand frei.' : `Lieferung: ${context.shippingDays} Tage.`} Preis: ${context.price} PLN.`,
  };

  return translations[lang] || translations.pl;
}

/**
 * Generate rich HTML description for deal
 * Formats with headings, key info, and call-to-action
 */
function generateRichDescription(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de'): string {
  const labels: Record<string, Record<string, string>> = {
    pl: {
      heading: 'Szczegóły Oferty',
      cena: 'Cena:',
      dostawa: 'Dostawa:',
      sprzedawca: 'Sprzedawca:',
      bezpłatna: 'Bezpłatna dostawa',
      dni: 'dni',
    },
    en: {
      heading: 'Deal Details',
      cena: 'Price:',
      dostawa: 'Delivery:',
      sprzedawca: 'Seller:',
      bezpłatna: 'Free shipping',
      dni: 'days',
    },
    de: {
      heading: 'Angebotdetails',
      cena: 'Preis:',
      dostawa: 'Lieferung:',
      sprzedawca: 'Verkäufer:',
      bezpłatna: 'Versand frei',
      dni: 'Tage',
    },
  };

  const t = labels[lang] || labels.pl;
  const shippingInfo = context.shippingCost === 0 
    ? `<strong>${t.bezpłatna}</strong>`
    : `${context.shippingCost} PLN (${context.shippingDays} ${t.dni})`;

  return `
<div class="deal-description">
  <h3>${t.heading}</h3>
  <dl class="deal-info">
    <dt>${t.cena}</dt>
    <dd><strong>${context.price} PLN</strong></dd>
    <dt>${t.dostawa}</dt>
    <dd>${shippingInfo}</dd>
    <dt>${t.sprzedawca}</dt>
    <dd>${context.merchantName} <span class="rating">(${context.merchantRating}/5)</span></dd>
  </dl>
</div>
  `.trim();
}

/**
 * Generate deal-specific highlights/features
 */
function generateHighlights(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de'): string[] {
  const highlights: string[] = [];

  const translations: Record<string, Record<string, string>> = {
    pl: {
      bestPrice: '✓ Konkurencyjna cena',
      freeShipping: '✓ Bezpłatna dostawa',
      fastShipping: `✓ Szybka dostawa (${context.shippingDays} dni)`,
      topSeller: `✓ Zaufany sprzedawca (${context.merchantRating}/5)`,
      officialStore: '✓ Oficjalny sklep',
      flash: '✓ Oferta ograniczona czasowo',
    },
    en: {
      bestPrice: '✓ Best price available',
      freeShipping: '✓ Free shipping',
      fastShipping: `✓ Fast delivery (${context.shippingDays} days)`,
      topSeller: `✓ Trusted seller (${context.merchantRating}/5)`,
      officialStore: '✓ Official store',
      flash: '✓ Limited time offer',
    },
    de: {
      bestPrice: '✓ Bester Preis verfügbar',
      freeShipping: '✓ Kostenloser Versand',
      fastShipping: `✓ Schnelle Lieferung (${context.shippingDays} Tage)`,
      topSeller: `✓ Vertrauenswürdiger Verkäufer (${context.merchantRating}/5)`,
      officialStore: '✓ Offizieller Shop',
      flash: '✓ Zeitlich begrenztes Angebot',
    },
  };

  const t = translations[lang] || translations.pl;

  // Always include:
  highlights.push(t.bestPrice);

  // Conditional highlights:
  if (context.shippingCost === 0) {
    highlights.push(t.freeShipping);
  } else if (context.shippingDays <= 5) {
    highlights.push(t.fastShipping);
  }

  if (context.merchantRating >= 4.7) {
    highlights.push(t.topSeller);
  }

  if (context.dealType === 'flash_deal') {
    highlights.push(t.flash);
  }

  return highlights;
}
