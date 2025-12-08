/**
 * Rozbudowana struktura kategorii dla Okazje Plus
 * Inspirowana pepper.pl i AliExpress - kompletna hierarchia 3-poziomowa
 * Z pełnymi tłumaczeniami: PL, EN, DE
 */

import { Category, Subcategory, SubSubcategory } from './types';

// Helper: Dodaj tłumaczenia do SubSubcategory
const withTranslations = (
  subsub: { name: string; slug: string; sortOrder?: number; icon?: string; color?: string; importKeywords?: string[] },
  en: string,
  de: string
): SubSubcategory => ({
  ...subsub,
  translations: {
    en: { name: en },
    de: { name: de }
  }
});

// Helper: Dodaj tłumaczenia do Subcategory
const withSubTranslations = (
  sub: {
    name: string;
    slug: string;
    sortOrder?: number;
    icon?: string;
    color?: string;
    subcategories?: SubSubcategory[];
  },
  en: string,
  de: string
): Subcategory => ({
  ...sub,
  translations: {
    en: { name: en },
    de: { name: de }
  }
});

// Helper: Dodaj tłumaczenia do Category
const withCatTranslations = (
  cat: {
    name: string;
    slug: string;
    sortOrder?: number;
    icon?: string;
    description?: string;
    subcategories?: Subcategory[];
  },
  en: string,
  enDesc: string,
  de: string,
  deDesc: string
): Omit<Category, 'id'> => ({
  ...cat,
  translations: {
    en: { name: en, description: enDesc },
    de: { name: de, description: deDesc }
  }
});

// UWAGA: Rozszerzona struktura kategorii zgodna z wzorcami AliExpress / Pepper.pl
// Główne cele: szeroka pokrywalność, SEO-friendly slugi, możliwość łatwej ekspansji AI enrichment
export const CATEGORY_SEEDS: Omit<Category, 'id'>[] = [
  withCatTranslations({
    name: 'Elektronika',
    slug: 'elektronika',
    icon: '📱',
    description: 'Smartfony, komputery, akcesoria elektroniczne i sprzęt audio-wideo',
    sortOrder: 1,
    subcategories: [
      withSubTranslations({
        name: 'Smartfony i telefony',
        slug: 'smartfony-telefony',
        icon: '📱',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Smartfony', slug: 'smartfony', sortOrder: 1 }, 'Smartphones', 'Smartphones'),
          withTranslations({ name: 'iPhone', slug: 'iphone', sortOrder: 2 }, 'iPhone', 'iPhone'),
          withTranslations({ name: 'Samsung Galaxy', slug: 'samsung-galaxy', sortOrder: 3 }, 'Samsung Galaxy', 'Samsung Galaxy'),
          withTranslations({ name: 'Xiaomi', slug: 'xiaomi-smartfony', sortOrder: 4 }, 'Xiaomi', 'Xiaomi'),
          withTranslations({ name: 'Huawei', slug: 'huawei-smartfony', sortOrder: 5 }, 'Huawei', 'Huawei'),
          withTranslations({ name: 'Oppo', slug: 'oppo', sortOrder: 6 }, 'Oppo', 'Oppo'),
          withTranslations({ name: 'Realme', slug: 'realme', sortOrder: 7 }, 'Realme', 'Realme'),
          withTranslations({ name: 'Telefony klasyczne', slug: 'telefony-klasyczne', sortOrder: 2 }, 'Classic phones', 'Klassische Telefone'),
          withTranslations({ name: 'Akcesoria GSM', slug: 'akcesoria-gsm', sortOrder: 3 }, 'GSM accessories', 'GSM-Zubehör'),
          withTranslations({ name: 'Etui i pokrowce', slug: 'etui-pokrowce', sortOrder: 4 }, 'Cases and covers', 'Hüllen und Taschen'),
          withTranslations({ name: 'Ładowarki i kable', slug: 'ladowarki-kable', sortOrder: 5 }, 'Chargers and cables', 'Ladegeräte und Kabel'),
          withTranslations({ name: 'Ładowarki bezprzewodowe', slug: 'ladowarki-bezprzewodowe', sortOrder: 6 }, 'Wireless chargers', 'Wireless Ladegeräte'),
          withTranslations({ name: 'Kable USB-C', slug: 'kable-usb-c', sortOrder: 7 }, 'USB-C cables', 'USB-C Kabel'),
          withTranslations({ name: 'Kable Lightning', slug: 'kable-lightning', sortOrder: 8 }, 'Lightning cables', 'Lightning Kabel'),
          withTranslations({ name: 'Power banki', slug: 'power-banki', sortOrder: 6 }, 'Power banks', 'Powerbanks'),
          withTranslations({ name: 'Folie i szkła ochronne', slug: 'folie-szkla', sortOrder: 7 }, 'Screen protectors', 'Schutzfolien und Glas'),
          withTranslations({ name: 'Uchwyty samochodowe', slug: 'uchwyty-samochodowe-telefon', sortOrder: 8 }, 'Car phone holders', 'Autotelefonhalter'),
          withTranslations({ name: 'Karty SIM', slug: 'karty-sim', sortOrder: 9 }, 'SIM cards', 'SIM-Karten'),
          withTranslations({ name: 'Aparaty słuchowe', slug: 'aparaty-sluchowe', sortOrder: 10 }, 'Hearing aids', 'Hörgeräte'),
        ]
      }, 'Smartphones and phones', 'Smartphones und Telefone'),
      withSubTranslations({
        name: 'Komputery i laptopy',
        slug: 'komputery-laptopy',
        icon: '💻',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Laptopy', slug: 'laptopy', sortOrder: 1 }, 'Laptops', 'Laptops'),
          withTranslations({ name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne', sortOrder: 2 }, 'Desktop computers', 'Desktops'),
          withTranslations({ name: 'Monitory', slug: 'monitory', sortOrder: 3 }, 'Monitors', 'Monitore'),
          withTranslations({ name: 'Dyski twarde i SSD', slug: 'dyski-ssd', sortOrder: 4 }, 'Hard drives and SSD', 'Festplatten und SSDs'),
          withTranslations({ name: 'Karty graficzne', slug: 'karty-graficzne', sortOrder: 5 }, 'Graphics cards', 'Grafikkarten'),
          withTranslations({ name: 'Procesory', slug: 'procesory', sortOrder: 6 }, 'Processors', 'Prozessoren'),
          withTranslations({ name: 'Płyty główne', slug: 'plyty-glowne', sortOrder: 7 }, 'Motherboards', 'Motherboards'),
          withTranslations({ name: 'Pamięci RAM', slug: 'pamieci-ram', sortOrder: 8 }, 'RAM memory', 'RAM-Speicher'),
          withTranslations({ name: 'Obudowy PC', slug: 'obudowy-pc', sortOrder: 9 }, 'PC cases', 'PC-Gehäuse'),
          withTranslations({ name: 'Zasilacze', slug: 'zasilacze', sortOrder: 10 }, 'Power supplies', 'Stromversorgungen'),
          withTranslations({ name: 'Chłodzenie PC', slug: 'chlodzenie-pc', sortOrder: 11 }, 'PC cooling', 'PC-Kühlung'),
        ]
      }, 'Computers and laptops', 'Computer und Laptops'),
      withSubTranslations({
        name: 'Tablety i czytniki',
        slug: 'tablety-czytniki',
        icon: '📱',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Tablety', slug: 'tablety', sortOrder: 1 }, 'Tablets', 'Tablets'),
          withTranslations({ name: 'Czytniki e-booków', slug: 'czytniki-ebookow', sortOrder: 2 }, 'E-readers', 'E-Book Reader'),
          withTranslations({ name: 'Akcesoria do tabletów', slug: 'akcesoria-tablety', sortOrder: 3 }, 'Tablet accessories', 'Tablet-Zubehör'),
        ]
      }, 'Tablets and readers', 'Tablets und eBook-Reader'),
      withSubTranslations({
        name: 'Audio i wideo',
        slug: 'audio-wideo',
        icon: '🎧',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Słuchawki', slug: 'sluchawki', sortOrder: 1 }, 'Headphones', 'Kopfhörer'),
          withTranslations({ name: 'Głośniki', slug: 'glosniki', sortOrder: 2 }, 'Speakers', 'Lautsprecher'),
          withTranslations({ name: 'Soundbary', slug: 'soundbary', sortOrder: 3 }, 'Soundbars', 'Soundbars'),
          withTranslations({ name: 'Mikrofony', slug: 'mikrofony', sortOrder: 4 }, 'Microphones', 'Mikrofone'),
          withTranslations({ name: 'Amplitunery', slug: 'amplitunery', sortOrder: 5 }, 'Amplifiers', 'Verstärker'),
          withTranslations({ name: 'Odtwarzacze MP3/MP4', slug: 'odtwarzacze-mp3', sortOrder: 6 }, 'MP3/MP4 players', 'MP3/MP4-Player'),
        ]
      }, 'Audio and video', 'Audio und Video'),
      withSubTranslations({
        name: 'Telewizory i projektory',
        slug: 'telewizory-projektory',
        icon: '📺',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Telewizory', slug: 'telewizory', sortOrder: 1 }, 'TVs', 'Fernseher'),
          withTranslations({ name: 'Projektory', slug: 'projektory', sortOrder: 2 }, 'Projectors', 'Beamer'),
          withTranslations({ name: 'Uchwyty do TV', slug: 'uchwyty-tv', sortOrder: 3 }, 'TV mounts', 'TV-Halterungen'),
          withTranslations({ name: 'Anteny', slug: 'anteny', sortOrder: 4 }, 'Antennas', 'Antennen'),
        ]
      }, 'TVs and projectors', 'Fernseher und Beamer'),
      withSubTranslations({
        name: 'Fotografia i kamery',
        slug: 'fotografia-kamery',
        icon: '📷',
        sortOrder: 6,
        subcategories: [
          withTranslations({ name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe', sortOrder: 1 }, 'Digital cameras', 'Digitalkameras'),
          withTranslations({ name: 'Obiektywy', slug: 'obiektywy', sortOrder: 2 }, 'Lenses', 'Objektive'),
          withTranslations({ name: 'Kamery sportowe', slug: 'kamery-sportowe', sortOrder: 3 }, 'Action cameras', 'Action-Kameras'),
          withTranslations({ name: 'Drony', slug: 'drony', sortOrder: 4 }, 'Drones', 'Drohnen'),
          withTranslations({ name: 'Akcesoria fotograficzne', slug: 'akcesoria-foto', sortOrder: 5 }, 'Photography accessories', 'Foto-Zubehör'),
          withTranslations({ name: 'Statywy', slug: 'statywy', sortOrder: 6 }, 'Tripods', 'Stative'),
        ]
      }, 'Photography and cameras', 'Fotografie und Kameras'),
      withSubTranslations({
        name: 'Gaming',
        slug: 'gaming',
        icon: '🎮',
        sortOrder: 7,
        subcategories: [
          withTranslations({ name: 'Konsole', slug: 'konsole', sortOrder: 1 }, 'Consoles', 'Konsolen'),
          withTranslations({ name: 'Gry wideo', slug: 'gry-wideo', sortOrder: 2 }, 'Video games', 'Videospiele'),
          withTranslations({ name: 'Akcesoria do konsol', slug: 'akcesoria-konsole', sortOrder: 3 }, 'Console accessories', 'Konsolen-Zubehör'),
          withTranslations({ name: 'Kontrolery i pada', slug: 'kontrolery-pady', sortOrder: 4 }, 'Controllers and gamepads', 'Controller und Gamepads'),
          withTranslations({ name: 'Zestawy VR', slug: 'zestawy-vr', sortOrder: 5 }, 'VR sets', 'VR-Headsets'),
          withTranslations({ name: 'Fotele gamingowe', slug: 'fotele-gamingowe', sortOrder: 6 }, 'Gaming chairs', 'Gaming-Stühle'),
        ]
      }, 'Gaming', 'Gaming'),
      withSubTranslations({
        name: 'Akcesoria komputerowe',
        slug: 'akcesoria-komputerowe',
        icon: '⌨️',
        sortOrder: 8,
        subcategories: [
          withTranslations({ name: 'Klawiatury', slug: 'klawiatury', sortOrder: 1 }, 'Keyboards', 'Tastaturen'),
          withTranslations({ name: 'Myszki', slug: 'myszki', sortOrder: 2 }, 'Mice', 'Maus'),
          withTranslations({ name: 'Podkładki pod mysz', slug: 'podkladki-mysz', sortOrder: 3 }, 'Mouse pads', 'Mousepads'),
          withTranslations({ name: 'Głośniki komputerowe', slug: 'glosniki-komputerowe', sortOrder: 4 }, 'Computer speakers', 'Computer-Lautsprecher'),
          withTranslations({ name: 'Kamery internetowe', slug: 'kamery-internetowe', sortOrder: 5 }, 'Webcams', 'Webcams'),
          withTranslations({ name: 'Pendrive i karty pamięci', slug: 'pendrive-karty', sortOrder: 6 }, 'USB drives and memory cards', 'USB-Laufwerke und Speicherkarten'),
          withTranslations({ name: 'Drukarki i skanery', slug: 'drukarki-skanery', sortOrder: 7 }, 'Printers and scanners', 'Drucker und Scanner'),
        ]
      }, 'Computer accessories', 'Computerzubehör'),
    ]
  },
  'Electronics',
  'Smartphones, computers, electronics and audio-video equipment',
  'Elektronik',
  'Smartphones, Computer, Elektronik und Audio-Video-Geräte'
  ),
];
  {
    name: 'Dom i ogród',
    slug: 'dom-ogrod',
    icon: '🏠',
    description: 'Meble, wyposażenie wnętrz, narzędzia i ogród',
    sortOrder: 2,
    subcategories: [
      {
        name: 'Meble',
        slug: 'meble',
        icon: '🛋️',
        sortOrder: 1,
        subcategories: [
          { name: 'Sofy i kanapy', slug: 'sofy-kanapy', sortOrder: 1 },
          { name: 'Fotele', slug: 'fotele', sortOrder: 2 },
          { name: 'Stoły', slug: 'stoly', sortOrder: 3 },
          { name: 'Krzesła', slug: 'krzesla', sortOrder: 4 },
          { name: 'Szafy i komody', slug: 'szafy-komody', sortOrder: 5 },
          { name: 'Biurka', slug: 'biurka', sortOrder: 6 },
          { name: 'Regały i półki', slug: 'regaly-polki', sortOrder: 7 },
          { name: 'Meble ogrodowe', slug: 'meble-ogrodowe', sortOrder: 8 },
        ]
      },
      {
        name: 'Oświetlenie',
        slug: 'oswietlenie',
        icon: '💡',
        sortOrder: 2,
        subcategories: [
          { name: 'Lampy wiszące', slug: 'lampy-wiszace', sortOrder: 1 },
          { name: 'Lampy stołowe', slug: 'lampy-stolowe', sortOrder: 2 },
          { name: 'Lampy stojące', slug: 'lampy-stojace', sortOrder: 3 },
          { name: 'Kinkiety', slug: 'kinkiety', sortOrder: 4 },
          { name: 'Żarówki LED', slug: 'zarowki-led', sortOrder: 5 },
          { name: 'Oświetlenie smart', slug: 'oswietlenie-smart', sortOrder: 6 },
          { name: 'Oświetlenie ogrodowe', slug: 'oswietlenie-ogrodowe', sortOrder: 7 },
        ]
      },
      {
        name: 'Dekoracje',
        slug: 'dekoracje',
        icon: '🎨',
        sortOrder: 3,
        subcategories: [
          { name: 'Obrazy i plakaty', slug: 'obrazy-plakaty', sortOrder: 1 },
          { name: 'Ramki', slug: 'ramki', sortOrder: 2 },
          { name: 'Zegary', slug: 'zegary', sortOrder: 3 },
          { name: 'Wazony', slug: 'wazony', sortOrder: 4 },
          { name: 'Świeczki', slug: 'swieczki', sortOrder: 5 },
          { name: 'Poduszki dekoracyjne', slug: 'poduszki-dekoracyjne', sortOrder: 6 },
          { name: 'Dywany', slug: 'dywany', sortOrder: 7 },
        ]
      },
      {
        name: 'AGD małe',
        slug: 'agd-male',
        icon: '☕',
        sortOrder: 4,
        subcategories: [
          { name: 'Ekspresy do kawy', slug: 'ekspresy-kawy', sortOrder: 1 },
          { name: 'Czajniki', slug: 'czajniki', sortOrder: 2 },
          { name: 'Tostery', slug: 'tostery', sortOrder: 3 },
          { name: 'Blendery', slug: 'blendery', sortOrder: 4 },
          { name: 'Roboty kuchenne', slug: 'roboty-kuchenne', sortOrder: 5 },
          { name: 'Mikrofale', slug: 'mikrofale', sortOrder: 6 },
          { name: 'Frytkownice', slug: 'frytkownice', sortOrder: 7 },
          { name: 'Sokowirówki', slug: 'sokownirowki', sortOrder: 8 },
          { name: 'Miksery', slug: 'miksery', sortOrder: 9 },
          { name: 'Grille elektryczne', slug: 'grille-elektryczne', sortOrder: 10 },
        ]
      },
      {
        name: 'AGD duże',
        slug: 'agd-duze',
        icon: '🔧',
        sortOrder: 5,
        subcategories: [
          { name: 'Pralki', slug: 'pralki', sortOrder: 1 },
          { name: 'Suszarki', slug: 'suszarki', sortOrder: 2 },
          { name: 'Lodówki', slug: 'lodowki', sortOrder: 3 },
          { name: 'Zamrażarki', slug: 'zamrazarki', sortOrder: 4 },
          { name: 'Zmywarki', slug: 'zmywarki', sortOrder: 5 },
          { name: 'Kuchnie gazowe i elektryczne', slug: 'kuchnie', sortOrder: 6 },
          { name: 'Piekarniki', slug: 'piekarniki', sortOrder: 7 },
          { name: 'Okapy', slug: 'okapy', sortOrder: 8 },
        ]
      },
      {
        name: 'Odkurzacze i sprzątanie',
        slug: 'odkurzacze-sprzatanie',
        icon: '🧹',
        sortOrder: 6,
        subcategories: [
          { name: 'Odkurzacze tradycyjne', slug: 'odkurzacze-tradycyjne', sortOrder: 1 },
          { name: 'Odkurzacze robot', slug: 'odkurzacze-robot', sortOrder: 2 },
          { name: 'Odkurzacze pionowe', slug: 'odkurzacze-pionowe', sortOrder: 3 },
          { name: 'Mopy parowe', slug: 'mopy-parowe', sortOrder: 4 },
          { name: 'Odkurzacze piorące', slug: 'odkurzacze-piorace', sortOrder: 5 },
        ]
      },
      {
        name: 'Narzędzia',
        slug: 'narzedzia',
        icon: '🔨',
        sortOrder: 7,
        subcategories: [
          { name: 'Wiertarki', slug: 'wiertarki', sortOrder: 1 },
          { name: 'Wkrętarki', slug: 'wkretarki', sortOrder: 2 },
          { name: 'Szlifierki', slug: 'szlifierki', sortOrder: 3 },
          { name: 'Piły', slug: 'pily', sortOrder: 4 },
          { name: 'Zestawy narzędzi', slug: 'zestawy-narzedzi', sortOrder: 5 },
          { name: 'Narzędzia ręczne', slug: 'narzedzia-reczne', sortOrder: 6 },
          { name: 'Drabiny i rusztowania', slug: 'drabiny-rusztowania', sortOrder: 7 },
        ]
      },
      {
        name: 'Ogród',
        slug: 'ogrod',
        icon: '🌱',
        sortOrder: 8,
        subcategories: [
          { name: 'Kosiarki', slug: 'kosiarki', sortOrder: 1 },
          { name: 'Podkaszarki', slug: 'podkaszarki', sortOrder: 2 },
          { name: 'Nożyce do żywopłotu', slug: 'nozyce-zywoplotu', sortOrder: 3 },
          { name: 'Piły łańcuchowe', slug: 'pily-lancuchowe', sortOrder: 4 },
          { name: 'Dmuchawy', slug: 'dmuchawy', sortOrder: 5 },
          { name: 'Grille ogrodowe', slug: 'grille-ogrodowe', sortOrder: 6 },
          { name: 'Systemy nawadniania', slug: 'nawadnianie', sortOrder: 7 },
          { name: 'Donice i osłonki', slug: 'donice-oslonki', sortOrder: 8 },
        ]
      },
    ]
  },
  {
    name: 'Moda i uroda',
    slug: 'moda-uroda',
    icon: '👗',
    description: 'Odzież, obuwie, akcesoria i kosmetyki',
    sortOrder: 3,
    subcategories: [
      {
        name: 'Odzież damska',
        slug: 'odziez-damska',
        icon: '👚',
        sortOrder: 1,
        subcategories: [
          { name: 'Sukienki', slug: 'sukienki', sortOrder: 1 },
          { name: 'Bluzki i koszule', slug: 'bluzki-koszule-damskie', sortOrder: 2 },
          { name: 'Spodnie damskie', slug: 'spodnie-damskie', sortOrder: 3 },
          { name: 'Spódnice', slug: 'spodnice', sortOrder: 4 },
          { name: 'Płaszcze i kurtki damskie', slug: 'plaszcze-kurtki-damskie', sortOrder: 5 },
          { name: 'Swetry damskie', slug: 'swetry-damskie', sortOrder: 6 },
          { name: 'Bielizna damska', slug: 'bielizna-damska', sortOrder: 7 },
        ]
      },
      {
        name: 'Odzież męska',
        slug: 'odziez-meska',
        icon: '👔',
        sortOrder: 2,
        subcategories: [
          { name: 'Koszule męskie', slug: 'koszule-meskie', sortOrder: 1 },
          { name: 'T-shirty męskie', slug: 'tshirty-meskie', sortOrder: 2 },
          { name: 'Spodnie męskie', slug: 'spodnie-meskie', sortOrder: 3 },
          { name: 'Kurtki męskie', slug: 'kurtki-meskie', sortOrder: 4 },
          { name: 'Swetry męskie', slug: 'swetry-meskie', sortOrder: 5 },
          { name: 'Garnitury', slug: 'garnitury', sortOrder: 6 },
          { name: 'Bielizna męska', slug: 'bielizna-meska', sortOrder: 7 },
        ]
      },
      {
        name: 'Obuwie',
        slug: 'obuwie',
        icon: '👟',
        sortOrder: 3,
        subcategories: [
          { name: 'Buty sportowe', slug: 'buty-sportowe', sortOrder: 1 },
          { name: 'Buty casualowe', slug: 'buty-casual', sortOrder: 2 },
          { name: 'Sandały', slug: 'sandaly', sortOrder: 3 },
          { name: 'Klapki', slug: 'klapki', sortOrder: 4 },
          { name: 'Kozaki', slug: 'kozaki', sortOrder: 5 },
          { name: 'Szpilki', slug: 'szpilki', sortOrder: 6 },
          { name: 'Trapery', slug: 'trapery', sortOrder: 7 },
        ]
      },
      {
        name: 'Torebki i plecaki',
        slug: 'torebki-plecaki',
        icon: '👜',
        sortOrder: 4,
        subcategories: [
          { name: 'Torebki damskie', slug: 'torebki-damskie', sortOrder: 1 },
          { name: 'Plecaki', slug: 'plecaki', sortOrder: 2 },
          { name: 'Torby podróżne', slug: 'torby-podrozne', sortOrder: 3 },
          { name: 'Walizki', slug: 'walizki', sortOrder: 4 },
          { name: 'Saszetki i nerki', slug: 'saszetki-nerki', sortOrder: 5 },
        ]
      },
      {
        name: 'Biżuteria i zegarki',
        slug: 'bizuteria-zegarki',
        icon: '⌚',
        sortOrder: 5,
        subcategories: [
          { name: 'Zegarki damskie', slug: 'zegarki-damskie', sortOrder: 1 },
          { name: 'Zegarki męskie', slug: 'zegarki-meskie', sortOrder: 2 },
          { name: 'Smartwatche', slug: 'smartwatche', sortOrder: 3 },
          { name: 'Biżuteria', slug: 'bizuteria', sortOrder: 4 },
          { name: 'Bransoletki', slug: 'bransoletki', sortOrder: 5 },
          { name: 'Naszyjniki', slug: 'naszyjniki', sortOrder: 6 },
        ]
      },
      {
        name: 'Kosmetyki',
        slug: 'kosmetyki',
        icon: '💄',
        sortOrder: 6,
        subcategories: [
          { name: 'Makijaż', slug: 'makijaz', sortOrder: 1 },
          { name: 'Pielęgnacja twarzy', slug: 'pielegnacja-twarzy', sortOrder: 2 },
          { name: 'Pielęgnacja włosów', slug: 'pielegnacja-wlosow', sortOrder: 3 },
          { name: 'Pielęgnacja ciała', slug: 'pielegnacja-ciala', sortOrder: 4 },
          { name: 'Perfumy', slug: 'perfumy', sortOrder: 5 },
          { name: 'Akcesoria kosmetyczne', slug: 'akcesoria-kosmetyczne', sortOrder: 6 },
        ]
      },
    ]
  },
  {
    name: 'Sport i rekreacja',
    slug: 'sport-rekreacja',
    icon: '⚽',
    description: 'Sprzęt sportowy, fitness, turystyka i outdoor',
    sortOrder: 4,
    subcategories: [
      {
        name: 'Fitness i siłownia',
        slug: 'fitness-silownia',
        icon: '🏋️',
        sortOrder: 1,
        subcategories: [
          { name: 'Bieżnie', slug: 'bieznie', sortOrder: 1 },
          { name: 'Rowery treningowe', slug: 'rowery-treningowe', sortOrder: 2 },
          { name: 'Orbitreki', slug: 'orbitreki', sortOrder: 3 },
          { name: 'Zestawy siłowni domowej', slug: 'silownia-domowa', sortOrder: 4 },
          { name: 'Hantle i obciążenia', slug: 'hantle-obciazenia', sortOrder: 5 },
          { name: 'Maty fitness', slug: 'maty-fitness', sortOrder: 6 },
          { name: 'Ekspandery i gumy', slug: 'ekspandery-gumy', sortOrder: 7 },
        ]
      },
      {
        name: 'Rowery',
        slug: 'rowery',
        icon: '🚴',
        sortOrder: 2,
        subcategories: [
          { name: 'Rowery górskie', slug: 'rowery-gorskie', sortOrder: 1 },
          { name: 'Rowery miejskie', slug: 'rowery-miejskie', sortOrder: 2 },
          { name: 'Rowery szosowe', slug: 'rowery-szosowe', sortOrder: 3 },
          { name: 'Rowery elektryczne', slug: 'rowery-elektryczne', sortOrder: 4 },
          { name: 'Hulajnogi elektryczne', slug: 'hulajnogi-elektryczne', sortOrder: 5 },
          { name: 'Akcesoria rowerowe', slug: 'akcesoria-rowerowe', sortOrder: 6 },
        ]
      },
      {
        name: 'Turystyka i camping',
        slug: 'turystyka-camping',
        icon: '⛺',
        sortOrder: 3,
        subcategories: [
          { name: 'Namioty', slug: 'namioty', sortOrder: 1 },
          { name: 'Śpiwory', slug: 'spiwory', sortOrder: 2 },
          { name: 'Karimat', slug: 'karimaty', sortOrder: 3 },
          { name: 'Plecaki turystyczne', slug: 'plecaki-turystyczne', sortOrder: 4 },
          { name: 'Latarki i czołówki', slug: 'latarki-czolowki', sortOrder: 5 },
          { name: 'Kuchenki turystyczne', slug: 'kuchenki-turystyczne', sortOrder: 6 },
          { name: 'Termosy', slug: 'termosy', sortOrder: 7 },
        ]
      },
      {
        name: 'Sporty wodne',
        slug: 'sporty-wodne',
        icon: '🏊',
        sortOrder: 4,
        subcategories: [
          { name: 'Kajaki', slug: 'kajaki', sortOrder: 1 },
          { name: 'SUP-y', slug: 'sup-deski', sortOrder: 2 },
          { name: 'Kombinezony neoprenowe', slug: 'kombinezony-neoprenowe', sortOrder: 3 },
          { name: 'Kamizelki ratunkowe', slug: 'kamizelki-ratunkowe', sortOrder: 4 },
          { name: 'Gogle pływackie', slug: 'gogle-plywackie', sortOrder: 5 },
        ]
      },
      {
        name: 'Sporty zimowe',
        slug: 'sporty-zimowe',
        icon: '⛷️',
        sortOrder: 5,
        subcategories: [
          { name: 'Narty', slug: 'narty', sortOrder: 1 },
          { name: 'Snowboardy', slug: 'snowboardy', sortOrder: 2 },
          { name: 'Wiązania', slug: 'wiazania', sortOrder: 3 },
          { name: 'Buty narciarskie', slug: 'buty-narciarskie', sortOrder: 4 },
          { name: 'Kaski', slug: 'kaski-narciarskie', sortOrder: 5 },
          { name: 'Gogle narciarskie', slug: 'gogle-narciarskie', sortOrder: 6 },
        ]
      },
    ]
  },
  {
    name: 'Zdrowie i uroda',
    slug: 'zdrowie-uroda',
    icon: '💊',
    description: 'Suplementy, zdrowie, urządzenia medyczne',
    sortOrder: 5,
    subcategories: [
      {
        name: 'Suplementy diety',
        slug: 'suplementy-diety',
        icon: '💊',
        sortOrder: 1,
        subcategories: [
          { name: 'Witaminy', slug: 'witaminy', sortOrder: 1 },
          { name: 'Minerały', slug: 'mineraly', sortOrder: 2 },
          { name: 'Proteiny', slug: 'proteiny', sortOrder: 3 },
          { name: 'Aminokwasy', slug: 'aminokwasy', sortOrder: 4 },
          { name: 'Kreatyna', slug: 'kreatyna', sortOrder: 5 },
          { name: 'Omega-3', slug: 'omega3', sortOrder: 6 },
        ]
      },
      {
        name: 'Sprzęt medyczny',
        slug: 'sprzet-medyczny',
        icon: '🩺',
        sortOrder: 2,
        subcategories: [
          { name: 'Ciśnieniomierze', slug: 'cisnieniomierze', sortOrder: 1 },
          { name: 'Termometry', slug: 'termometry', sortOrder: 2 },
          { name: 'Pulsoksymetry', slug: 'pulsoksymetry', sortOrder: 3 },
          { name: 'Glukometry', slug: 'glukometry', sortOrder: 4 },
          { name: 'Inhalatory', slug: 'inhalatory', sortOrder: 5 },
        ]
      },
      {
        name: 'Pielęgnacja i uroda',
        slug: 'pielegnacja-uroda',
        icon: '✨',
        sortOrder: 3,
        subcategories: [
          { name: 'Masażery', slug: 'masazery', sortOrder: 1 },
          { name: 'Depilatory', slug: 'depilatory', sortOrder: 2 },
          { name: 'Suszarki do włosów', slug: 'suszarki-wlosow', sortOrder: 3 },
          { name: 'Prostownice', slug: 'prostownice', sortOrder: 4 },
          { name: 'Lokówki', slug: 'lokowki', sortOrder: 5 },
          { name: 'Szczoteczki elektryczne', slug: 'szczoteczki-elektryczne', sortOrder: 6 },
        ]
      },
    ]
  },
  {
    name: 'Dziecko i zabawki',
    slug: 'dziecko-zabawki',
    icon: '🧸',
    description: 'Artykuły dla dzieci, zabawki, ubranka',
    sortOrder: 6,
    subcategories: [
      {
        name: 'Wózki',
        slug: 'wozki',
        icon: '🍼',
        sortOrder: 1,
        subcategories: [
          { name: 'Wózki spacerowe', slug: 'wozki-spacerowe', sortOrder: 1 },
          { name: 'Wózki głębokie', slug: 'wozki-glebokie', sortOrder: 2 },
          { name: 'Wózki wielofunkcyjne', slug: 'wozki-wielofunkcyjne', sortOrder: 3 },
        ]
      },
      {
        name: 'Foteliki samochodowe',
        slug: 'foteliki-samochodowe',
        icon: '🚗',
        sortOrder: 2,
        subcategories: [
          { name: 'Foteliki 0-13kg', slug: 'foteliki-0-13kg', sortOrder: 1 },
          { name: 'Foteliki 9-36kg', slug: 'foteliki-9-36kg', sortOrder: 2 },
          { name: 'Bazy isofix', slug: 'bazy-isofix', sortOrder: 3 },
        ]
      },
      {
        name: 'Zabawki',
        slug: 'zabawki',
        icon: '🧸',
        sortOrder: 3,
        subcategories: [
          { name: 'Klocki', slug: 'klocki', sortOrder: 1 },
          { name: 'Lalki', slug: 'lalki', sortOrder: 2 },
          { name: 'Samochody zabawki', slug: 'samochody-zabawki', sortOrder: 3 },
          { name: 'Gry planszowe', slug: 'gry-planszowe', sortOrder: 4 },
          { name: 'Puzzle', slug: 'puzzle', sortOrder: 5 },
          { name: 'Pluszaki', slug: 'pluszaki', sortOrder: 6 },
        ]
      },
      {
        name: 'Karmienie',
        slug: 'karmienie',
        icon: '🍼',
        sortOrder: 4,
        subcategories: [
          { name: 'Butelki', slug: 'butelki', sortOrder: 1 },
          { name: 'Smoczki', slug: 'smoczki', sortOrder: 2 },
          { name: 'Krzesełka do karmienia', slug: 'krzesełka-karmienia', sortOrder: 3 },
          { name: 'Sterylizatory', slug: 'sterylizatory', sortOrder: 4 },
        ]
      },
    ]
  },
  {
    name: 'Książki i media',
    slug: 'ksiazki-media',
    icon: '📚',
    description: 'Książki, filmy, muzyka, gry',
    sortOrder: 7,
    subcategories: [
      {
        name: 'Książki',
        slug: 'ksiazki',
        icon: '📖',
        sortOrder: 1,
        subcategories: [
          { name: 'Beletrystyka', slug: 'beletrystyka', sortOrder: 1 },
          { name: 'Kryminał i thriller', slug: 'kryminal-thriller', sortOrder: 2 },
          { name: 'Fantasy i SF', slug: 'fantasy-sf', sortOrder: 3 },
          { name: 'Książki dla dzieci', slug: 'ksiazki-dzieci', sortOrder: 4 },
          { name: 'Komiksy i manga', slug: 'komiksy-manga', sortOrder: 5 },
          { name: 'Poradniki', slug: 'poradniki', sortOrder: 6 },
        ]
      },
      {
        name: 'Filmy i seriale',
        slug: 'filmy-seriale',
        icon: '🎬',
        sortOrder: 2,
        subcategories: [
          { name: 'Filmy DVD', slug: 'filmy-dvd', sortOrder: 1 },
          { name: 'Filmy Blu-ray', slug: 'filmy-bluray', sortOrder: 2 },
          { name: 'Seriale', slug: 'seriale', sortOrder: 3 },
          { name: 'Subskrypcje VOD', slug: 'subskrypcje-vod', sortOrder: 4 },
        ]
      },
      {
        name: 'Muzyka',
        slug: 'muzyka',
        icon: '🎵',
        sortOrder: 3,
        subcategories: [
          { name: 'Płyty CD', slug: 'plyty-cd', sortOrder: 1 },
          { name: 'Płyty winylowe', slug: 'plyty-winylowe', sortOrder: 2 },
          { name: 'Subskrypcje muzyczne', slug: 'subskrypcje-muzyczne', sortOrder: 3 },
        ]
      },
    ]
  },
  {
    name: 'Motoryzacja',
    slug: 'motoryzacja',
    icon: '🚗',
    description: 'Akcesoria samochodowe, nawigacje, kamery',
    sortOrder: 8,
    subcategories: [
      {
        name: 'Nawigacje i kamery',
        slug: 'nawigacje-kamery',
        icon: '🗺️',
        sortOrder: 1,
        subcategories: [
          { name: 'Nawigacje GPS', slug: 'nawigacje-gps', sortOrder: 1 },
          { name: 'Wideorejestry', slug: 'wideorejestry', sortOrder: 2 },
          { name: 'Kamery cofania', slug: 'kamery-cofania', sortOrder: 3 },
        ]
      },
      {
        name: 'Audio samochodowe',
        slug: 'audio-samochodowe',
        icon: '🔊',
        sortOrder: 2,
        subcategories: [
          { name: 'Radia samochodowe', slug: 'radia-samochodowe', sortOrder: 1 },
          { name: 'Głośniki samochodowe', slug: 'glosniki-samochodowe', sortOrder: 2 },
          { name: 'Wzmacniacze', slug: 'wzmacniacze', sortOrder: 3 },
          { name: 'Subwoofery', slug: 'subwoofery', sortOrder: 4 },
        ]
      },
      {
        name: 'Akcesoria samochodowe',
        slug: 'akcesoria-samochodowe',
        icon: '🚙',
        sortOrder: 3,
        subcategories: [
          { name: 'Kompresory', slug: 'kompresory', sortOrder: 1 },
          { name: 'Ładowarki samochodowe', slug: 'ladowarki-samochodowe', sortOrder: 2 },
          { name: 'Uchwyty do telefonu', slug: 'uchwyty-telefonu', sortOrder: 3 },
          { name: 'Pokrowce na fotele', slug: 'pokrowce-fotele', sortOrder: 4 },
          { name: 'Bagażniki dachowe', slug: 'bagazniki-dachowe', sortOrder: 5 },
          { name: 'Dywaniki samochodowe', slug: 'dywaniki-samochodowe', sortOrder: 6 },
        ]
      },
    ]
  },
  {
    name: 'Usługi i subskrypcje',
    slug: 'uslugi-subskrypcje',
    icon: '🎫',
    description: 'Usługi cyfrowe, subskrypcje, vouchery',
    sortOrder: 9,
    subcategories: [
      {
        name: 'Streaming',
        slug: 'streaming',
        icon: '📺',
        sortOrder: 1,
        subcategories: [
          { name: 'Netflix', slug: 'netflix', sortOrder: 1 },
          { name: 'HBO Max', slug: 'hbo-max', sortOrder: 2 },
          { name: 'Disney+', slug: 'disney-plus', sortOrder: 3 },
          { name: 'Amazon Prime', slug: 'amazon-prime', sortOrder: 4 },
          { name: 'Spotify', slug: 'spotify', sortOrder: 5 },
          { name: 'YouTube Premium', slug: 'youtube-premium', sortOrder: 6 },
          { name: 'Apple TV+', slug: 'apple-tv-plus', sortOrder: 7 },
          { name: 'SkyShowtime', slug: 'skyshowtime', sortOrder: 8 },
        ]
      },
      {
        name: 'Gaming',
        slug: 'uslugi-gaming',
        icon: '🎮',
        sortOrder: 2,
        subcategories: [
          { name: 'PlayStation Plus', slug: 'playstation-plus', sortOrder: 1 },
          { name: 'Xbox Game Pass', slug: 'xbox-game-pass', sortOrder: 2 },
          { name: 'Nintendo Switch Online', slug: 'nintendo-switch-online', sortOrder: 3 },
          { name: 'EA Play', slug: 'ea-play', sortOrder: 4 },
          { name: 'Ubisoft+', slug: 'ubisoft-plus', sortOrder: 5 },
        ]
      },
      {
        name: 'Software',
        slug: 'software',
        icon: '💻',
        sortOrder: 3,
        subcategories: [
          { name: 'Microsoft Office', slug: 'microsoft-office', sortOrder: 1 },
          { name: 'Windows', slug: 'windows', sortOrder: 2 },
          { name: 'Antivirus', slug: 'antivirus', sortOrder: 3 },
          { name: 'VPN', slug: 'vpn', sortOrder: 4 },
          { name: 'Adobe Creative Cloud', slug: 'adobe-creative-cloud', sortOrder: 5 },
          { name: 'Canva Pro', slug: 'canva-pro', sortOrder: 6 },
        ]
      },
      {
        name: 'Podróże i bilety',
        slug: 'podroze-bilety',
        icon: '✈️',
        sortOrder: 4,
        subcategories: [
          { name: 'Loty', slug: 'loty', sortOrder: 1 },
          { name: 'Hotele', slug: 'hotele', sortOrder: 2 },
          { name: 'Bilety kolejowe', slug: 'bilety-kolejowe', sortOrder: 3 },
          { name: 'Wynajem samochodów', slug: 'wynajem-samochodow', sortOrder: 4 },
          { name: 'Ubezpieczenia turystyczne', slug: 'ubezpieczenia-turystyczne', sortOrder: 5 },
        ]
      },
    ]
  },
  {
    name: 'Zwierzęta',
    slug: 'zwierzeta',
    icon: '🐾',
    description: 'Akcesoria, karmy i pielęgnacja dla zwierząt',
    sortOrder: 10,
    subcategories: [
      {
        name: 'Psy',
        slug: 'psy',
        icon: '🐕',
        sortOrder: 1,
        subcategories: [
          { name: 'Karma dla psów', slug: 'karma-psy', sortOrder: 1 },
          { name: 'Smycze i obroże', slug: 'smycze-obroze', sortOrder: 2 },
          { name: 'Legowiska', slug: 'legowiska-psy', sortOrder: 3 },
          { name: 'Zabawki dla psów', slug: 'zabawki-psy', sortOrder: 4 },
          { name: 'Transporter dla psów', slug: 'transportery-psy', sortOrder: 5 },
          { name: 'Pielęgnacja psów', slug: 'pielegnacja-psy', sortOrder: 6 },
        ]
      },
      {
        name: 'Koty',
        slug: 'koty',
        icon: '🐈',
        sortOrder: 2,
        subcategories: [
          { name: 'Karma dla kotów', slug: 'karma-koty', sortOrder: 1 },
          { name: 'Kuwety i żwirek', slug: 'kuwety-zwirek', sortOrder: 2 },
          { name: 'Drapaki', slug: 'drapaki', sortOrder: 3 },
          { name: 'Zabawki dla kotów', slug: 'zabawki-koty', sortOrder: 4 },
          { name: 'Transporter dla kotów', slug: 'transportery-koty', sortOrder: 5 },
        ]
      },
      {
        name: 'Akwaria i rybki',
        slug: 'akwaria-rybki',
        icon: '🐠',
        sortOrder: 3,
        subcategories: [
          { name: 'Akwaria', slug: 'akwaria', sortOrder: 1 },
          { name: 'Filtry do akwarium', slug: 'filtry-akwarium', sortOrder: 2 },
          { name: 'Oświetlenie akwariowe', slug: 'oswietlenie-akwarium', sortOrder: 3 },
          { name: 'Pokarm dla ryb', slug: 'pokarm-ryb', sortOrder: 4 },
        ]
      },
      {
        name: 'Ptaki i gryzonie',
        slug: 'ptaki-gryzonie',
        icon: '🐹',
        sortOrder: 4,
        subcategories: [
          { name: 'Klatki', slug: 'klatki', sortOrder: 1 },
          { name: 'Karma dla ptaków', slug: 'karma-ptaki', sortOrder: 2 },
          { name: 'Karma dla gryzoni', slug: 'karma-gryzonie', sortOrder: 3 },
          { name: 'Akcesoria dla gryzoni', slug: 'akcesoria-gryzonie', sortOrder: 4 },
        ]
      },
    ]
  },
  {
    name: 'Biuro i szkoła',
    slug: 'biuro-szkola',
    icon: '📝',
    description: 'Materiały biurowe, papiernicze i szkolne',
    sortOrder: 11,
    subcategories: [
      {
        name: 'Materiały piśmienne',
        slug: 'materialy-pismienne',
        icon: '✏️',
        sortOrder: 1,
        subcategories: [
          { name: 'Długopisy', slug: 'dlugopisy', sortOrder: 1 },
          { name: 'Ołówki', slug: 'olowki', sortOrder: 2 },
          { name: 'Markery i flamastry', slug: 'markery-flamastry', sortOrder: 3 },
          { name: 'Korektory', slug: 'korektory', sortOrder: 4 },
          { name: 'Zakreślacze', slug: 'zakreslacze', sortOrder: 5 },
        ]
      },
      {
        name: 'Papier i zeszyty',
        slug: 'papier-zeszyty',
        icon: '📄',
        sortOrder: 2,
        subcategories: [
          { name: 'Papier ksero', slug: 'papier-ksero', sortOrder: 1 },
          { name: 'Zeszyty', slug: 'zeszyty', sortOrder: 2 },
          { name: 'Notesy', slug: 'notesy', sortOrder: 3 },
          { name: 'Bloki rysunkowe', slug: 'bloki-rysunkowe', sortOrder: 4 },
        ]
      },
      {
        name: 'Organizacja',
        slug: 'organizacja-biuro',
        icon: '📋',
        sortOrder: 3,
        subcategories: [
          { name: 'Segregatory', slug: 'segregatory', sortOrder: 1 },
          { name: 'Teczki', slug: 'teczki', sortOrder: 2 },
          { name: 'Organizery biurkowe', slug: 'organizery-biurkowe', sortOrder: 3 },
          { name: 'Kalendarze i plannery', slug: 'kalendarze-plannery', sortOrder: 4 },
          { name: 'Tablice i pinezki', slug: 'tablice-pinezki', sortOrder: 5 },
        ]
      },
      {
        name: 'Plecaki i tornistry',
        slug: 'plecaki-tornistry',
        icon: '🎒',
        sortOrder: 4,
        subcategories: [
          { name: 'Tornistry szkolne', slug: 'tornistry-szkolne', sortOrder: 1 },
          { name: 'Plecaki szkolne', slug: 'plecaki-szkolne', sortOrder: 2 },
          { name: 'Piórniki', slug: 'piorniki', sortOrder: 3 },
        ]
      },
    ]
  },
  {
    name: 'Smart Home',
    slug: 'smart-home',
    icon: '🏡',
    description: 'Inteligentne urządzenia do domu',
    sortOrder: 12,
    subcategories: [
      {
        name: 'Oświetlenie inteligentne',
        slug: 'oswietlenie-smart',
        icon: '💡',
        sortOrder: 1,
        subcategories: [
          { name: 'Żarówki smart', slug: 'zarowki-smart', sortOrder: 1 },
          { name: 'Taśmy LED smart', slug: 'tasmy-led-smart', sortOrder: 2 },
          { name: 'Przełączniki smart', slug: 'przelaczniki-smart', sortOrder: 3 },
        ]
      },
      {
        name: 'Bezpieczeństwo',
        slug: 'bezpieczenstwo-smart',
        icon: '🔒',
        sortOrder: 2,
        subcategories: [
          { name: 'Kamery IP', slug: 'kamery-ip', sortOrder: 1 },
          { name: 'Dzwonki wideo', slug: 'dzwonki-wideo', sortOrder: 2 },
          { name: 'Alarmy smart', slug: 'alarmy-smart', sortOrder: 3 },
          { name: 'Zamki smart', slug: 'zamki-smart', sortOrder: 4 },
          { name: 'Czujniki ruchu', slug: 'czujniki-ruchu', sortOrder: 5 },
        ]
      },
      {
        name: 'Klimatyzacja i ogrzewanie',
        slug: 'klimatyzacja-smart',
        icon: '🌡️',
        sortOrder: 3,
        subcategories: [
          { name: 'Termostaty smart', slug: 'termostaty-smart', sortOrder: 1 },
          { name: 'Czujniki temperatury', slug: 'czujniki-temperatury', sortOrder: 2 },
          { name: 'Nawilżacze smart', slug: 'nawilzacze-smart', sortOrder: 3 },
        ]
      },
      {
        name: 'Asystenci głosowi',
        slug: 'asystenci-glosowi',
        icon: '🔊',
        sortOrder: 4,
        subcategories: [
          { name: 'Amazon Echo', slug: 'amazon-echo', sortOrder: 1 },
          { name: 'Google Home', slug: 'google-home', sortOrder: 2 },
          { name: 'Apple HomePod', slug: 'apple-homepod', sortOrder: 3 },
        ]
      },
      {
        name: 'Gniazdka i sterowanie',
        slug: 'gniazdka-sterowanie',
        icon: '🔌',
        sortOrder: 5,
        subcategories: [
          { name: 'Gniazdka smart', slug: 'gniazdka-smart', sortOrder: 1 },
          { name: 'Listwy zasilające smart', slug: 'listwy-smart', sortOrder: 2 },
          { name: 'Piloty uniwersalne', slug: 'piloty-uniwersalne', sortOrder: 3 },
        ]
      },
    ]
  },
  {
    name: 'Elektronika noszona',
    slug: 'elektronika-noszona',
    icon: '⌚',
    description: 'Smartwatche, opaski, akcesoria wearables',
    sortOrder: 13,
    subcategories: [
      {
        name: 'Smartwatche',
        slug: 'smartwatche-wearables',
        icon: '⌚',
        sortOrder: 1,
        subcategories: [
          { name: 'Apple Watch', slug: 'apple-watch', sortOrder: 1 },
          { name: 'Samsung Galaxy Watch', slug: 'samsung-galaxy-watch', sortOrder: 2 },
          { name: 'Garmin', slug: 'garmin-smartwatch', sortOrder: 3 },
          { name: 'Xiaomi Watch', slug: 'xiaomi-watch', sortOrder: 4 },
          { name: 'Zegarki dla dzieci', slug: 'zegarki-dzieci', sortOrder: 5 },
        ]
      },
      {
        name: 'Opaski sportowe',
        slug: 'opaski-sportowe',
        icon: '🏃',
        sortOrder: 2,
        subcategories: [
          { name: 'Opaski fitness', slug: 'opaski-fitness', sortOrder: 1 },
          { name: 'Pulsometry', slug: 'pulsometry', sortOrder: 2 },
          { name: 'Opaski do biegania', slug: 'opaski-bieganie', sortOrder: 3 },
        ]
      },
      {
        name: 'Akcesoria do wearables',
        slug: 'akcesoria-wearables',
        icon: '🔗',
        sortOrder: 3,
        subcategories: [
          { name: 'Paski do zegarków', slug: 'paski-smartwatch', sortOrder: 1 },
          { name: 'Ładowarki do smartwatchy', slug: 'ladowarki-smartwatch', sortOrder: 2 },
          { name: 'Folie ochronne', slug: 'folie-smartwatch', sortOrder: 3 },
        ]
      },
    ]
  },
  {
    name: 'Hobby i rękodzieło',
    slug: 'hobby-rekodzilo',
    icon: '🎨',
    description: 'Modelarstwo, druk 3D, malarstwo, szycie',
    sortOrder: 14,
    subcategories: [
      {
        name: 'Modelarstwo',
        slug: 'modelarstwo',
        icon: '✈️',
        sortOrder: 1,
        subcategories: [
          { name: 'Modele samolotów', slug: 'modele-samolotow', sortOrder: 1 },
          { name: 'Modele samochodów', slug: 'modele-samochodow', sortOrder: 2 },
          { name: 'Modele statków', slug: 'modele-statkow', sortOrder: 3 },
          { name: 'Kleje i farby modelarskie', slug: 'kleje-farby-modelarskie', sortOrder: 4 },
        ]
      },
      {
        name: 'Druk 3D',
        slug: 'druk-3d',
        icon: '🖨️',
        sortOrder: 2,
        subcategories: [
          { name: 'Drukarki 3D', slug: 'drukarki-3d', sortOrder: 1 },
          { name: 'Filamenty PLA', slug: 'filamenty-pla', sortOrder: 2 },
          { name: 'Filamenty ABS', slug: 'filamenty-abs', sortOrder: 3 },
          { name: 'Żywice do druku', slug: 'zywice-druk', sortOrder: 4 },
        ]
      },
      {
        name: 'Malarstwo i rysowanie',
        slug: 'malarstwo-rysowanie',
        icon: '🎨',
        sortOrder: 3,
        subcategories: [
          { name: 'Farby akrylowe', slug: 'farby-akrylowe', sortOrder: 1 },
          { name: 'Farby olejne', slug: 'farby-olejne', sortOrder: 2 },
          { name: 'Pędzle', slug: 'pedzle', sortOrder: 3 },
          { name: 'Płótna malarskie', slug: 'plotna-malarskie', sortOrder: 4 },
          { name: 'Kredki i pastele', slug: 'kredki-pastele', sortOrder: 5 },
        ]
      },
      {
        name: 'Szycie i dziewiarstwo',
        slug: 'szycie-dziewiarstwo',
        icon: '🧵',
        sortOrder: 4,
        subcategories: [
          { name: 'Maszyny do szycia', slug: 'maszyny-szycia', sortOrder: 1 },
          { name: 'Nici i igły', slug: 'nici-igly', sortOrder: 2 },
          { name: 'Tkaniny', slug: 'tkaniny', sortOrder: 3 },
          { name: 'Druty i szydełka', slug: 'druty-szydelka', sortOrder: 4 },
          { name: 'Włóczki', slug: 'wloczki', sortOrder: 5 },
        ]
      },
      {
        name: 'Elektronika DIY',
        slug: 'elektronika-diy',
        icon: '🔧',
        sortOrder: 5,
        subcategories: [
          { name: 'Arduino', slug: 'arduino', sortOrder: 1 },
          { name: 'Raspberry Pi', slug: 'raspberry-pi', sortOrder: 2 },
          { name: 'Zestawy elektroniczne', slug: 'zestawy-elektroniczne', sortOrder: 3 },
          { name: 'Lutownice', slug: 'lutownice', sortOrder: 4 },
          { name: 'Multimetry', slug: 'multimetry', sortOrder: 5 },
        ]
      },
    ]
  },
  {
    name: 'Narzędzia i przemysł',
    slug: 'narzedzia-przemysl',
    icon: '🔧',
    description: 'Elektronarzędzia, BHP, osprzęt przemysłowy',
    sortOrder: 15,
    subcategories: [
      {
        name: 'Elektronarzędzia',
        slug: 'elektronarzedzia',
        icon: '⚙️',
        sortOrder: 1,
        subcategories: [
          { name: 'Wiertarko-wkrętarki', slug: 'wiertarko-wkretarki', sortOrder: 1 },
          { name: 'Młoty udarowe', slug: 'mloty-udarowe', sortOrder: 2 },
          { name: 'Szlifierki kątowe', slug: 'szlifierki-katowe', sortOrder: 3 },
          { name: 'Piły tarczowe', slug: 'pily-tarczowe', sortOrder: 4 },
          { name: 'Frezarki', slug: 'frezarki', sortOrder: 5 },
          { name: 'Strugarki', slug: 'strugarki', sortOrder: 6 },
        ]
      },
      {
        name: 'Osprzęt narzędziowy',
        slug: 'osprzet-narzedzia',
        icon: '🔩',
        sortOrder: 2,
        subcategories: [
          { name: 'Wiertła', slug: 'wiertla', sortOrder: 1 },
          { name: 'Bity i nasadki', slug: 'bity-nasadki', sortOrder: 2 },
          { name: 'Tarcze ścierne', slug: 'tarcze-scierne', sortOrder: 3 },
          { name: 'Tarcze do piły', slug: 'tarcze-pily', sortOrder: 4 },
        ]
      },
      {
        name: 'BHP i ochrona',
        slug: 'bhp-ochrona',
        icon: '🦺',
        sortOrder: 3,
        subcategories: [
          { name: 'Kaski ochronne', slug: 'kaski-ochronne', sortOrder: 1 },
          { name: 'Okulary ochronne', slug: 'okulary-ochronne', sortOrder: 2 },
          { name: 'Rękawice robocze', slug: 'rekawice-robocze', sortOrder: 3 },
          { name: 'Maseczki i respiratory', slug: 'maseczki-respiratory', sortOrder: 4 },
          { name: 'Buty robocze', slug: 'buty-robocze', sortOrder: 5 },
        ]
      },
      {
        name: 'Spawanie i lutowanie',
        slug: 'spawanie-lutowanie',
        icon: '🔥',
        sortOrder: 4,
        subcategories: [
          { name: 'Spawarki', slug: 'spawarki', sortOrder: 1 },
          { name: 'Elektrody', slug: 'elektrody', sortOrder: 2 },
          { name: 'Maski spawalnicze', slug: 'maski-spawalnicze', sortOrder: 3 },
          { name: 'Palniki', slug: 'palniki', sortOrder: 4 },
        ]
      },
      {
        name: 'Pomiary i poziomy',
        slug: 'pomiary-poziomy',
        icon: '📏',
        sortOrder: 5,
        subcategories: [
          { name: 'Poziomica laserowe', slug: 'poziomica-laserowe', sortOrder: 1 },
          { name: 'Dalmierze', slug: 'dalmierze', sortOrder: 2 },
          { name: 'Mierniki laserowe', slug: 'mierniki-laserowe', sortOrder: 3 },
          { name: 'Taśmy miernicze', slug: 'tasmy-miernicze', sortOrder: 4 },
        ]
      },
    ]
  },
];

export default CATEGORY_SEEDS;