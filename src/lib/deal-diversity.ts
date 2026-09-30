/**
 * Silnik kategoryzacji i zróżnicowania ofert (Anti-Clustering & Diversity Engine)
 * Zapobiega publikowaniu i planowaniu monotonnych postów z tej samej podkategorii
 * (np. kilka smoczków, kołowrotków lub słuchawek z rzędu).
 */

export interface DealLikeItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  [key: string]: any;
}

// ----------------------------------------------------------------------------
// SŁOWNIKI SŁÓW KLUCZOWYCH DLA NISZ
// ----------------------------------------------------------------------------

const BABY_CATEGORY_KEYWORDS: Record<string, string[]> = {
  smoczki_gryzaki: [
    'smoczek', 'smoczk', 'gryzak', 'uspokajacz', 'zawieszka do smoczk', 'łańcuszek do smoczk',
    'soother', 'pacifier', 'teether',
  ],
  karmienie: [
    'butelk', 'laktator', 'krzesełko do karmienia', 'kubek niekapek', 'bidon', 'śliniak',
    'miseczk', 'talerzyk', 'sztućce dla dziec', 'podgrzewacz', 'sterylizator', 'mleko modyfikowan',
    'kaszka', 'porcjowacz', 'feeding bottle', 'breast pump',
  ],
  wozki_foteliki: [
    'wózek', 'spacerówk', 'gondol', 'fotelik', 'isofix', 'nosidełk', 'chusta do noszenia',
    'stroller', 'pram', 'car seat', 'baby carrier',
  ],
  sen_pokoj: [
    'łóżeczk', 'materac dziecięc', 'kocyk', 'pościel dziecięc', 'rożek', 'śpiworek do spania',
    'otulacz', 'niania elektroniczna', 'lampka nocna dla dziec', 'karuzelka', 'karuzela do łóżeczka',
    'szumiś', 'crib', 'cot', 'baby blanket',
  ],
  higiena_kapiel: [
    'pieluch', 'pampers', 'chusteczki nawilżan', 'wanienk', 'ręcznik z kapturem', 'okrycie kąpielowe',
    'przewijak', 'aspirator', 'termometr bezdotykow', 'krem na odparzenia', 'płyn do kąpieli dla niemowląt',
    'diaper', 'nappy', 'wet wipes', 'baby bath',
  ],
  zabawki_edukacja: [
    'mata edukacyjna', 'grzechotk', 'klocki', 'przytulank', 'pluszak', 'jeździk', 'rowerek biegow',
    'sorter', 'bujaczek', 'huśtawk', 'puzzle dla dziec', 'zabawk', 'interaktywn', 'lalk',
    'edukacyjn', 'baby toy', 'rattle', 'playmat',
  ],
  ubranka: [
    'body niemowlęc', 'body dziecięc', 'pajacyk', 'rampers', 'czapeczk', 'skarpetki niemowlęc',
    'kombinezon dziecięc', 'buciki niemowlęc', 'spodenki niemowlęc', 'kaftanik', 'półśpiochy',
    'baby clothes', 'romper', 'onesie',
  ],
  dla_mamy: [
    'poduszka ciążowa', 'wkładki laktacyjne', 'torba do wózka', 'biustonosz do karmienia',
    'pas poporodowy', 'kosmetyki dla kobiet w ciąży', 'koszula do karmienia', 'maternity',
  ],
};

const FISHING_CATEGORY_KEYWORDS: Record<string, string[]> = {
  wedki: [
    'wędk', 'wędzisk', 'spinning', 'feeder', 'karpiówk', 'bat', 'tyczk', 'matchówk',
    'bolonk', 'teleskopow', 'fishing rod', 'rod',
  ],
  kolowrotki: [
    'kołowrotek', 'multiplikator', 'szpul', 'baitcast', 'wolny bieg', 'fishing reel', 'reel',
  ],
  przynety_zanety: [
    'przynęt', 'wobler', 'ripper', 'twister', 'guma spinningow', 'blach', 'obrotówk', 'wahadłówk',
    'kulki proteinowe', 'pellet', 'zanęt', 'dip', 'booster', 'pop-up', 'ciasto wędkarsk', 'kukurydza wędkarsk',
    'lure', 'bait', 'crankbait', 'soft bait',
  ],
  linki_haczyki: [
    'żyłk', 'plecionk', 'przypon', 'haczyk', 'kotwiczk', 'wolfram', 'fluorocarbon', 'ciężarek',
    'spławik', 'koszyk zanętowy', 'leadcore', 'fishing line', 'fishing hook',
  ],
  elektronika_sygnalizatory: [
    'echosond', 'sonar', 'sygnalizator', 'swinger', 'hanger', 'waga wędkarsk', 'fish finder', 'alarm',
  ],
  biwak_meble: [
    'fotel karpiow', 'fotel wędkarsk', 'namiot karpiow', 'namiot wędkarsk', 'łóżko karpiow',
    'parasol wędkarsk', 'brolly', 'śpiwór karpiow', 'stolik karpiow', 'bivvy',
  ],
  odziez_wodery: [
    'woder', 'spodniobut', 'kurtka wędkarsk', 'kombinezon wędkarsk', 'kalosz', 'polar wędkarsk',
    'czapka z daszkiem wędkarsk', 'rękawice wędkarsk', 'waders',
  ],
  akcesoria_transport: [
    'podbierak', 'siatka na ryby', 'skrzynka wędkarsk', 'torba wędkarsk', 'pokrowiec na wędki',
    'rod pod', 'stojak na wędki', 'tripod', 'kombinerki wędkarsk', 'wypychacz', 'nożyczki wędkarsk',
    'ponton', 'landing net', 'tackle box',
  ],
};

const GENERAL_CATEGORY_KEYWORDS: Record<string, string[]> = {
  audio_smart: [
    'słuchawk', 'głośnik', 'soundbar', 'smartfon', 'smartwatch', 'smartband', 'zegarek',
    'powerbank', 'ładowark', 'etui', 'headphone', 'earphone',
  ],
  agd_dom: [
    'ekspres', 'odkurzacz', 'frytkownic', 'airfryer', 'robot sprzątając', 'blender', 'czajnik',
    'patelni', 'garnek', 'oczyszczacz powietrza', 'żelazko', 'parownica', 'pościel',
  ],
  komputery_gaming: [
    'laptop', 'mysz', 'klawiatur', 'monitor', 'konsol', 'playstation', 'xbox', 'nintendo',
    'pad', 'karta graficzna', 'procesor', 'dysk ssd', 'fotel gamingowy',
  ],
  narzedzia_ogrod: [
    'wkrętark', 'wiertark', 'myjka ciśnieniowa', 'kosiark', 'podkaszark', 'akumulatorow',
    'zestaw narzędzi', 'grill', 'klucz dynamometryczny', 'piła',
  ],
  moda_sport: [
    'buty', 'sneakers', 'kurtk', 'bluz', 'plecak', 'rower', 'hulajnog', 'hantl', 'mata do ćwiczeń',
    'bieżnia', 'zegarek męski', 'zegarek damski',
  ],
};

/**
 * Wykrywa klucz mikrokategorii dla danego produktu na podstawie tytułu i opisu.
 */
export function detectDealCategory(
  title: string,
  description?: string,
  niche?: 'baby' | 'fishing' | 'general'
): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  let dicts: Record<string, string[]>[];
  if (niche === 'baby') {
    dicts = [BABY_CATEGORY_KEYWORDS];
  } else if (niche === 'fishing') {
    dicts = [FISHING_CATEGORY_KEYWORDS];
  } else if (niche === 'general') {
    dicts = [GENERAL_CATEGORY_KEYWORDS];
  } else {
    dicts = [BABY_CATEGORY_KEYWORDS, FISHING_CATEGORY_KEYWORDS, GENERAL_CATEGORY_KEYWORDS];
  }

  for (const dict of dicts) {
    for (const [catKey, keywords] of Object.entries(dict)) {
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) {
          return catKey;
        }
      }
    }
  }

  return 'inne';
}

/**
 * Zwraca czytelną polską etykietę dla wykrytej mikrokategorii.
 */
export function getCategoryLabel(categoryKey: string): string {
  const labels: Record<string, string> = {
    // Baby
    smoczki_gryzaki: 'Smoczki & Gryzaki',
    karmienie: 'Karmienie & Butelki',
    wozki_foteliki: 'Wózki & Foteliki',
    sen_pokoj: 'Sen & Pokój Malucha',
    higiena_kapiel: 'Higiena & Kąpiel',
    zabawki_edukacja: 'Zabawki & Rozwój',
    ubranka: 'Ubranka & Tekstylia',
    dla_mamy: 'Dla Mamy & Ciąża',

    // Fishing
    wedki: 'Wędki & Wędziska',
    kolowrotki: 'Kołowrotki',
    przynety_zanety: 'Przynęty & Zanęty',
    linki_haczyki: 'Żyłki, Plecionki & Haki',
    elektronika_sygnalizatory: 'Elektronika & Echosondy',
    biwak_meble: 'Biwak, Fotele & Namioty',
    odziez_wodery: 'Odzież & Wodery',
    akcesoria_transport: 'Akcesoria & Podbieraki',

    // General
    audio_smart: 'Audio, Smartwatche & Akcesoria',
    agd_dom: 'AGD & Dom',
    komputery_gaming: 'Gaming & IT',
    narzedzia_ogrod: 'Narzędzia & Ogród',
    moda_sport: 'Moda, Sport & Rekreacja',

    inne: 'Różne Okazje',
  };

  return labels[categoryKey] || categoryKey;
}

/**
 * Główny algorytm Anti-Clustering & Diversity:
 * Przekształca surową listę ofert tak, aby produkty z tej samej kategorii NIE pojawiały się obok siebie!
 * Jeśli podano `recentCategories` (kategorie ostatnich 1-3 wpisów), oferty z tych kategorii zostaną
 * odłożone na dalsze pozycje.
 */
export function diversifyDealsList<T extends DealLikeItem>(
  deals: T[],
  options?: {
    niche?: 'baby' | 'fishing' | 'general';
    recentCategories?: string[];
  }
): T[] {
  if (!deals || deals.length <= 1) return deals || [];

  const niche = options?.niche;
  const recentSet = new Set(options?.recentCategories || []);

  // 1. Przypisz kategorię do każdej oferty
  const categorized = deals.map(d => ({
    deal: d,
    cat: detectDealCategory(d.title, d.description, niche),
  }));

  // 2. Pogrupuj oferty w koszyki (buckets) wg kategorii
  const buckets: Record<string, T[]> = {};
  for (const item of categorized) {
    if (!buckets[item.cat]) {
      buckets[item.cat] = [];
    }
    buckets[item.cat].push(item.deal);
  }

  // 3. Posortuj klucze koszyków: najpierw te, które NIE były ostatnio publikowane
  const categoryKeys = Object.keys(buckets).sort((a, b) => {
    const aRecent = recentSet.has(a) ? 1 : 0;
    const bRecent = recentSet.has(b) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return buckets[b].length - buckets[a].length; // większe koszyki wcześniej
  });

  // 4. Round-Robin Interleaving: pobieraj po 1 elemencie z każdego koszyka naprzemiennie
  const result: T[] = [];
  let addedAny = true;
  let lastAddedCat: string | null = options?.recentCategories?.[0] || null;

  while (addedAny) {
    addedAny = false;

    for (const cat of categoryKeys) {
      if (buckets[cat].length > 0) {
        // Jeśli ten koszyk jest identyczny z ostatnio dodaną kategorią i mamy alternatywy, pomiń ten krok
        if (cat === lastAddedCat && categoryKeys.some(k => k !== cat && buckets[k].length > 0)) {
          continue;
        }

        const picked = buckets[cat].shift()!;
        result.push(picked);
        lastAddedCat = cat;
        addedAny = true;
      }
    }
  }

  return result;
}

/**
 * Inteligentny wybór 1 najlepszej rekomendacji od AI, która różni się od ostatnio opublikowanych
 */
export function pickDiverseRecommendation<T extends DealLikeItem>(
  deals: T[],
  options: {
    niche?: 'baby' | 'fishing' | 'general';
    recentCategories?: string[];
    excludeDealIds?: string[];
  }
): { deal: T | null; category: string; categoryLabel: string; reason: string } {
  const excludeSet = new Set(options.excludeDealIds || []);
  const available = deals.filter(d => !excludeSet.has(d.id));

  if (available.length === 0) {
    return {
      deal: deals[0] || null,
      category: 'inne',
      categoryLabel: 'Różne Okazje',
      reason: 'Brak nowych ofert do wyboru',
    };
  }

  const recentSet = new Set(options.recentCategories || []);
  const diversified = diversifyDealsList(available, {
    niche: options.niche,
    recentCategories: options.recentCategories,
  });

  // Znajdź pierwszą ofertę z kategorii, która NIE była ostatnio promowana
  let chosen = diversified.find(d => {
    const cat = detectDealCategory(d.title, d.description, options.niche);
    return !recentSet.has(cat);
  });

  if (!chosen) {
    chosen = diversified[0];
  }

  const cat = detectDealCategory(chosen.title, chosen.description, options.niche);
  const label = getCategoryLabel(cat);

  const reason = options.recentCategories?.length
    ? `Wybrano z kategorii "${label}", aby urozmaicić profil i uniknąć powtarzania niedawnych publikacji.`
    : `Optymalnie dobrana propozycja z kategorii "${label}".`;

  return {
    deal: chosen,
    category: cat,
    categoryLabel: label,
    reason,
  };
}
