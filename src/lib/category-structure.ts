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
          { name: 'Smartfony', slug: 'smartfony', description: 'Telefony i akcesoria', translations: undefined, icon: undefined, color: undefined, },
          { name: 'Telefony podstawowe', slug: 'telefony-podstawowe' },
          { name: 'Akcesoria GSM', slug: 'akcesoria-gsm' },
          { name: 'Ładowarki i kable', slug: 'ladowarki-kable' },
          { name: 'Powerbanki', slug: 'powerbanki' },
        ],
      },
      {
        name: 'Komputery',
        slug: 'komputery',
        subcategories: [
          { name: 'Laptopy', slug: 'laptopy' },
          { name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne' },
          { name: 'Tablety', slug: 'tablety' },
          { name: 'Monitory', slug: 'monitory' },
          { name: 'Drukarki i skanery', slug: 'drukarki-skanery' },
        ],
      },
      {
        name: 'Audio i video',
        slug: 'audio-video',
        subcategories: [
          { name: 'Słuchawki', slug: 'sluchawki' },
          { name: 'Głośniki', slug: 'glosniki' },
          { name: 'Soundbary', slug: 'soundbary' },
          { name: 'Mikrofony', slug: 'mikrofony' },
          { name: 'Kamery i kamerki', slug: 'kamery' },
        ],
      },
      {
        name: 'Fotografia',
        slug: 'fotografia',
        subcategories: [
          { name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe' },
          { name: 'Obiektywy', slug: 'obiektywy' },
          { name: 'Akcesoria fotograficzne', slug: 'akcesoria-foto' },
          { name: 'Karty pamięci', slug: 'karty-pamieci' },
        ],
      },
      {
        name: 'Gaming',
        slug: 'gaming',
        subcategories: [
          { name: 'Konsole', slug: 'konsole' },
          { name: 'Gry', slug: 'gry' },
          { name: 'Akcesoria do gier', slug: 'akcesoria-gaming' },
          { name: 'Myszki gamingowe', slug: 'myszki-gaming' },
          { name: 'Klawiatury gamingowe', slug: 'klawiatury-gaming' },
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
          { name: 'Stoły i krzesła', slug: 'stoly-krzesla' },
          { name: 'Łóżka', slug: 'lozka' },
          { name: 'Szafy i komody', slug: 'szafy-komody' },
          { name: 'Regały', slug: 'regaly' },
        ],
      },
      {
        name: 'Oświetlenie',
        slug: 'oswietlenie',
        subcategories: [
          { name: 'Lampy sufitowe', slug: 'lampy-sufitowe' },
          { name: 'Lampy stojące', slug: 'lampy-stojace' },
          { name: 'Lampki nocne', slug: 'lampki-nocne' },
          { name: 'Żarówki LED', slug: 'zarowki-led' },
        ],
      },
      {
        name: 'Ogród',
        slug: 'ogrod',
        subcategories: [
          { name: 'Meble ogrodowe', slug: 'meble-ogrodowe' },
          { name: 'Narzędzia ogrodowe', slug: 'narzedzia-ogrodowe' },
          { name: 'Grille', slug: 'grille' },
          { name: 'Dekoracje ogrodowe', slug: 'dekoracje-ogrodowe' },
        ],
      },
      {
        name: 'AGD małe',
        slug: 'agd-male',
        subcategories: [
          { name: 'Ekspresy do kawy', slug: 'ekspresy-kawy' },
          { name: 'Blendery i miksery', slug: 'blendery-miksery' },
          { name: 'Roboty kuchenne', slug: 'roboty-kuchenne' },
          { name: 'Odkurzacze', slug: 'odkurzacze' },
        ],
      },
      {
        name: 'AGD duże',
        slug: 'agd-duze',
        subcategories: [
          { name: 'Lodówki', slug: 'lodowki' },
          { name: 'Pralki', slug: 'pralki' },
          { name: 'Zmywarki', slug: 'zmywarki' },
          { name: 'Kuchenki', slug: 'kuchenki' },
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
          { name: 'Bluzki i koszule', slug: 'bluzki-koszule' },
          { name: 'Spodnie i jeansy', slug: 'spodnie-damskie' },
          { name: 'Kurtki i płaszcze', slug: 'kurtki-damskie' },
          { name: 'Bielizna', slug: 'bielizna-damska' },
        ],
      },
      {
        name: 'Odzież męska',
        slug: 'odziez-meska',
        subcategories: [
          { name: 'Koszule', slug: 'koszule-meskie' },
          { name: 'T-shirty i polo', slug: 'tshirty-polo' },
          { name: 'Spodnie męskie', slug: 'spodnie-meskie' },
          { name: 'Kurtki męskie', slug: 'kurtki-meskie' },
          { name: 'Garnitury', slug: 'garnitury' },
        ],
      },
      {
        name: 'Obuwie',
        slug: 'obuwie',
        subcategories: [
          { name: 'Buty sportowe', slug: 'buty-sportowe' },
          { name: 'Buty eleganckie', slug: 'buty-eleganckie' },
          { name: 'Sandały i klapki', slug: 'sandaly-klapki' },
          { name: 'Kozaki i botki', slug: 'kozaki-botki' },
        ],
      },
      {
        name: 'Akcesoria',
        slug: 'akcesoria-moda',
        subcategories: [
          { name: 'Torebki', slug: 'torebki' },
          { name: 'Portfele', slug: 'portfele' },
          { name: 'Biżuteria', slug: 'bizuteria' },
          { name: 'Zegarki', slug: 'zegarki' },
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
          { name: 'Namioty', slug: 'namioty' },
          { name: 'Śpiwory', slug: 'spiwory' },
          { name: 'Plecaki', slug: 'plecaki' },
          { name: 'Kije trekkingowe', slug: 'kije-trekkingowe' },
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
          { name: 'Narty', slug: 'narty' },
          { name: 'Snowboard', slug: 'snowboard' },
          { name: 'Odzież zimowa', slug: 'odziez-zimowa' },
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
          { name: 'Klocki', slug: 'klocki' },
          { name: 'Gry i puzzle', slug: 'gry-puzzle' },
          { name: 'Figurki', slug: 'figurki' },
        ],
      },
      {
        name: 'Wózki i foteliki',
        slug: 'wozki-foteliki',
        subcategories: [
          { name: 'Wózki', slug: 'wozki' },
          { name: 'Foteliki samochodowe', slug: 'foteliki-samochodowe' },
        ],
      },
      {
        name: 'Ubranka dziecięce',
        slug: 'ubranko-dzieciece',
        subcategories: [
          { name: 'Body i pajacyki', slug: 'body-pajacyki' },
          { name: 'Koszulki i bluzy', slug: 'koszulki-bluzy' },
          { name: 'Spodnie i legginsy', slug: 'spodnie-legginsy' },
        ],
      },
    ],
  },
];
