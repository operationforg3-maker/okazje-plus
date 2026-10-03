/**
 * Narzędzia pomocnicze dla Autopilota "Perełki dla Malucha i Mamy" (ID: 1064354363425282)
 * Obsługa linków afiliacyjnych, parametrów UTM, hashtagów oraz domyślnej konfiguracji.
 */

import type {
  BabyAutopilotConfig,
  BabyBotPersona,
  BabyBotRole,
} from '@/lib/types';

export const CONFIG_DOC_ID = 'baby-autopilot-settings';

// ============================================================================
// DOMYŚLNA KONFIGURACJA AUTOPILOTA DLA MALUCHA I MAMY
// ============================================================================

export const DEFAULT_BABY_CONFIG: BabyAutopilotConfig = {
  id: CONFIG_DOC_ID,
  enabled: true,
  mode: 'moderation',
  fb: {
    pageId: '1064354363425282',
    pageName: 'Perełki dla Malucha i Mamy',
    groupId: '',
    accessToken:
      'EAAW0YiYKc1UBSt73LZB61ALi4EplGRHK9OpOXxcnkbIdwkuMxj4erP4QOZB0jZAwnzqFtZAiwPjRgE8h9Fp7Pl1OuXHH7EBhPhfczVv6czcUcuuFiOyl3ZAApWb6FWqMHh5WljyP1fGefHLhRbAIda5aZCVzt2hB3Ahc5Sb4UzREO7QtiOnZB4ZBlqUg9ZBqY6mcZAVUTCAwxbb2RMRYGRJiAzDyHN',
    postTarget: 'page',
    autoPostFirstComment: true,
    includePhoto: true,
  },
  portal: {
    autoPublish: false,
    categorySlug: 'dziecko-zabawki',
    defaultStatus: 'approved',
    authorName: 'Perełki dla Malucha i Mamy',
    createTags: true,
  },
  schedule: {
    intervalHours: 3,
    dailyLimit: 6,
    scheduleTimes: ['08:00', '11:00', '14:00', '17:00', '20:00'],
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  },
  filters: {
    minDiscountPercent: 15,
    minTemperature: 5,
    keywords: [
      'niemowlę',
      'noworodek',
      'maluch',
      'dla niemowląt',
      'dla noworodka',
      'ciąża',
      'kobiety w ciąży',
      'przyszła mama',
      'wyprawka',
      'poduszka ciążowa',
      'laktator',
      'karmienie piersią',
      'butelka antykolkowa',
      'smoczek uspokajający',
      'montessori',
      'drewniane zabawki',
      'zabawki sensoryczne',
      'zabawki edukacyjne',
      'sorter drewniany',
      'klocki drewniane',
      'tablica manipulacyjna',
      'busy board',
      'książeczki kontrastowe',
      'mata piankowa',
      'mata edukacyjna',
      'wózek spacerowy',
      'wózek głęboki',
      'gondola',
      'fotelik samochodowy isofix',
      'krzesełko do karmienia',
      'bujaczek',
      'leżaczek',
      'ubranka niemowlęce bawełna',
      'body niemowlęce',
      'pajacyk niemowlęcy',
      'rampers',
      'otulacz bambusowy',
      'śpiworek do spania',
      'kocyk bambusowy',
      'silikonowe naczynia',
      'talerzyk z przyssawką',
      'śliniak silikonowy',
      'torba do wózka',
      'organizer do wózka',
      'szumiś',
      'lampka nocna silikonowa',
      'rowerek biegowy',
      'jeździk drewniany',
      'pchacz drewniany',
      'lovi smoczek',
      'lovi butelka',
      'lovi laktator',
      'lovi kubek',
      'canpol babies',
      'chicco',
      'cybex',
      'kinderkraft',
      'fisher price',
      'janod',
      'little dutch',
    ],
    negativeKeywords: [
      // Zwierzęta
      'pies', 'psa', 'psów', 'suczek', 'suczki', 'dla psa', 'dla psów', 'dla suczek',
      'kot', 'kota', 'kotów', 'dla kota', 'barry king', 'zwierząt', 'zwierzęta', 'dla zwierząt',
      'gryzoń', 'obroża', 'smycz', 'kuweta', 'żwirek',
      // Warsztat / auto / dom / elektronika przemysłowa
      'przerzutka', 'rower górski', 'stelaż podtynkowy', 'roca', 'uchwyt samochodowy',
      'multimetr', 'wkrętarka', 'lutownica', 'olej silnikowy', 'opona', 'cement', 'bateria do wkrętarki', 'felga',
      'akumulator', 'zasilacz awaryjny', 'vrla', 'agm', 'ups', 'kasa fiskalna', 'kasy wagi',
      // Odzież dla dorosłych / kardigany itp.
      'kardigan', 'żakiet', 'marynarka', 'sukienka wieczorowa', 'spódnica', 'rozmiar: l', 'rozmiar: xl', 'rozmiar: m', 'rozmiar: s',
      // Używki i wędkarstwo
      'wędka', 'kołowrotek', 'erotyk', 'papierosy', 'alkohol',
      // Militaria / czołgi / broń / modele plastikowe
      'czołg', 'tank', 'model czołgu', 'revell', 'militaria', 'broń', 'karabin', 'pistolet', 'wojsko', 'wojskow',
      // Czyszczenie i chemia
      'czyścik do ekran', 'czyszczenia ekran', 'ściereczka z mikrofibry do ekran',
      // Starsze dzieci i szkoła (profil ściśle 0 - 4 lata)
      'tornister', 'plecak szkolny', 'piórnik', 'szkoła', 'szkolny', 'zeszyt szkolny', 'dla nastolatka', 'nastolatki',
      'playstation', 'ps5', 'ps4', 'xbox', 'nintendo switch', 'gaming', 'smartfon dla dziecka',
      // Kicz / chińskie przebrania anime
      'cosplay', 'anime', 'dragon ball', 'vegeta', 'goku', 'strój na karnawał'
    ],
  },
  partners: {
    aliexpress: true,
    convertiser: true,
    tradetracker: true,
  },
  tracking: {
    campaign: 'Maluch_1',
    subId: 'Maluch_1',
    utmSource: 'facebook',
    utmMedium: 'social_group',
  },
  stats: {
    totalGenerated: 0,
    totalPublishedFb: 0,
    totalPublishedPortal: 0,
  },
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// DOMYŚLNE PERSONY BOTÓW DLA MALUCHA I MAMY
// ============================================================================

export const DEFAULT_BABY_BOTS: BabyBotPersona[] = [
  {
    id: 'bot-bargain-mom',
    name: 'Mama Kasia — Łowczyni Perełek',
    role: 'bargain_mom',
    avatar: '🛍️',
    badge: 'Królowa Promocji & Pampersów',
    description:
      'Błyskawicznie wyłapuje promocje na wyprawkę dla noworodka, pampersy, wózki, akcesoria do karmienia i stylowe ubranka dla maluszków 0-4 lat. Zawsze szuka realnych oszczędności ze smakiem i klasą.',
    tone: 'enthusiastic',
    humorLevel: 'high',
    enabled: true,
    autoApprove: true,
    target: 'facebook',
    customInstructions:
      'Skupiaj się na mamach, kobietach w ciąży i maluchach 0-4 lata. Zwracaj się serdecznie i po kumpelsku ("Kochane Mamuśki!", "Dziewczyny, zobaczcie co upolowałam!"). Podkreślaj jakość wykonania, estetykę i realną oszczędność w domowym budżecie. Zero kiczu!',
    scheduleDescription: 'Co 3-4 godziny w ciągu dnia (08:00 - 20:00)',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-safety-expert',
    name: 'Mama Pediatra & Atesty',
    role: 'safety_expert',
    avatar: '🩺',
    badge: 'Bezpieczeństwo & Zdrowie',
    description:
      'Ekspertka od bezpiecznych materiałów, norm i atestów dla kobiet w ciąży i maluszków 0-4 lat (Oeko-Tex Standard 100, BPA Free, foteliki i-Size, CE, EN-71). Wybiera naturalne tkaniny i ergonomiczne rozwiązania.',
    tone: 'expert',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions:
      'Oceniaj produkty dla kobiet w ciąży i dzieci 0-4 lat pod kątem bezpieczeństwa, składu i zdrowia. Wskazuj atesty, naturalne materiały (bawełna organiczna, bambus, bezpieczny silikon spożywczy) i ergonomię.',
    scheduleDescription: 'Raz dziennie (główny test i analiza bezpieczeństwa)',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-mom-community',
    name: 'Kawiarenka Mamusiek',
    role: 'mom_community',
    avatar: '☕',
    badge: 'Serce Społeczności',
    description:
      'Prowadzi ciepłe rozmowy dla kobiet w ciąży i mam maluszków 0-4 lat (kompletowanie wyprawki, ząbkowanie, skoki rozwojowe). Dzieli się sprawdzonymi patentami ułatwiającymi macierzyństwo.',
    tone: 'friendly',
    humorLevel: 'high',
    enabled: true,
    autoApprove: true,
    target: 'facebook',
    customInstructions:
      'Zadawaj pytania angażujące mamy i kobiety w ciąży ("Jak kompletujecie wyprawkę?", "Sprawdza się u Waszego malucha czy zbiera kurz?"). Bądź pełna empatii, ciepła i dobrego smaku.',
    scheduleDescription: 'Wieczorami (19:00 - 21:00) na pogaduchy przy herbacie',
    totalGenerated: 0,
    totalPublished: 0,
  },
  {
    id: 'bot-montessori-play',
    name: 'Kreatywna Mama & Montessori',
    role: 'montessori_play',
    avatar: '🎨',
    badge: 'Mądra Zabawa & Sensoryka',
    description:
      'Wyszukuje piękne drewniane zabawki edukacyjne, pomoce Montessori, sensorykę, książeczki kontrastowe i sortery dla dzieci 0-4 lat. Promuje rozwój zmysłów i motoryki małej w duchu estetyki i prostoty.',
    tone: 'caring',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: true,
    target: 'both',
    customInstructions:
      'Wybieraj ładne, estetyczne i edukacyjne zabawki ze smakiem dla maluszków 0-4 lat (naturalne drewno, stonowane kolory, sensoryka). Wyjaśniaj jak wspierają motorykę, zmysły i samodzielność malucha bez tabletów i tandetnego plastiku.',
    scheduleDescription: 'Przedpołudniami (10:00 - 12:00) na zabawy edukacyjne',
    totalGenerated: 0,
    totalPublished: 0,
  },
];

// ============================================================================
// HELPERY I RESOLVER LINKÓW AFILIACYJNYCH
// ============================================================================

import { resolveUnifiedAffiliateUrl } from '@/lib/affiliate-links';

export function resolveBabyAffiliateUrl(dealOrUrl: any, campaignSubId: string = 'Maluch_1'): string {
  return resolveUnifiedAffiliateUrl(dealOrUrl, campaignSubId);
}

/**
 * Generuje zestaw dynamicznych hashtagów dla posta dziecięcego/macierzyńskiego
 */
export function buildBabyHashtags(
  title: string,
  merchant?: string,
  botRole?: BabyBotRole
): string[] {
  const hashtags = new Set<string>();

  // Bazowe hashtagi społeczności
  hashtags.add('#PerełkiDlaMalucha');
  hashtags.add('#MamaIDziecko');
  hashtags.add('#OkazjePlus');
  hashtags.add('#PromocjeDlaMam');

  const lowerTitle = (title || '').toLowerCase();

  // Kategorie tematyczne
  if (lowerTitle.includes('pampers') || lowerTitle.includes('pieluch')) {
    hashtags.add('#Pampersy');
    hashtags.add('#Wyprawka');
    hashtags.add('#Pieluchy');
  }
  if (lowerTitle.includes('wózek') || lowerTitle.includes('wozek') || lowerTitle.includes('spacerówk')) {
    hashtags.add('#WózekDziecięcy');
    hashtags.add('#WyprawkaDlaNoworodka');
  }
  if (lowerTitle.includes('fotelik') || lowerTitle.includes('isofix')) {
    hashtags.add('#FotelikSamochodowy');
    hashtags.add('#BezpieczeństwoDziecka');
  }
  if (lowerTitle.includes('klocki') || lowerTitle.includes('lego') || lowerTitle.includes('zabawk')) {
    hashtags.add('#ZabawkiDlaDzieci');
    hashtags.add('#PrezentDlaDziecka');
  }
  if (lowerTitle.includes('montessori') || lowerTitle.includes('sensorycz')) {
    hashtags.add('#Montessori');
    hashtags.add('#ZabawkiSensoryczne');
    hashtags.add('#MądraZabawa');
  }
  if (lowerTitle.includes('ubrank') || lowerTitle.includes('body') || lowerTitle.includes('pajacyk')) {
    hashtags.add('#UbrankaDziecięce');
    hashtags.add('#ModaDziecięca');
  }
  if (lowerTitle.includes('laktator') || lowerTitle.includes('karmieni') || lowerTitle.includes('butelk') || lowerTitle.includes('smoczek')) {
    hashtags.add('#KarmieniePiersią');
    hashtags.add('#WyprawkaDlaMamy');
  }

  // Rola bota
  if (botRole === 'bargain_mom') {
    hashtags.add('#CenowyHit');
    hashtags.add('#SuperPromocja');
  } else if (botRole === 'safety_expert') {
    hashtags.add('#ZdroweDziecko');
    hashtags.add('#AtestyDlaDzieci');
  } else if (botRole === 'montessori_play') {
    hashtags.add('#KreatywneDziecko');
    hashtags.add('#ZabawyWDomu');
  } else if (botRole === 'mom_community') {
    hashtags.add('#PogaduchyMam');
    hashtags.add('#MamyDlaMam');
  }

  // Sklep
  if (merchant) {
    const cleanMerchant = merchant.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanMerchant) hashtags.add(`#${cleanMerchant}`);
  }

  return Array.from(hashtags).slice(0, 10);
}
