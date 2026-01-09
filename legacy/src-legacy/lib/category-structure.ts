import { Category } from '@/lib/types';

/**
 * Kanoniczna struktura 3-poziomowych kategorii dla Okazje Plus.
 * Zawiera slug-i kompatybilne z importami (AliExpress keywords w sub-sub).
 */
export const CATEGORY_STRUCTURE: Category[] = [
  {
    name: 'Elektronika',
    slug: 'elektronika',
    icon: '💻',
    sortOrder: 10,
    description: 'Smart sprzęt, audio, foto i akcesoria.',
    subcategories: [
      {
        name: 'Smartfony i telefony',
        slug: 'smartfony-telefony',
        subcategories: [
          { name: 'Smartfony', slug: 'smartfony', importKeywords: ['smartphone', 'mobile phone', 'android phone', 'iphone'] },
          { name: 'Telefony podstawowe', slug: 'telefony-podstawowe', importKeywords: ['feature phone', 'basic phone'] },
          { name: 'Akcesoria GSM', slug: 'akcesoria-gsm', importKeywords: ['phone accessories', 'case', 'screen protector'] },
          { name: 'Ładowarki i kable', slug: 'ladowarki-kable', importKeywords: ['charger', 'usb cable', 'power adapter'] },
          { name: 'Powerbanki', slug: 'powerbanki', importKeywords: ['power bank', 'portable charger'] },
        ],
      },
      {
        name: 'Komputery',
        slug: 'komputery',
        subcategories: [
          { name: 'Laptopy', slug: 'laptopy', importKeywords: ['laptop', 'notebook', 'ultrabook'] },
          { name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne', importKeywords: ['desktop pc', 'computer'] },
          { name: 'Tablety', slug: 'tablety', importKeywords: ['tablet', 'ipad'] },
          { name: 'Monitory', slug: 'monitory', importKeywords: ['monitor', 'display'] },
          { name: 'Drukarki i skanery', slug: 'drukarki-skanery', importKeywords: ['printer', 'scanner'] },
        ],
      },
      {
        name: 'Audio i video',
        slug: 'audio-video',
        subcategories: [
          { name: 'Słuchawki', slug: 'sluchawki', importKeywords: ['headphones', 'earbuds', 'earphones'] },
          { name: 'Głośniki', slug: 'glosniki', importKeywords: ['speaker', 'bluetooth speaker'] },
          { name: 'Soundbary', slug: 'soundbary', importKeywords: ['soundbar', 'home theater'] },
          { name: 'Mikrofony', slug: 'mikrofony', importKeywords: ['microphone', 'mic'] },
          { name: 'Kamery i kamerki', slug: 'kamery', importKeywords: ['camera', 'webcam'] },
        ],
      },
      {
        name: 'Fotografia',
        slug: 'fotografia',
        subcategories: [
          { name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe', importKeywords: ['digital camera', 'dslr'] },
          { name: 'Obiektywy', slug: 'obiektywy', importKeywords: ['camera lens', 'lens'] },
          { name: 'Akcesoria fotograficzne', slug: 'akcesoria-foto', importKeywords: ['camera accessories', 'tripod'] },
          { name: 'Karty pamięci', slug: 'karty-pamieci', importKeywords: ['memory card', 'sd card'] },
        ],
      },
      {
        name: 'Gaming',
        slug: 'gaming',
        subcategories: [
          { name: 'Konsole', slug: 'konsole', importKeywords: ['game console', 'gaming console'] },
          { name: 'Gry', slug: 'gry', importKeywords: ['video game', 'game'] },
          { name: 'Akcesoria do gier', slug: 'akcesoria-gaming', importKeywords: ['gaming accessories', 'controller'] },
          { name: 'Myszki gamingowe', slug: 'myszki-gaming', importKeywords: ['gaming mouse'] },
          { name: 'Klawiatury gamingowe', slug: 'klawiatury-gaming', importKeywords: ['gaming keyboard'] },
        ],
      },
    ],
  },
  {
    name: 'Dom i ogród',
    slug: 'dom-ogrod',
    icon: '🏡',
    sortOrder: 20,
    description: 'Wyposażenie, AGD i wszystko co potrzebne w domu.',
    subcategories: [
      {
        name: 'Meble',
        slug: 'meble',
        subcategories: [
          { name: 'Sofy i fotele', slug: 'sofy-fotele' },
          { name: 'Stoły i krzesła', slug: 'stoly-krzesla', importKeywords: ['table', 'chair', 'dining set'] },
          { name: 'Łóżka', slug: 'lozka' },
          { name: 'Szafy i komody', slug: 'szafy-komody' },
          { name: 'Regały', slug: 'regaly' },
        ],
      },
      {
        name: 'Oświetlenie',
        slug: 'oswietlenie',
        subcategories: [
          { name: 'Lampy sufitowe', slug: 'lampy-sufitowe', importKeywords: ['ceiling light', 'chandelier'] },
          { name: 'Lampy stojące', slug: 'lampy-stojace', importKeywords: ['floor lamp', 'standing lamp'] },
          { name: 'Lampki nocne', slug: 'lampki-nocne', importKeywords: ['night lamp', 'bedside lamp'] },
          { name: 'Żarówki LED', slug: 'zarowki-led', importKeywords: ['led bulb', 'light bulb'] },
        ],
      },
      {
        name: 'Ogród',
        slug: 'ogrod',
        subcategories: [
          { name: 'Meble ogrodowe', slug: 'meble-ogrodowe', importKeywords: ['garden furniture', 'outdoor furniture'] },
          { name: 'Narzędzia ogrodowe', slug: 'narzedzia-ogrodowe', importKeywords: ['garden tools', 'gardening tools'] },
          { name: 'Grille', slug: 'grille', importKeywords: ['bbq', 'grill', 'barbecue'] },
          { name: 'Dekoracje ogrodowe', slug: 'dekoracje-ogrodowe', importKeywords: ['garden decoration'] },
        ],
      },
      {
        name: 'AGD małe',
        slug: 'agd-male',
        subcategories: [
          { name: 'Ekspresy do kawy', slug: 'ekspresy-kawy', importKeywords: ['coffee maker', 'espresso machine'] },
          { name: 'Blendery i miksery', slug: 'blendery-miksery', importKeywords: ['blender', 'mixer'] },
          { name: 'Roboty kuchenne', slug: 'roboty-kuchenne', importKeywords: ['food processor', 'kitchen robot'] },
          { name: 'Odkurzacze', slug: 'odkurzacze', importKeywords: ['vacuum cleaner', 'robot vacuum'] },
        ],
      },
      {
        name: 'AGD duże',
        slug: 'agd-duze',
        subcategories: [
          { name: 'Lodówki', slug: 'lodowki', importKeywords: ['refrigerator', 'fridge'] },
          { name: 'Pralki', slug: 'pralki', importKeywords: ['washing machine'] },
          { name: 'Zmywarki', slug: 'zmywarki', importKeywords: ['dishwasher'] },
          { name: 'Kuchenki', slug: 'kuchenki', importKeywords: ['oven', 'cooker'] },
        ],
      },
    ],
  },
  {
    name: 'Moda',
    slug: 'moda',
    icon: '👔',
    sortOrder: 30,
    description: 'Moda damska, męska, obuwie, akcesoria.',
    subcategories: [
      {
        name: 'Odzież damska',
        slug: 'odziez-damska',
        subcategories: [
          { name: 'Sukienki', slug: 'sukienki' },
          { name: 'Bluzki i koszule', slug: 'bluzki-koszule', importKeywords: ['blouse', 'women shirt'] },
          { name: 'Spodnie i jeansy', slug: 'spodnie-damskie', importKeywords: ['women pants', 'jeans'] },
          { name: 'Kurtki i płaszcze', slug: 'kurtki-damskie', importKeywords: ['women jacket', 'coat'] },
          { name: 'Bielizna', slug: 'bielizna-damska', importKeywords: ['lingerie', 'underwear'] },
        ],
      },
      {
        name: 'Odzież męska',
        slug: 'odziez-meska',
        subcategories: [
          { name: 'Koszule', slug: 'koszule-meskie', importKeywords: ['men shirt'] },
          { name: 'T-shirty i polo', slug: 'tshirty-polo', importKeywords: ['t-shirt', 'polo shirt'] },
          { name: 'Spodnie męskie', slug: 'spodnie-meskie', importKeywords: ['men pants', 'trousers'] },
          { name: 'Kurtki męskie', slug: 'kurtki-meskie', importKeywords: ['men jacket'] },
          { name: 'Garnitury', slug: 'garnitury', importKeywords: ['suit', 'men suit'] },
        ],
      },
      {
        name: 'Obuwie',
        slug: 'obuwie',
        subcategories: [
          { name: 'Buty sportowe', slug: 'buty-sportowe', importKeywords: ['sneakers', 'sport shoes'] },
          { name: 'Buty eleganckie', slug: 'buty-eleganckie', importKeywords: ['dress shoes', 'formal shoes'] },
          { name: 'Sandały i klapki', slug: 'sandaly-klapki', importKeywords: ['sandals', 'slippers'] },
          { name: 'Kozaki i botki', slug: 'kozaki-botki', importKeywords: ['boots', 'ankle boots'] },
        ],
      },
      {
        name: 'Akcesoria',
        slug: 'akcesoria-moda',
        subcategories: [
          { name: 'Torebki', slug: 'torebki', importKeywords: ['handbag', 'purse'] },
          { name: 'Portfele', slug: 'portfele', importKeywords: ['wallet'] },
          { name: 'Biżuteria', slug: 'bizuteria', importKeywords: ['jewelry', 'necklace'] },
          { name: 'Zegarki', slug: 'zegarki', importKeywords: ['watch', 'wristwatch'] },
        ],
      },
    ],
  },
  {
    name: 'Sport i turystyka',
    slug: 'sport-turystyka',
    icon: '⛺',
    sortOrder: 40,
    description: 'Sprzęt sportowy i outdoor.',
    subcategories: [
      {
        name: 'Fitness',
        slug: 'fitness',
        subcategories: [
          { name: 'Bieżnie i orbitreki', slug: 'bieznie-orbitreki' },
          { name: 'Hantle i ciężarki', slug: 'hantle-ciezarki' },
          { name: 'Maty i akcesoria', slug: 'maty-akcesoria' },
        ],
      },
      {
        name: 'Turystyka',
        slug: 'turystyka',
        subcategories: [
              { name: 'Namioty', slug: 'namioty', importKeywords: ['tent'] },
              { name: 'Śpiwory', slug: 'spiwory', importKeywords: ['sleeping bag'] },
              { name: 'Plecaki', slug: 'plecaki', importKeywords: ['backpack'] },
              { name: 'Kije trekkingowe', slug: 'kije-trekkingowe', importKeywords: ['trekking poles'] },
        ],
      },
      {
        name: 'Rowery',
        slug: 'rowery',
        subcategories: [
          { name: 'Rowery górskie', slug: 'rowery-gorskie' },
          { name: 'Rowery szosowe', slug: 'rowery-szosowe' },
          { name: 'Akcesoria rowerowe', slug: 'akcesoria-rowerowe' },
        ],
      },
      {
        name: 'Sporty zimowe',
        slug: 'sporty-zimowe',
        subcategories: [
              { name: 'Narty', slug: 'narty', importKeywords: ['ski', 'skis'] },
              { name: 'Snowboard', slug: 'snowboard', importKeywords: ['snowboard'] },
              { name: 'Odzież zimowa', slug: 'odziez-zimowa', importKeywords: ['winter jacket', 'snow pants'] },
        ],
      },
    ],
  },
  {
    name: 'Dzieci',
    slug: 'dzieci',
    icon: '🧸',
    sortOrder: 50,
    description: 'Zabawki, ubrania i akcesoria dla dzieci.',
    subcategories: [
      {
        name: 'Zabawki',
        slug: 'zabawki',
        subcategories: [
          { name: 'Klocki', slug: 'klocki', importKeywords: ['blocks', 'lego'] },
          { name: 'Gry i puzzle', slug: 'gry-puzzle', importKeywords: ['puzzle', 'board game'] },
          { name: 'Figurki', slug: 'figurki', importKeywords: ['action figure', 'toy figure'] },
        ],
      },
      {
        name: 'Wózki i foteliki',
        slug: 'wozki-foteliki',
        subcategories: [
          { name: 'Wózki', slug: 'wozki', importKeywords: ['stroller', 'baby stroller'] },
          { name: 'Foteliki samochodowe', slug: 'foteliki-samochodowe', importKeywords: ['car seat', 'child car seat'] },
        ],
      },
      {
        name: 'Ubranka dziecięce',
        slug: 'ubranko-dzieciece',
        subcategories: [
          { name: 'Body i pajacyki', slug: 'body-pajacyki', importKeywords: ['onesie', 'bodysuit'] },
          { name: 'Koszulki i bluzy', slug: 'koszulki-bluzy', importKeywords: ['kids t-shirt', 'kids hoodie'] },
          { name: 'Spodnie i legginsy', slug: 'spodnie-legginsy', importKeywords: ['kids pants', 'leggings'] },
        ],
      },
    ],
  },
];
