/**
 * Full Category Structure Seed Script
 * 
 * Creates comprehensive 3-level category tree for Okazje Plus
 * Pepper/MyDealz inspired structure
 */

import { adminDb } from '../lib/firebase-admin';

interface SubSubCategory {
  name: string;
  slug: string;
  aliexpressKeywords?: string[]; // Keywords for AliExpress import
}

interface SubCategory {
  name: string;
  slug: string;
  subcategories: SubSubCategory[];
}

interface MainCategory {
  name: string;
  slug: string;
  icon?: string;
  sortOrder: number;
  subcategories: SubCategory[];
}

const MAIN_SLUG_MAP: Record<string, string> = {
  'elektronika': 'electronics',
  'dom-ogrod': 'home-garden',
  'moda': 'fashion',
  'sport-turystyka': 'sports-outdoors',
  'dziecko': 'kids-baby',
  'zdrowie-uroda': 'health-beauty',
  'motoryzacja': 'automotive',
  'ksiazki-multimedia': 'books-media',
};

const slugify = (text: string): string =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const toTitleCase = (text: string): string =>
  text
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/**
 * Complete category structure for Polish market
 */
const CATEGORY_STRUCTURE: MainCategory[] = [
  {
    name: 'Elektronika',
    slug: 'elektronika',
    icon: '💻',
    sortOrder: 10,
    subcategories: [
      {
        name: 'Smartfony i telefony',
        slug: 'smartfony-telefony',
        subcategories: [
          { name: 'Smartfony', slug: 'smartfony', aliexpressKeywords: ['smartphone', 'mobile phone'] },
          { name: 'Telefony podstawowe', slug: 'telefony-podstawowe', aliexpressKeywords: ['feature phone', 'basic phone'] },
          { name: 'Akcesoria GSM', slug: 'akcesoria-gsm', aliexpressKeywords: ['phone accessories', 'phone case'] },
          { name: 'Ładowarki i kable', slug: 'ladowarki-kable', aliexpressKeywords: ['phone charger', 'usb cable'] },
          { name: 'Powerbanki', slug: 'powerbanki', aliexpressKeywords: ['power bank', 'portable charger'] },
        ],
      },
      {
        name: 'Komputery',
        slug: 'komputery',
        subcategories: [
          { name: 'Laptopy', slug: 'laptopy', aliexpressKeywords: ['laptop', 'notebook'] },
          { name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne', aliexpressKeywords: ['desktop pc', 'computer'] },
          { name: 'Tablety', slug: 'tablety', aliexpressKeywords: ['tablet', 'ipad'] },
          { name: 'Monitory', slug: 'monitory', aliexpressKeywords: ['monitor', 'display'] },
          { name: 'Drukarki i skanery', slug: 'drukarki-skanery', aliexpressKeywords: ['printer', 'scanner'] },
        ],
      },
      {
        name: 'Audio i video',
        slug: 'audio-video',
        subcategories: [
          { name: 'Słuchawki', slug: 'sluchawki', aliexpressKeywords: ['headphones', 'earphones', 'earbuds'] },
          { name: 'Głośniki', slug: 'glosniki', aliexpressKeywords: ['speaker', 'bluetooth speaker'] },
          { name: 'Soundbary', slug: 'soundbary', aliexpressKeywords: ['soundbar', 'sound bar'] },
          { name: 'Mikrofony', slug: 'mikrofony', aliexpressKeywords: ['microphone', 'mic'] },
          { name: 'Kamery i kamerki', slug: 'kamery', aliexpressKeywords: ['camera', 'webcam'] },
        ],
      },
      {
        name: 'Fotografia',
        slug: 'fotografia',
        subcategories: [
          { name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe', aliexpressKeywords: ['digital camera', 'dslr'] },
          { name: 'Obiektywy', slug: 'obiektywy', aliexpressKeywords: ['camera lens', 'lens'] },
          { name: 'Akcesoria fotograficzne', slug: 'akcesoria-foto', aliexpressKeywords: ['camera accessories', 'tripod'] },
          { name: 'Karty pamięci', slug: 'karty-pamieci', aliexpressKeywords: ['memory card', 'sd card'] },
        ],
      },
      {
        name: 'Gaming',
        slug: 'gaming',
        subcategories: [
          { name: 'Konsole', slug: 'konsole', aliexpressKeywords: ['game console', 'gaming console'] },
          { name: 'Gry', slug: 'gry', aliexpressKeywords: ['video game', 'game'] },
          { name: 'Akcesoria do gier', slug: 'akcesoria-gaming', aliexpressKeywords: ['gaming accessories', 'controller'] },
          { name: 'Myszki gamingowe', slug: 'myszki-gaming', aliexpressKeywords: ['gaming mouse'] },
          { name: 'Klawiatury gamingowe', slug: 'klawiatury-gaming', aliexpressKeywords: ['gaming keyboard'] },
        ],
      },
    ],
  },
  {
    name: 'Dom i ogród',
    slug: 'dom-ogrod',
    icon: '🏡',
    sortOrder: 20,
    subcategories: [
      {
        name: 'Meble',
        slug: 'meble',
        subcategories: [
          { name: 'Sofy i fotele', slug: 'sofy-fotele', aliexpressKeywords: ['sofa', 'armchair'] },
          { name: 'Stoły i krzesła', slug: 'stoly-krzesla', aliexpressKeywords: ['table', 'chair'] },
          { name: 'Łóżka', slug: 'lozka', aliexpressKeywords: ['bed', 'mattress'] },
          { name: 'Szafy i komody', slug: 'szafy-komody', aliexpressKeywords: ['wardrobe', 'dresser'] },
          { name: 'Regały', slug: 'regaly', aliexpressKeywords: ['shelf', 'bookshelf'] },
        ],
      },
      {
        name: 'Oświetlenie',
        slug: 'oswietlenie',
        subcategories: [
          { name: 'Lampy sufitowe', slug: 'lampy-sufitowe', aliexpressKeywords: ['ceiling light', 'chandelier'] },
          { name: 'Lampy stojące', slug: 'lampy-stojace', aliexpressKeywords: ['floor lamp', 'standing lamp'] },
          { name: 'Lampki nocne', slug: 'lampki-nocne', aliexpressKeywords: ['night light', 'bedside lamp'] },
          { name: 'Żarówki LED', slug: 'zarowki-led', aliexpressKeywords: ['led bulb', 'light bulb'] },
        ],
      },
      {
        name: 'Ogród',
        slug: 'ogrod',
        subcategories: [
          { name: 'Meble ogrodowe', slug: 'meble-ogrodowe', aliexpressKeywords: ['garden furniture', 'outdoor furniture'] },
          { name: 'Narzędzia ogrodowe', slug: 'narzedzia-ogrodowe', aliexpressKeywords: ['garden tools', 'gardening tools'] },
          { name: 'Grille', slug: 'grille', aliexpressKeywords: ['bbq', 'grill', 'barbecue'] },
          { name: 'Dekoracje ogrodowe', slug: 'dekoracje-ogrodowe', aliexpressKeywords: ['garden decoration'] },
        ],
      },
      {
        name: 'AGD małe',
        slug: 'agd-male',
        subcategories: [
          { name: 'Ekspresy do kawy', slug: 'ekspresy-kawy', aliexpressKeywords: ['coffee maker', 'espresso machine'] },
          { name: 'Blendery i mikser', slug: 'blendery-miksery', aliexpressKeywords: ['blender', 'mixer'] },
          { name: 'Roboty kuchenne', slug: 'roboty-kuchenne', aliexpressKeywords: ['food processor', 'kitchen robot'] },
          { name: 'Odkurzacze', slug: 'odkurzacze', aliexpressKeywords: ['vacuum cleaner', 'robot vacuum'] },
        ],
      },
      {
        name: 'AGD duże',
        slug: 'agd-duze',
        subcategories: [
          { name: 'Lodówki', slug: 'lodowki', aliexpressKeywords: ['refrigerator', 'fridge'] },
          { name: 'Pralki', slug: 'pralki', aliexpressKeywords: ['washing machine'] },
          { name: 'Zmywarki', slug: 'zmywarki', aliexpressKeywords: ['dishwasher'] },
          { name: 'Kuchenki', slug: 'kuchenki', aliexpressKeywords: ['oven', 'cooker'] },
        ],
      },
    ],
  },
  {
    name: 'Moda',
    slug: 'moda',
    icon: '👔',
    sortOrder: 30,
    subcategories: [
      {
        name: 'Odzież damska',
        slug: 'odziez-damska',
        subcategories: [
          { name: 'Sukienki', slug: 'sukienki', aliexpressKeywords: ['dress', 'women dress'] },
          { name: 'Bluzki i koszule', slug: 'bluzki-koszule', aliexpressKeywords: ['blouse', 'women shirt'] },
          { name: 'Spodnie i jeansy', slug: 'spodnie-damskie', aliexpressKeywords: ['women pants', 'jeans'] },
          { name: 'Kurtki i płaszcze', slug: 'kurtki-damskie', aliexpressKeywords: ['women jacket', 'coat'] },
          { name: 'Bielizna', slug: 'bielizna-damska', aliexpressKeywords: ['lingerie', 'underwear'] },
        ],
      },
      {
        name: 'Odzież męska',
        slug: 'odziez-meska',
        subcategories: [
          { name: 'Koszule', slug: 'koszule-meskie', aliexpressKeywords: ['men shirt'] },
          { name: 'T-shirty i polo', slug: 'tshirty-polo', aliexpressKeywords: ['t-shirt', 'polo shirt'] },
          { name: 'Spodnie męskie', slug: 'spodnie-meskie', aliexpressKeywords: ['men pants', 'trousers'] },
          { name: 'Kurtki męskie', slug: 'kurtki-meskie', aliexpressKeywords: ['men jacket'] },
          { name: 'Garnitury', slug: 'garnitury', aliexpressKeywords: ['suit', 'men suit'] },
        ],
      },
      {
        name: 'Obuwie',
        slug: 'obuwie',
        subcategories: [
          { name: 'Buty sportowe', slug: 'buty-sportowe', aliexpressKeywords: ['sneakers', 'sport shoes'] },
          { name: 'Buty eleganckie', slug: 'buty-eleganckie', aliexpressKeywords: ['dress shoes', 'formal shoes'] },
          { name: 'Sandały i klapki', slug: 'sandaly-klapki', aliexpressKeywords: ['sandals', 'slippers'] },
          { name: 'Kozaki i botki', slug: 'kozaki-botki', aliexpressKeywords: ['boots', 'ankle boots'] },
        ],
      },
      {
        name: 'Akcesoria',
        slug: 'akcesoria-moda',
        subcategories: [
          { name: 'Torebki', slug: 'torebki', aliexpressKeywords: ['handbag', 'purse'] },
          { name: 'Portfele', slug: 'portfele', aliexpressKeywords: ['wallet'] },
          { name: 'Biżuteria', slug: 'bizuteria', aliexpressKeywords: ['jewelry', 'necklace'] },
          { name: 'Zegarki', slug: 'zegarki', aliexpressKeywords: ['watch', 'wristwatch'] },
          { name: 'Okulary', slug: 'okulary', aliexpressKeywords: ['sunglasses', 'glasses'] },
        ],
      },
    ],
  },
  {
    name: 'Sport i turystyka',
    slug: 'sport-turystyka',
    icon: '⚽',
    sortOrder: 40,
    subcategories: [
      {
        name: 'Fitness',
        slug: 'fitness',
        subcategories: [
          { name: 'Siłownia i crossfit', slug: 'silownia-crossfit', aliexpressKeywords: ['gym equipment', 'dumbbell'] },
          { name: 'Maty i akcesoria', slug: 'maty-fitness', aliexpressKeywords: ['yoga mat', 'fitness mat'] },
          { name: 'Odzież sportowa', slug: 'odziez-sportowa', aliexpressKeywords: ['sportswear', 'gym clothes'] },
          { name: 'Opaski fitness', slug: 'opaski-fitness', aliexpressKeywords: ['fitness band', 'smart band'] },
        ],
      },
      {
        name: 'Rowery i hulajnogi',
        slug: 'rowery-hulajnogi',
        subcategories: [
          { name: 'Rowery', slug: 'rowery', aliexpressKeywords: ['bicycle', 'bike'] },
          { name: 'Hulajnogi elektryczne', slug: 'hulajnogi-elektryczne', aliexpressKeywords: ['electric scooter'] },
          { name: 'Akcesoria rowerowe', slug: 'akcesoria-rowerowe', aliexpressKeywords: ['bike accessories', 'bike light'] },
          { name: 'Kaski', slug: 'kaski', aliexpressKeywords: ['helmet', 'bike helmet'] },
        ],
      },
      {
        name: 'Turystyka',
        slug: 'turystyka',
        subcategories: [
          { name: 'Plecaki', slug: 'plecaki', aliexpressKeywords: ['backpack', 'hiking backpack'] },
          { name: 'Namioty', slug: 'namioty', aliexpressKeywords: ['tent', 'camping tent'] },
          { name: 'Śpiwory', slug: 'spiwory', aliexpressKeywords: ['sleeping bag'] },
          { name: 'Termosy i bidony', slug: 'termosy-bidony', aliexpressKeywords: ['thermos', 'water bottle'] },
        ],
      },
    ],
  },
  {
    name: 'Dziecko',
    slug: 'dziecko',
    icon: '👶',
    sortOrder: 50,
    subcategories: [
      {
        name: 'Zabawki',
        slug: 'zabawki',
        subcategories: [
          { name: 'Klocki', slug: 'klocki', aliexpressKeywords: ['building blocks', 'lego'] },
          { name: 'Lalki i pluszaki', slug: 'lalki-pluszaki', aliexpressKeywords: ['doll', 'plush toy'] },
          { name: 'Gry planszowe', slug: 'gry-planszowe', aliexpressKeywords: ['board game'] },
          { name: 'Puzzle', slug: 'puzzle', aliexpressKeywords: ['puzzle', 'jigsaw'] },
          { name: 'Zabawki RC', slug: 'zabawki-rc', aliexpressKeywords: ['rc toy', 'remote control'] },
        ],
      },
      {
        name: 'Odzież dziecięca',
        slug: 'odziez-dziecieca',
        subcategories: [
          { name: 'Dla niemowląt', slug: 'niemowleta', aliexpressKeywords: ['baby clothes'] },
          { name: 'Dla chłopców', slug: 'odziez-chlopcow', aliexpressKeywords: ['boys clothes'] },
          { name: 'Dla dziewczynek', slug: 'odziez-dziewczynek', aliexpressKeywords: ['girls clothes'] },
          { name: 'Buty dziecięce', slug: 'buty-dzieciece', aliexpressKeywords: ['kids shoes'] },
        ],
      },
      {
        name: 'Wózki i foteliki',
        slug: 'wozki-foteliki',
        subcategories: [
          { name: 'Wózki spacerowe', slug: 'wozki-spacerowe', aliexpressKeywords: ['stroller', 'baby stroller'] },
          { name: 'Wózki głębokie', slug: 'wozki-glebokie', aliexpressKeywords: ['baby carriage'] },
          { name: 'Foteliki samochodowe', slug: 'foteliki-samochodowe', aliexpressKeywords: ['car seat', 'baby car seat'] },
          { name: 'Nosidełka', slug: 'nosidelka', aliexpressKeywords: ['baby carrier'] },
        ],
      },
    ],
  },
  {
    name: 'Zdrowie i uroda',
    slug: 'zdrowie-uroda',
    icon: '💄',
    sortOrder: 60,
    subcategories: [
      {
        name: 'Pielęgnacja twarzy',
        slug: 'pielegnacja-twarzy',
        subcategories: [
          { name: 'Kremy i serum', slug: 'kremy-serum', aliexpressKeywords: ['face cream', 'serum'] },
          { name: 'Oczyszczanie', slug: 'oczyszczanie-twarzy', aliexpressKeywords: ['facial cleanser', 'face wash'] },
          { name: 'Maseczki', slug: 'maseczki-twarz', aliexpressKeywords: ['face mask'] },
          { name: 'Urządzenia do twarzy', slug: 'urzadzenia-twarz', aliexpressKeywords: ['facial device', 'face massager'] },
        ],
      },
      {
        name: 'Pielęgnacja ciała',
        slug: 'pielegnacja-ciala',
        subcategories: [
          { name: 'Balsamy i mleczka', slug: 'balsamy-mleczka', aliexpressKeywords: ['body lotion', 'body cream'] },
          { name: 'Mydła i żele', slug: 'mydla-zele', aliexpressKeywords: ['soap', 'shower gel'] },
          { name: 'Dezodoranty', slug: 'dezodoranty', aliexpressKeywords: ['deodorant'] },
        ],
      },
      {
        name: 'Makijaż',
        slug: 'makijaz',
        subcategories: [
          { name: 'Podkłady', slug: 'podklady', aliexpressKeywords: ['foundation', 'makeup base'] },
          { name: 'Cienie i paletki', slug: 'cienie-paletki', aliexpressKeywords: ['eyeshadow', 'makeup palette'] },
          { name: 'Szminki', slug: 'szminki', aliexpressKeywords: ['lipstick'] },
          { name: 'Pędzle', slug: 'pedzle', aliexpressKeywords: ['makeup brush'] },
        ],
      },
      {
        name: 'Pielęgnacja włosów',
        slug: 'pielegnacja-wlosow',
        subcategories: [
          { name: 'Szampony i odżywki', slug: 'szampony-odzywki', aliexpressKeywords: ['shampoo', 'conditioner'] },
          { name: 'Maski do włosów', slug: 'maski-wlosy', aliexpressKeywords: ['hair mask'] },
          { name: 'Suszarki i prostownice', slug: 'suszarki-prostownice', aliexpressKeywords: ['hair dryer', 'hair straightener'] },
          { name: 'Szczotki i grzebienie', slug: 'szczotki-grzebienie', aliexpressKeywords: ['hair brush', 'comb'] },
        ],
      },
    ],
  },
  {
    name: 'Motoryzacja',
    slug: 'motoryzacja',
    icon: '🚗',
    sortOrder: 70,
    subcategories: [
      {
        name: 'Elektronika samochodowa',
        slug: 'elektronika-samochodowa',
        subcategories: [
          { name: 'Kamery samochodowe', slug: 'kamery-samochodowe', aliexpressKeywords: ['dash cam', 'car camera'] },
          { name: 'Nawigacje GPS', slug: 'nawigacje-gps', aliexpressKeywords: ['gps navigation', 'car gps'] },
          { name: 'Ładowarki samochodowe', slug: 'ladowarki-samochodowe', aliexpressKeywords: ['car charger'] },
          { name: 'Audio samochodowe', slug: 'audio-samochodowe', aliexpressKeywords: ['car audio', 'car stereo'] },
        ],
      },
      {
        name: 'Części samochodowe',
        slug: 'czesci-samochodowe',
        subcategories: [
          { name: 'Wycieraczki', slug: 'wycieraczki', aliexpressKeywords: ['wiper blade'] },
          { name: 'Żarówki', slug: 'zarowki-samochodowe', aliexpressKeywords: ['car bulb', 'led car light'] },
          { name: 'Filtry', slug: 'filtry-samochodowe', aliexpressKeywords: ['car filter', 'air filter'] },
          { name: 'Oleje i płyny', slug: 'oleje-plyny', aliexpressKeywords: ['car oil', 'engine oil'] },
        ],
      },
      {
        name: 'Akcesoria samochodowe',
        slug: 'akcesoria-samochodowe',
        subcategories: [
          { name: 'Pokrowce i dywaniki', slug: 'pokrowce-dywaniki', aliexpressKeywords: ['car seat cover', 'car mat'] },
          { name: 'Organizery', slug: 'organizery-samochodowe', aliexpressKeywords: ['car organizer'] },
          { name: 'Uchwyty do telefonu', slug: 'uchwyty-telefon', aliexpressKeywords: ['car phone holder'] },
          { name: 'Myjnie i kosmetyki', slug: 'myjnie-kosmetyki', aliexpressKeywords: ['car wash', 'car cleaner'] },
        ],
      },
    ],
  },
  {
    name: 'Książki i multimedia',
    slug: 'ksiazki-multimedia',
    icon: '📚',
    sortOrder: 80,
    subcategories: [
      {
        name: 'Książki',
        slug: 'ksiazki',
        subcategories: [
          { name: 'Beletrystyka', slug: 'beletrystyka', aliexpressKeywords: ['fiction book', 'novel'] },
          { name: 'Poradniki', slug: 'poradniki', aliexpressKeywords: ['guide book', 'how to book'] },
          { name: 'Literatura naukowa', slug: 'literatura-naukowa', aliexpressKeywords: ['science book'] },
          { name: 'Komiksy', slug: 'komiksy', aliexpressKeywords: ['comic book', 'manga'] },
        ],
      },
      {
        name: 'Filmy i seriale',
        slug: 'filmy-seriale',
        subcategories: [
          { name: 'DVD', slug: 'dvd', aliexpressKeywords: ['dvd movie'] },
          { name: 'Blu-ray', slug: 'bluray', aliexpressKeywords: ['blu-ray movie'] },
          { name: 'Seriale', slug: 'seriale', aliexpressKeywords: ['tv series'] },
        ],
      },
      {
        name: 'Muzyka',
        slug: 'muzyka',
        subcategories: [
          { name: 'CD', slug: 'cd-muzyka', aliexpressKeywords: ['music cd'] },
          { name: 'Płyty winylowe', slug: 'plyty-winylowe', aliexpressKeywords: ['vinyl record'] },
          { name: 'Instrumenty', slug: 'instrumenty', aliexpressKeywords: ['musical instrument'] },
        ],
      },
    ],
  },
];

async function seedCategories() {
  console.log('🌱 Starting category seeding...\n');

  const batch = adminDb.batch();
  let categoriesCount = 0;
  let subCategoriesCount = 0;
  let subSubCategoriesCount = 0;

  for (const mainCat of CATEGORY_STRUCTURE) {
    const englishMainSlug = MAIN_SLUG_MAP[mainCat.slug] || slugify(mainCat.slug);
    const englishMainName = toTitleCase(englishMainSlug.replace(/-/g, ' '));
    console.log(`📁 Creating main category: ${mainCat.name} (${mainCat.slug} -> ${englishMainSlug})`);
    
    const mainCatRef = adminDb.collection('categories').doc(englishMainSlug);
    batch.set(mainCatRef, {
      name: mainCat.name,
      slug: englishMainSlug,
      slugPl: mainCat.slug,
      icon: mainCat.icon || '📦',
      sortOrder: mainCat.sortOrder,
      translations: {
        en: { name: englishMainName },
      },
      subcategories: [], // Empty for new structure
      createdAt: new Date().toISOString(),
    });
    categoriesCount++;

    for (const subCat of mainCat.subcategories) {
      const englishSubSlug = slugify(subCat.aliexpressKeywords?.[0] || subCat.slug);
      const englishSubName = toTitleCase((subCat.aliexpressKeywords?.[0] || englishSubSlug).replace(/-/g, ' '));
      console.log(`  📂 Creating subcategory: ${subCat.name} (${subCat.slug} -> ${englishSubSlug})`);
      
      const subCatRef = mainCatRef.collection('subcategories').doc(englishSubSlug);
      batch.set(subCatRef, {
        name: subCat.name,
        slug: englishSubSlug,
        slugPl: subCat.slug,
        sortOrder: 10,
        subcategories: subCat.subcategories.map((sub, idx) => ({
          name: sub.name,
          slug: slugify(sub.aliexpressKeywords?.[0] || sub.slug),
          sortOrder: (idx + 1) * 10,
        })),
        translations: {
          en: { name: englishSubName },
        },
        createdAt: new Date().toISOString(),
      });
      subCategoriesCount++;

      // Create sub-subcategories collection
      for (const subSubCat of subCat.subcategories) {
        const englishSubSubSlug = slugify(subSubCat.aliexpressKeywords?.[0] || subSubCat.slug);
        const englishSubSubName = toTitleCase((subSubCat.aliexpressKeywords?.[0] || englishSubSubSlug).replace(/-/g, ' '));
        console.log(`    📄 Creating sub-subcategory: ${subSubCat.name} (${subSubCat.slug} -> ${englishSubSubSlug})`);
        
        const subSubCatRef = subCatRef.collection('subcategories').doc(englishSubSubSlug);
        batch.set(subSubCatRef, {
          name: subSubCat.name,
          slug: englishSubSubSlug,
          slugPl: subSubCat.slug,
          aliexpressKeywords: subSubCat.aliexpressKeywords || [],
          translations: {
            en: { name: englishSubSubName },
          },
          createdAt: new Date().toISOString(),
        });
        subSubCategoriesCount++;
      }
    }
  }

  console.log('\n💾 Committing batch write...');
  await batch.commit();

  console.log('\n✅ Category seeding completed!');
  console.log(`   Main categories: ${categoriesCount}`);
  console.log(`   Subcategories: ${subCategoriesCount}`);
  console.log(`   Sub-subcategories: ${subSubCategoriesCount}`);
  console.log(`   Total: ${categoriesCount + subCategoriesCount + subSubCategoriesCount}\n`);
}

// Run if called directly
if (require.main === module) {
  seedCategories()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error seeding categories:', error);
      process.exit(1);
    });
}

export { seedCategories, CATEGORY_STRUCTURE };
