/**
 * Narzędzia pomocnicze dla Autopilota "Ogólne Okazje Plus"
 * Obsługa linków afiliacyjnych, parametrów UTM, hashtagów oraz domyślnej konfiguracji.
 */

import type {
  GeneralAutopilotConfig,
  GeneralBotPersona,
  GeneralBotRole,
} from '@/lib/types';

export const CONFIG_DOC_ID = 'general-autopilot-settings';

// ============================================================================
// DOMYŚLNA KONFIGURACJA AUTOPILOTA DLA OGÓLNYCH OKAZJI
// ============================================================================

export const DEFAULT_GENERAL_CONFIG: GeneralAutopilotConfig = {
  id: CONFIG_DOC_ID,
  enabled: true,
  mode: 'moderation',
  fb: {
    pageId: '895877533605655',
    pageName: 'Okazje Plus',
    groupId: '1419456073494287',
    accessToken: '',
    postTarget: 'page',
    autoPostFirstComment: true,
    includePhoto: true,
  },
  portal: {
    autoPublish: false,
    categorySlug: 'elektronika',
    defaultStatus: 'approved',
    authorName: 'Okazje Plus',
    createTags: true,
  },
  schedule: {
    intervalHours: 3,
    dailyLimit: 6,
    scheduleTimes: ['09:00', '12:00', '15:00', '18:00', '21:00'],
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  },
  filters: {
    minDiscountPercent: 20,
    minTemperature: 10,
    keywords: [
      'smartfon',
      'laptop',
      'telewizor',
      'słuchawki',
      'ekspres do kawy',
      'odkurzacz',
      'lego',
      'smartwatch',
      'tablet',
      'agd',
      'audio',
      'monitor',
      'konsola',
      'xiaomi',
      'samsung',
      'apple',
      'philips',
      'promocja',
      'wyprzedaż',
      'błąd cenowy',
    ],
    negativeKeywords: [
      'erotyk',
      'narkotyk',
      'e-papieros',
      'tytoń',
      'papierosy',
      'alkohol',
      'broń',
      'wiatrówka',
      'wędka',
      'wędkarsk',
      'kołowrotek',
      'zanęt',
      'przynęt',
      'ponton',
      'wodery',
      'smoczek',
      'laktator',
      'pieluchy',
      'pampers',
      'gryzak',
    ],
  },
  partners: {
    aliexpress: true,
    convertiser: true,
    tradetracker: true,
  },
  tracking: {
    campaign: 'Okazje_1',
    subId: 'Okazje_1',
    utmSource: 'facebook',
    utmMedium: 'social',
  },
  stats: {
    totalGenerated: 0,
    totalPublishedFb: 0,
    totalPublishedPortal: 0,
  },
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// DOMYŚLNE PERSONY BOTÓW DLA OGÓLNYCH OKAZJI
// ============================================================================

export const DEFAULT_GENERAL_BOTS: GeneralBotPersona[] = [
  {
    id: 'bot-general-hunter',
    name: 'Łowca Perełek Cenowych',
    role: 'bargain_hunter',
    avatar: '🔥',
    badge: 'Hit Cenowy',
    description:
      'Wytrawny tropiciel promocji, flash deals i błędów cenowych. Tworzy dynamiczne, energetyczne wpisy z wyliczoną kwotą oszczędności.',
    tone: 'enthusiastic',
    humorLevel: 'high',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions:
      'Kładź nacisk na kwotę oszczędności, procent rabatu oraz ograniczony czas trwania oferty. Używaj dynamicznych emoji i chwytliwego haczyka.',
    scheduleDescription: 'Najlepsze godziny zakupowe (10:00, 14:00, 19:00)',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-general-tech',
    name: 'Tester & Ekspert Jakości',
    role: 'tech_expert',
    avatar: '🛡️',
    badge: 'Sprawdzona Jakość',
    description:
      'Skupia się na rzetelnej specyfikacji, parametrach technicznych i opłacalności. Wyjaśnia, dlaczego dany sprzęt jest wart swojej ceny.',
    tone: 'expert',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions:
      'Wypunktuj 3 kluczowe parametry techniczne oraz realne zalety i wady. Porównaj do standardowej ceny rynkowej.',
    scheduleDescription: 'Popołudniowe przeglądy sprzętu (12:00, 17:00)',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-general-community',
    name: 'Animator Społeczności Okazje+',
    role: 'community_lead',
    avatar: '💬',
    badge: 'Społeczność',
    description:
      'Prowadzi dialog z obserwującymi, zadaje pytania o doświadczenia z produktem, zachęca do dyskusji i dzielenia się kodami rabatowymi.',
    tone: 'friendly',
    humorLevel: 'high',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions:
      'Zadawaj na końcu angażujące pytanie do społeczności. Używaj ciepłego, otwartego tonu, który skłania do zostawienia komentarza.',
    scheduleDescription: 'Wieczorny prime-time (20:00)',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-general-assistant',
    name: 'Smart Asystent Zakupowy',
    role: 'smart_assistant',
    avatar: '🤖',
    badge: 'Omnibus Check',
    description:
      'Szybkie zestawienia cenowe, sprawdzenie najniższej ceny z 30 dni (Omnibus) i bezlitosne eliminowanie pozornych obniżek.',
    tone: 'concise',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions:
      'Podawaj konkretne liczby, kody kuponów rabatowych i informację o kosztach oraz czasie wysyłki.',
    scheduleDescription: 'Poranne okazje dnia (09:00)',
    totalGenerated: 0,
    totalPublished: 0,
  },
];

// ============================================================================
// REZOLWACJA I WZBOGACANIE LINKÓW AFILIACYJNYCH
// ============================================================================

import { resolveUnifiedAffiliateUrl } from '@/lib/affiliate-links';

export function resolveGeneralAffiliateUrl(
  dealOrUrl: { dealUrl?: string; portalUrl?: string; rawLink?: string; link?: string; source?: string } | string,
  campaignSubId = 'Okazje_1'
): string {
  return resolveUnifiedAffiliateUrl(dealOrUrl, campaignSubId);
}

// ============================================================================
// GENEROWANIE HASHTAGÓW
// ============================================================================

export function buildGeneralHashtags(title: string, category?: string, tags?: string[]): string[] {
  const hashtags = new Set<string>();

  hashtags.add('#OkazjePlus');
  hashtags.add('#Promocje');
  hashtags.add('#OkazjeCenowe');

  const lowerTitle = (title || '').toLowerCase();

  if (lowerTitle.includes('smartfon') || lowerTitle.includes('telefon') || lowerTitle.includes('iphone') || lowerTitle.includes('samsung')) {
    hashtags.add('#Smartfon');
    hashtags.add('#TechDeals');
  }
  if (lowerTitle.includes('laptop') || lowerTitle.includes('komputer') || lowerTitle.includes('pc') || lowerTitle.includes('macbook')) {
    hashtags.add('#Laptop');
    hashtags.add('#Gaming');
  }
  if (lowerTitle.includes('telewizor') || lowerTitle.includes('tv') || lowerTitle.includes('oled') || lowerTitle.includes('qled')) {
    hashtags.add('#SmartTV');
    hashtags.add('#KinoDomowe');
  }
  if (lowerTitle.includes('słuchawki') || lowerTitle.includes('audio') || lowerTitle.includes('głośnik')) {
    hashtags.add('#Audio');
    hashtags.add('#Muzyka');
  }
  if (lowerTitle.includes('ekspres') || lowerTitle.includes('kawa') || lowerTitle.includes('delonghi')) {
    hashtags.add('#Kawa');
    hashtags.add('#CoffeeTime');
  }
  if (lowerTitle.includes('lego') || lowerTitle.includes('klocki')) {
    hashtags.add('#Lego');
    hashtags.add('#LegoPromocje');
  }
  if (lowerTitle.includes('odkurzacz') || lowerTitle.includes('dyson') || lowerTitle.includes('roborock')) {
    hashtags.add('#SmartHome');
    hashtags.add('#CzystyDom');
  }

  if (category) {
    const cleanCat = category.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
    if (cleanCat && cleanCat.length > 2) {
      hashtags.add(`#${cleanCat}`);
    }
  }

  if (Array.isArray(tags)) {
    tags.forEach(t => {
      const clean = t.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
      if (clean && clean.length > 2 && hashtags.size < 8) {
        hashtags.add(`#${clean}`);
      }
    });
  }

  return Array.from(hashtags).slice(0, 7);
}

// ============================================================================
// FORMATOWANIE CENY
// ============================================================================

export function formatGeneralPricePLN(amount?: number | string, currency = 'PLN'): string {
  if (amount === undefined || amount === null || amount === '') return '';
  const num = typeof amount === 'string' ? parseFloat(amount.replace(',', '.').replace(/[^0-9.]/g, '')) : amount;
  if (isNaN(num)) return String(amount);
  return `${num.toFixed(2).replace('.', ',')} zł`;
}
