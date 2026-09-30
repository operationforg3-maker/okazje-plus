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
      'EAAW0YiYKc1UBSm75x0WIOWkncUBj3WUFiNIIep3xpcGOXh81ZBXDV3W2MwQvGZBFlrru7G1j4QcbGvZCrAmTTLjkSzGfXg9YLwf70oaTeBI9nkzDdsj3RkuDZBZAEZANw48bkotPs9YxB463k5XAbQGf49O3wYAWucwv5DxG5efaeWoZBZAgftj7OC0UN0e9sspjZBVlySSEyMC1GgvZBZBMP8Q36M7g61Dl27YCkxh0lNjrdmeGhZCeqZCesERoX',
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
      'dziecko',
      'maluch',
      'niemowlę',
      'zabawki',
      'wózek',
      'wozek',
      'fotelik',
      'pampers',
      'pieluchy',
      'smoczek',
      'butelka',
      'lalka',
      'lego',
      'montessori',
      'ubranka',
      'body',
      'pajacyk',
      'mama',
      'ciąża',
      'laktator',
      'bujaczek',
      'niania',
      'krzesełko',
      'fisher price',
      'chicco',
      'cybex',
      'kinderkraft',
      'lovi',
      'canpol',
      'gry edukacyjne',
      'klocki',
      'rowerek',
      'mata edukacyjna',
    ],
    negativeKeywords: [
      'pies',
      'psa',
      'psów',
      'suczek',
      'suczki',
      'dla psa',
      'dla psów',
      'dla suczek',
      'kot',
      'kota',
      'kotów',
      'dla kota',
      'barry king',
      'zwierząt',
      'zwierzęta',
      'dla zwierząt',
      'gryzoń',
      'obroża',
      'smycz',
      'kuweta',
      'żwirek',
      'przerzutka',
      'rower',
      'stelaż podtynkowy',
      'roca',
      'uchwyt samochodowy',
      'multimetr',
      'wkrętarka',
      'lutownica',
      'olej silnikowy',
      'opona',
      'cement',
      'wędka',
      'kołowrotek',
      'erotyk',
      'papierosy',
      'alkohol',
      'bateria do wkrętarki',
      'felga',
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
      'Błyskawicznie wyłapuje promocje na pampersy, mleka, wózki, ubranka i wyprawki. Zawsze przelicza cenę na 1 sztukę (pieluszki, chusteczki) i szuka realnych oszczędności w domowym budżecie.',
    tone: 'enthusiastic',
    humorLevel: 'high',
    enabled: true,
    autoApprove: true,
    target: 'facebook',
    customInstructions:
      'Zwracaj się do mam serdecznie i po kumpelsku ("Kochane Mamuśki!", "Dziewczyny, zobaczcie co upolowałam!"). Zawsze podkreślaj ile zostaje w portfelu i przeliczaj cenę za sztukę lub porównaj z ceną w popularnych drogeriach.',
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
      'Ekspertka od bezpiecznych materiałów, norm i atestów (Oeko-Tex Standard 100, BPA Free, atesty i-Size w fotelikach, certyfikaty CE i EN-71 dla zabawek). Ocenia składy i ergonomię dla kręgosłupa malucha.',
    tone: 'expert',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: false,
    target: 'both',
    customInstructions:
      'Oceniaj produkty pod kątem bezpieczeństwa, składu i rozwoju sensorycznego malucha. Zwracaj uwagę na wiek dziecka, brak drobnych elementów u niemowląt i certyfikowane materiały.',
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
      'Prowadzi ciepłe rozmowy o urokach i trudach rodzicielstwa (nocne pobudki, ząbkowanie, skoki rozwojowe). Zadaje angażujące pytania i tworzy bezpieczną przestrzeń do wymiany doświadczeń.',
    tone: 'friendly',
    humorLevel: 'high',
    enabled: true,
    autoApprove: true,
    target: 'facebook',
    customInstructions:
      'Zadawaj pytania, które rozgrzewają sekcję komentarzy ("Jak to wygląda u Was?", "Sprawdza się czy zbiera kurz?"). Bądź pełna empatii i humoru, unikaj oceniania innych mam.',
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
      'Wyszukuje zabawki edukacyjne, klocki, sensoryczne pomoce Montessori, książeczki i gry rozwijające wyobraźnię oraz motorykę małą. Promuje czas z maluchem bez tabletów i smartfonów.',
    tone: 'caring',
    humorLevel: 'subtle',
    enabled: true,
    autoApprove: true,
    target: 'both',
    customInstructions:
      'Tłumacz jak dana zabawka lub książka wspiera rozwój dziecka (mała motoryka, koordynacja oko-ręka, logiczne myślenie). Zaproponuj prostą zabawę z wykorzystaniem tej rzeczy w domu.',
    scheduleDescription: 'Przedpołudniami (10:00 - 12:00) na zabawy edukacyjne',
    totalGenerated: 0,
    totalPublished: 0,
  },
];

// ============================================================================
// HELPERY I RESOLVER LINKÓW AFILIACYJNYCH
// ============================================================================

export function resolveBabyAffiliateUrl(dealOrUrl: any, campaignSubId: string = 'Maluch_1'): string {
  let targetUrl = '';

  if (typeof dealOrUrl === 'string') {
    targetUrl = dealOrUrl;
  } else if (dealOrUrl && typeof dealOrUrl === 'object') {
    targetUrl =
      dealOrUrl.directAffiliateUrl ||
      dealOrUrl.affiliateUrl ||
      dealOrUrl.dealUrl ||
      dealOrUrl.link ||
      dealOrUrl.url ||
      dealOrUrl.rawLink ||
      '';
  }

  if (!targetUrl) return '';

  try {
    const urlObj = new URL(targetUrl);

    // 1. AliExpress link
    if (urlObj.hostname.includes('aliexpress.')) {
      if (!urlObj.searchParams.has('subid') && !urlObj.searchParams.has('sub_id')) {
        urlObj.searchParams.set('subid', campaignSubId);
      }
      return urlObj.toString();
    }

    // 2. Convertiser wrapper link
    if (urlObj.hostname.includes('convertiser.com') || urlObj.hostname.includes('cvtr.pl')) {
      if (!urlObj.searchParams.has('subid')) {
        urlObj.searchParams.set('subid', campaignSubId);
      }
      return urlObj.toString();
    }

    // 3. TradeTracker link
    if (urlObj.hostname.includes('tradetracker.net') || urlObj.hostname.includes('tc.tradetracker.net')) {
      if (!urlObj.searchParams.has('u')) {
        urlObj.searchParams.set('u', campaignSubId);
      }
      return urlObj.toString();
    }

    // Ogólny dodatek trackingowy
    if (!urlObj.searchParams.has('utm_campaign')) {
      urlObj.searchParams.set('utm_source', 'facebook');
      urlObj.searchParams.set('utm_medium', 'social');
      urlObj.searchParams.set('utm_campaign', campaignSubId);
    }

    return urlObj.toString();
  } catch {
    return targetUrl;
  }
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
