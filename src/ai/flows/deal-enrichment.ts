import { z } from 'zod';
import { ai } from '../genkit';
import { logger } from '@/lib/logging';
import { parseJsonFromResponse } from '@/lib/vertex';
import { translateContent } from '@/ai/flows/enrichment';

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
  sourceLocale: z.string().optional().describe('Source locale for title/description'),
});

export const dealEnrichmentOutputSchema = z.object({
  titlePL: z.string().optional().describe('Title in Polish (if translation needed)'),
  titleEN: z.string().describe('Title in English'),
  titleDE: z.string().describe('Title in German'),
  titleFR: z.string().describe('Title in French'),
  titleES: z.string().describe('Title in Spanish'),
  titleUK: z.string().describe('Title in Ukrainian'),
  titleIT: z.string().optional().describe('Title in Italian'),
  sellingPoints: z.object({
    pl: z.array(z.string()),
    en: z.array(z.string()),
    de: z.array(z.string()),
    fr: z.array(z.string()),
    es: z.array(z.string()),
    uk: z.array(z.string()),
    it: z.array(z.string()).optional(),
  }).describe('Key selling points per language'),
  offerSummary: z.object({
    pl: z.string(),
    en: z.string(),
    de: z.string(),
    fr: z.string(),
    es: z.string(),
    uk: z.string(),
    it: z.string().optional(),
  }).describe('Short offer summary per language'),
  description: z.object({
    pl: z.string().describe('Formatted HTML description (Polish)'),
    en: z.string().describe('Formatted HTML description (English)'),
    de: z.string().describe('Formatted HTML description (German)'),
    fr: z.string().describe('Formatted HTML description (French)'),
    es: z.string().describe('Formatted HTML description (Spanish)'),
    uk: z.string().describe('Formatted HTML description (Ukrainian)'),
    it: z.string().optional().describe('Formatted HTML description (Italian)'),
  }).optional().describe('Rich formatted deal description with HTML markup'),
  highlights: z.object({
    pl: z.array(z.string()),
    en: z.array(z.string()),
    de: z.array(z.string()),
    fr: z.array(z.string()),
    es: z.array(z.string()),
    uk: z.array(z.string()),
    it: z.array(z.string()).optional(),
  }).optional().describe('Key highlights/features of this specific offer'),
});

export type DealEnrichmentInput = z.infer<typeof dealEnrichmentInputSchema>;
export type DealEnrichmentOutput = z.infer<typeof dealEnrichmentOutputSchema>;

/**
 * Generate deal enrichment — AI-first with template fallback.
 * AI path: single Gemini call generates all 6-locale content with native writing quality.
 * Fallback: rule-based templates (fast, no API cost, but generic).
 */
export async function enrichDeal(
  input: DealEnrichmentInput
): Promise<DealEnrichmentOutput> {
  try {
    return await enrichDealWithAI(input);
  } catch (error) {
    logger.warn('AI deal enrichment failed, falling back to templates', {
      error: error instanceof Error ? error.message : String(error),
      dealTitle: input.dealTitle,
    });
    return enrichDealWithTemplates(input);
  }
}

/**
 * AI-powered deal enrichment via Gemini.
 * Generates native-quality titles, selling points, summaries, descriptions and highlights
 * for all 6 locales in a single request — avoiding back-and-forth literal translation.
 */
async function enrichDealWithAI(input: DealEnrichmentInput): Promise<DealEnrichmentOutput> {
  const sourceLocale = (input.sourceLocale || 'pl').toLowerCase();

  const shippingLine =
    input.shippingCost === 0
      ? 'Free shipping included'
      : `${input.shippingCost} PLN shipping, estimated ${input.shippingDays} day(s) delivery`;

  const prompt = `You are a professional deal copywriter for a European price comparison marketplace (like Idealo or Ceneo).
Write compelling, conversion-focused deal content in 6 languages: Polish (pl), English (en), German (de), French (fr), Spanish (es), Ukrainian (uk).
Write NATIVE-QUALITY text — not literal translations of Polish. Each language must feel natural to a native speaker.

DEAL DETAILS:
- Product title: "${input.dealTitle}"
- Title source language: ${sourceLocale}
- Seller: ${input.merchantName} (rating: ${input.merchantRating}/5 stars)
- Price: ${input.price} PLN
- Shipping: ${shippingLine}
- Deal type: ${input.dealType}
- Platform: ${input.source}

CONTENT RULES:
1. titleTranslations — translate the product name natively into each of the 6 languages. If the source is already that language, keep it as-is.
2. sellingPoints — 3–5 short bullet-ready benefits (price, shipping speed, seller trust, deal type). Concise, native language.
3. offerSummary — 1–2 sentence pitch answering "why buy now?". Conversational, no clickbait.
4. description — minimal HTML using <p> and optionally <ul>/<li>. 2–3 sentences or bullets highlighting the offer value. Do NOT invent specs not in the title.
5. highlights — 3–4 checkmark-style strings (prefix with ✓). E.g.: "✓ Free shipping", "✓ Trusted seller 4.8/5".

Return STRICTLY valid JSON only — no markdown fences, no extra keys:
{
  "titleTranslations": { "pl": "...", "en": "...", "de": "...", "fr": "...", "es": "...", "uk": "..." },
  "sellingPoints": {
    "pl": ["...", "..."], "en": ["...", "..."], "de": ["...", "..."],
    "fr": ["...", "..."], "es": ["...", "..."], "uk": ["...", "..."]
  },
  "offerSummary": { "pl": "...", "en": "...", "de": "...", "fr": "...", "es": "...", "uk": "..." },
  "description": {
    "pl": "<p>...</p>", "en": "<p>...</p>", "de": "<p>...</p>",
    "fr": "<p>...</p>", "es": "<p>...</p>", "uk": "<p>...</p>"
  },
  "highlights": {
    "pl": ["✓ ...", "✓ ..."], "en": ["✓ ...", "✓ ..."], "de": ["✓ ...", "✓ ..."],
    "fr": ["✓ ...", "✓ ..."], "es": ["✓ ...", "✓ ..."], "uk": ["✓ ...", "✓ ..."]
  }
}`;

  const response = await ai.generate({
    model: 'vertexai/gemini-2.5-flash',
    prompt,
    config: { temperature: 0.4, maxOutputTokens: 2000 },
  });

  const parsed = parseJsonFromResponse(response.text ?? '');
  const tt = (parsed.titleTranslations as Record<string, string>) || {};
  const sp = (parsed.sellingPoints as Record<string, string[]>) || {};
  const os = (parsed.offerSummary as Record<string, string>) || {};
  const desc = (parsed.description as Record<string, string>) || {};
  const hl = (parsed.highlights as Record<string, string[]>) || {};
  const fallback = input.dealTitle;

  return {
    titlePL: tt.pl || (sourceLocale === 'pl' ? undefined : fallback),
    titleEN: tt.en || fallback,
    titleDE: tt.de || fallback,
    titleFR: tt.fr || fallback,
    titleES: tt.es || fallback,
    titleUK: tt.uk || fallback,
    sellingPoints: {
      pl: sp.pl?.length ? sp.pl : [],
      en: sp.en?.length ? sp.en : [],
      de: sp.de?.length ? sp.de : [],
      fr: sp.fr?.length ? sp.fr : [],
      es: sp.es?.length ? sp.es : [],
      uk: sp.uk?.length ? sp.uk : [],
    },
    offerSummary: {
      pl: os.pl || '',
      en: os.en || '',
      de: os.de || '',
      fr: os.fr || '',
      es: os.es || '',
      uk: os.uk || '',
    },
    description: {
      pl: desc.pl || '',
      en: desc.en || '',
      de: desc.de || '',
      fr: desc.fr || '',
      es: desc.es || '',
      uk: desc.uk || '',
    },
    highlights: {
      pl: hl.pl?.length ? hl.pl : [],
      en: hl.en?.length ? hl.en : [],
      de: hl.de?.length ? hl.de : [],
      fr: hl.fr?.length ? hl.fr : [],
      es: hl.es?.length ? hl.es : [],
      uk: hl.uk?.length ? hl.uk : [],
    },
  };
}

/**
 * Template-based fallback — used when AI call fails.
 * Uses translateContent for titles + deterministic rules for other fields.
 */
async function enrichDealWithTemplates(input: DealEnrichmentInput): Promise<DealEnrichmentOutput> {
  const sourceLocale = (input.sourceLocale || 'pl').toLowerCase();
  const targetLocales = ['pl', 'en', 'de', 'fr', 'es', 'uk'].filter((lang) => lang !== sourceLocale);

  let translatedTitles: Record<string, string> = {};
  try {
    const translation = await translateContent({
      text: input.dealTitle,
      sourceLocale,
      targetLocales,
    });
    translatedTitles = translation.translations || {};
  } catch {
    translatedTitles = {};
  }

  const titlePL = sourceLocale === 'pl' ? input.dealTitle : translatedTitles.pl || input.dealTitle;
  const titleEN = sourceLocale === 'en' ? input.dealTitle : translatedTitles.en || input.dealTitle;
  const titleDE = sourceLocale === 'de' ? input.dealTitle : translatedTitles.de || input.dealTitle;
  const titleFR = sourceLocale === 'fr' ? input.dealTitle : translatedTitles.fr || input.dealTitle;
  const titleES = sourceLocale === 'es' ? input.dealTitle : translatedTitles.es || input.dealTitle;
  const titleUK = sourceLocale === 'uk' ? input.dealTitle : translatedTitles.uk || input.dealTitle;

  return {
    titlePL,
    titleEN,
    titleDE,
    titleFR,
    titleES,
    titleUK,
    sellingPoints: {
      pl: generateSellingPoints(input, 'pl'),
      en: generateSellingPoints(input, 'en'),
      de: generateSellingPoints(input, 'de'),
      fr: generateSellingPoints(input, 'fr'),
      es: generateSellingPoints(input, 'es'),
      uk: generateSellingPoints(input, 'uk'),
    },
    offerSummary: {
      pl: generateSummary(input, 'pl'),
      en: generateSummary(input, 'en'),
      de: generateSummary(input, 'de'),
      fr: generateSummary(input, 'fr'),
      es: generateSummary(input, 'es'),
      uk: generateSummary(input, 'uk'),
    },
    description: {
      pl: generateRichDescription(input, 'pl'),
      en: generateRichDescription(input, 'en'),
      de: generateRichDescription(input, 'de'),
      fr: generateRichDescription(input, 'fr'),
      es: generateRichDescription(input, 'es'),
      uk: generateRichDescription(input, 'uk'),
    },
    highlights: {
      pl: generateHighlights(input, 'pl'),
      en: generateHighlights(input, 'en'),
      de: generateHighlights(input, 'de'),
      fr: generateHighlights(input, 'fr'),
      es: generateHighlights(input, 'es'),
      uk: generateHighlights(input, 'uk'),
    },
  };
}

function generateSellingPoints(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk'): string[] {
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
    fr: {
      highRating: `Vendeur bien noté sur ${context.source} (${context.merchantRating}/5)`,
      freeShipping: 'Livraison gratuite',
      fastShipping: `Livraison rapide (${context.shippingDays} jours)`,
      lowPrice: 'Prix compétitif',
      flashDeal: 'Vente flash - stock limité',
    },
    es: {
      highRating: `Vendedor bien valorado en ${context.source} (${context.merchantRating}/5)`,
      freeShipping: 'Envío gratis',
      fastShipping: `Entrega rápida (${context.shippingDays} días)`,
      lowPrice: 'Precio competitivo',
      flashDeal: 'Oferta flash - stock limitado',
    },
    uk: {
      highRating: `Продавець з високим рейтингом на ${context.source} (${context.merchantRating}/5)`,
      freeShipping: 'Безкоштовна доставка',
      fastShipping: `Швидка доставка (${context.shippingDays} днів)`,
      lowPrice: 'Конкурентна ціна',
      flashDeal: 'Flash-розпродаж — обмежена кількість',
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

function generateSummary(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk'): string {
  const translations: Record<string, string> = {
    pl: `${context.dealTitle} od ${context.merchantName}. ${context.shippingCost === 0 ? 'Darmowa dostawa.' : `Dostawa: ${context.shippingDays} dni.`} Cena: ${context.price} PLN.`,
    en: `${context.dealTitle} from ${context.merchantName}. ${context.shippingCost === 0 ? 'Free shipping.' : `Delivery: ${context.shippingDays} days.`} Price: ${context.price} PLN.`,
    de: `${context.dealTitle} von ${context.merchantName}. ${context.shippingCost === 0 ? 'Versand frei.' : `Lieferung: ${context.shippingDays} Tage.`} Preis: ${context.price} PLN.`,
    fr: `${context.dealTitle} par ${context.merchantName}. ${context.shippingCost === 0 ? 'Livraison gratuite.' : `Livraison: ${context.shippingDays} jours.`} Prix: ${context.price} PLN.`,
    es: `${context.dealTitle} de ${context.merchantName}. ${context.shippingCost === 0 ? 'Envío gratis.' : `Entrega: ${context.shippingDays} días.`} Precio: ${context.price} PLN.`,
    uk: `${context.dealTitle} від ${context.merchantName}. ${context.shippingCost === 0 ? 'Безкоштовна доставка.' : `Доставка: ${context.shippingDays} днів.`} Ціна: ${context.price} PLN.`,
  };

  return translations[lang] || translations.pl;
}

/**
 * Generate rich HTML description for deal
 * Formats with headings, key info, and call-to-action
 */
function generateRichDescription(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk'): string {
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
    fr: {
      heading: 'Détails de l’offre',
      cena: 'Prix :',
      dostawa: 'Livraison :',
      sprzedawca: 'Vendeur :',
      bezpłatna: 'Livraison gratuite',
      dni: 'jours',
    },
    es: {
      heading: 'Detalles de la oferta',
      cena: 'Precio:',
      dostawa: 'Entrega:',
      sprzedawca: 'Vendedor:',
      bezpłatna: 'Envío gratis',
      dni: 'días',
    },
    uk: {
      heading: 'Деталі пропозиції',
      cena: 'Ціна:',
      dostawa: 'Доставка:',
      sprzedawca: 'Продавець:',
      bezpłatna: 'Безкоштовна доставка',
      dni: 'днів',
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
function generateHighlights(context: DealEnrichmentInput, lang: 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk'): string[] {
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
    fr: {
      bestPrice: '✓ Meilleur prix disponible',
      freeShipping: '✓ Livraison gratuite',
      fastShipping: `✓ Livraison rapide (${context.shippingDays} jours)`,
      topSeller: `✓ Vendeur de confiance (${context.merchantRating}/5)`,
      officialStore: '✓ Boutique officielle',
      flash: '✓ Offre limitée dans le temps',
    },
    es: {
      bestPrice: '✓ Mejor precio disponible',
      freeShipping: '✓ Envío gratis',
      fastShipping: `✓ Entrega rápida (${context.shippingDays} días)`,
      topSeller: `✓ Vendedor de confianza (${context.merchantRating}/5)`,
      officialStore: '✓ Tienda oficial',
      flash: '✓ Oferta por tiempo limitado',
    },
    uk: {
      bestPrice: '✓ Найкраща ціна',
      freeShipping: '✓ Безкоштовна доставка',
      fastShipping: `✓ Швидка доставка (${context.shippingDays} днів)`,
      topSeller: `✓ Надійний продавець (${context.merchantRating}/5)`,
      officialStore: '✓ Офіційний магазин',
      flash: '✓ Обмежена в часі пропозиція',
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
