/**
 * Rozbudowana struktura kategorii dla Okazje Plus
 * Inspirowana pepper.pl i AliExpress - kompletna hierarchia 3-poziomowa
 * Z pełnymi tłumaczeniami: PL, EN, DE
 */

import { Category, Subcategory, SubSubcategory } from './types';

// Helper: Dodaj tłumaczenia do SubSubcategory
const withTranslations = (
  subsub: { name: string; slug: string; sortOrder?: number; icon?: string; color?: string; importKeywords?: string[]; aliexpressCategoryIds?: string[] },
  en: string,
  de: string
): SubSubcategory => ({
  ...subsub,
  // Auto-populate importKeywords from English name if not provided
  // This ensures all subcategories have English search terms for AliExpress/APIs
  importKeywords: subsub.importKeywords || [en],
  aliexpressCategoryIds: subsub.aliexpressCategoryIds || [],
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
          withTranslations({ name: 'Smartfony', slug: 'smartfony', sortOrder: 1, aliexpressCategoryIds: ['509'] }, 'Smartphones', 'Smartphones'),
          withTranslations({ name: 'iPhone', slug: 'iphone', sortOrder: 2, aliexpressCategoryIds: ['509'] }, 'iPhone', 'iPhone'),
          withTranslations({ name: 'Samsung Galaxy', slug: 'samsung-galaxy', sortOrder: 3, aliexpressCategoryIds: ['509'] }, 'Samsung Galaxy', 'Samsung Galaxy'),
          withTranslations({ name: 'Xiaomi', slug: 'xiaomi-smartfony', sortOrder: 4, aliexpressCategoryIds: ['509'] }, 'Xiaomi', 'Xiaomi'),
          withTranslations({ name: 'Huawei', slug: 'huawei-smartfony', sortOrder: 5, aliexpressCategoryIds: ['509'] }, 'Huawei', 'Huawei'),
          withTranslations({ name: 'Oppo', slug: 'oppo', sortOrder: 6, aliexpressCategoryIds: ['509'] }, 'Oppo', 'Oppo'),
          withTranslations({ name: 'Realme', slug: 'realme', sortOrder: 7, aliexpressCategoryIds: ['509'] }, 'Realme', 'Realme'),
          withTranslations({ name: 'Telefony klasyczne', slug: 'telefony-klasyczne', sortOrder: 2 }, 'Classic phones', 'Klassische Telefone'),
          withTranslations({ name: 'Akcesoria GSM', slug: 'akcesoria-gsm', sortOrder: 3, aliexpressCategoryIds: ['509'] }, 'GSM accessories', 'GSM-Zubehör'),
          withTranslations({ name: 'Etui i pokrowce', slug: 'etui-pokrowce', sortOrder: 4, aliexpressCategoryIds: ['509'] }, 'Cases and covers', 'Hüllen und Taschen'),
          withTranslations({ name: 'Ładowarki i kable', slug: 'ladowarki-kable', sortOrder: 5, aliexpressCategoryIds: ['509'] }, 'Chargers and cables', 'Ladegeräte und Kabel'),
          withTranslations({ name: 'Ładowarki bezprzewodowe', slug: 'ladowarki-bezprzewodowe', sortOrder: 6, aliexpressCategoryIds: ['509'] }, 'Wireless chargers', 'Wireless Ladegeräte'),
          withTranslations({ name: 'Kable USB-C', slug: 'kable-usb-c', sortOrder: 7, aliexpressCategoryIds: ['509'] }, 'USB-C cables', 'USB-C Kabel'),
          withTranslations({ name: 'Kable Lightning', slug: 'kable-lightning', sortOrder: 8, aliexpressCategoryIds: ['509'] }, 'Lightning cables', 'Lightning Kabel'),
          withTranslations({ name: 'Power banki', slug: 'power-banki', sortOrder: 6, aliexpressCategoryIds: ['509'] }, 'Power banks', 'Powerbanks'),
          withTranslations({ name: 'Folie i szkła ochronne', slug: 'folie-szkla', sortOrder: 7, aliexpressCategoryIds: ['509'] }, 'Screen protectors', 'Schutzfolien und Glas'),
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
          withTranslations({ name: 'Laptopy', slug: 'laptopy', sortOrder: 1, aliexpressCategoryIds: ['7'] }, 'Laptops', 'Laptops'),
          withTranslations({ name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne', sortOrder: 2, aliexpressCategoryIds: ['7'] }, 'Desktop computers', 'Desktops'),
          withTranslations({ name: 'Monitory', slug: 'monitory', sortOrder: 3, aliexpressCategoryIds: ['7'] }, 'Monitors', 'Monitore'),
          withTranslations({ name: 'Dyski twarde i SSD', slug: 'dyski-ssd', sortOrder: 4, aliexpressCategoryIds: ['7'] }, 'Hard drives and SSD', 'Festplatten und SSDs'),
          withTranslations({ name: 'Karty graficzne', slug: 'karty-graficzne', sortOrder: 5, aliexpressCategoryIds: ['7'] }, 'Graphics cards', 'Grafikkarten'),
          withTranslations({ name: 'Procesory', slug: 'procesory', sortOrder: 6, aliexpressCategoryIds: ['7'] }, 'Processors', 'Prozessoren'),
          withTranslations({ name: 'Płyty główne', slug: 'plyty-glowne', sortOrder: 7, aliexpressCategoryIds: ['7'] }, 'Motherboards', 'Motherboards'),
          withTranslations({ name: 'Pamięci RAM', slug: 'pamieci-ram', sortOrder: 8, aliexpressCategoryIds: ['7'] }, 'RAM memory', 'RAM-Speicher'),
          withTranslations({ name: 'Obudowy PC', slug: 'obudowy-pc', sortOrder: 9, aliexpressCategoryIds: ['7'] }, 'PC cases', 'PC-Gehäuse'),
          withTranslations({ name: 'Zasilacze', slug: 'zasilacze', sortOrder: 10, aliexpressCategoryIds: ['7'] }, 'Power supplies', 'Stromversorgungen'),
          withTranslations({ name: 'Chłodzenie PC', slug: 'chlodzenie-pc', sortOrder: 11, aliexpressCategoryIds: ['7'] }, 'PC cooling', 'PC-Kühlung'),
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

  withCatTranslations({
    name: 'Dom i ogród',
    slug: 'dom-ogrod',
    icon: '🏠',
    description: 'Meble, wyposażenie wnętrz, narzędzia i ogród',
    sortOrder: 2,
    subcategories: [
      withSubTranslations({
        name: 'Meble',
        slug: 'meble',
        icon: '🛋️',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Sofy i kanapy', slug: 'sofy-kanapy', sortOrder: 1 }, 'Sofas and couches', 'Sofas und Couches'),
          withTranslations({ name: 'Fotele', slug: 'fotele', sortOrder: 2 }, 'Armchairs', 'Sessel'),
          withTranslations({ name: 'Stoły', slug: 'stoly', sortOrder: 3 }, 'Tables', 'Tische'),
          withTranslations({ name: 'Krzesła', slug: 'krzesla', sortOrder: 4 }, 'Chairs', 'Stühle'),
          withTranslations({ name: 'Szafy i komody', slug: 'szafy-komody', sortOrder: 5 }, 'Wardrobes and dressers', 'Schränke und Kommoden'),
          withTranslations({ name: 'Biurka', slug: 'biurka', sortOrder: 6 }, 'Desks', 'Schreibtische'),
          withTranslations({ name: 'Regały i półki', slug: 'regaly-polki', sortOrder: 7 }, 'Shelves and bookcases', 'Regale und Bücherregale'),
          withTranslations({ name: 'Meble ogrodowe', slug: 'meble-ogrodowe', sortOrder: 8 }, 'Garden furniture', 'Gartenmöbel'),
        ]
      }, 'Furniture', 'Möbel'),

      withSubTranslations({
        name: 'Oświetlenie',
        slug: 'oswietlenie',
        icon: '💡',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Lampy wiszące', slug: 'lampy-wiszace', sortOrder: 1 }, 'Pendant lamps', 'Hängeleuchten'),
          withTranslations({ name: 'Lampy stołowe', slug: 'lampy-stolowe', sortOrder: 2 }, 'Table lamps', 'Tischlampen'),
          withTranslations({ name: 'Lampy stojące', slug: 'lampy-stojace', sortOrder: 3 }, 'Floor lamps', 'Stehlampen'),
          withTranslations({ name: 'Kinkiety', slug: 'kinkiety', sortOrder: 4 }, 'Wall lamps', 'Wandleuchten'),
          withTranslations({ name: 'Żarówki LED', slug: 'zarowki-led', sortOrder: 5 }, 'LED bulbs', 'LED-Lampen'),
          withTranslations({ name: 'Oświetlenie smart', slug: 'oswietlenie-smart', sortOrder: 6 }, 'Smart lighting', 'Smart-Beleuchtung'),
          withTranslations({ name: 'Oświetlenie ogrodowe', slug: 'oswietlenie-ogrodowe', sortOrder: 7 }, 'Garden lighting', 'Gartenbeleuchtung'),
        ]
      }, 'Lighting', 'Beleuchtung'),

      withSubTranslations({
        name: 'Dekoracje',
        slug: 'dekoracje',
        icon: '🎨',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Obrazy i plakaty', slug: 'obrazy-plakaty', sortOrder: 1 }, 'Wall art and posters', 'Bilder und Poster'),
          withTranslations({ name: 'Ramki', slug: 'ramki', sortOrder: 2 }, 'Frames', 'Bilderrahmen'),
          withTranslations({ name: 'Zegary', slug: 'zegary', sortOrder: 3 }, 'Clocks', 'Uhren'),
          withTranslations({ name: 'Wazony', slug: 'wazony', sortOrder: 4 }, 'Vases', 'Vasen'),
          withTranslations({ name: 'Świeczki', slug: 'swieczki', sortOrder: 5 }, 'Candles', 'Kerzen'),
          withTranslations({ name: 'Poduszki dekoracyjne', slug: 'poduszki-dekoracyjne', sortOrder: 6 }, 'Decorative pillows', 'Dekokissen'),
          withTranslations({ name: 'Dywany', slug: 'dywany', sortOrder: 7 }, 'Rugs', 'Teppiche'),
        ]
      }, 'Decor', 'Deko'),

      withSubTranslations({
        name: 'AGD małe',
        slug: 'agd-male',
        icon: '☕',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Ekspresy do kawy', slug: 'ekspresy-kawy', sortOrder: 1 }, 'Coffee makers', 'Kaffeemaschinen'),
          withTranslations({ name: 'Czajniki', slug: 'czajniki', sortOrder: 2 }, 'Kettles', 'Wasserkocher'),
          withTranslations({ name: 'Tostery', slug: 'tostery', sortOrder: 3 }, 'Toasters', 'Toaster'),
          withTranslations({ name: 'Blendery', slug: 'blendery', sortOrder: 4 }, 'Blenders', 'Mixer'),
          withTranslations({ name: 'Roboty kuchenne', slug: 'roboty-kuchenne', sortOrder: 5 }, 'Food processors', 'Küchenmaschinen'),
          withTranslations({ name: 'Mikrofale', slug: 'mikrofale', sortOrder: 6 }, 'Microwaves', 'Mikrowellen'),
          withTranslations({ name: 'Frytkownice', slug: 'frytkownice', sortOrder: 7 }, 'Deep fryers', 'Fritteusen'),
          withTranslations({ name: 'Sokowirówki', slug: 'sokownirowki', sortOrder: 8 }, 'Juicers', 'Entsafter'),
          withTranslations({ name: 'Miksery', slug: 'miksery', sortOrder: 9 }, 'Mixers', 'Mixer'),
          withTranslations({ name: 'Grille elektryczne', slug: 'grille-elektryczne', sortOrder: 10 }, 'Electric grills', 'Elektrogrills'),
          withTranslations({ name: 'Odkurzacze', slug: 'odkurzacze', sortOrder: 11 }, 'Vacuum cleaners', 'Staubsauger'),
          withTranslations({ name: 'Roboty sprzątające', slug: 'roboty-sprzatajace', sortOrder: 12, importKeywords: ['robot vacuum', 'robot mop', 'vacuum cleaner robot'] }, 'Robot vacuums', 'Saugroboter'),
        ]
      }, 'Small appliances', 'Kleine Haushaltsgeräte'),

      withSubTranslations({
        name: 'AGD duże',
        slug: 'agd-duze',
        icon: '🔧',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Pralki', slug: 'pralki', sortOrder: 1 }, 'Washing machines', 'Waschmaschinen'),
          withTranslations({ name: 'Suszarki', slug: 'suszarki', sortOrder: 2 }, 'Dryers', 'Trockner'),
          withTranslations({ name: 'Lodówki', slug: 'lodowki', sortOrder: 3 }, 'Fridges', 'Kühlschränke'),
          withTranslations({ name: 'Zamrażarki', slug: 'zamrazarki', sortOrder: 4 }, 'Freezers', 'Gefriergeräte'),
          withTranslations({ name: 'Zmywarki', slug: 'zmywarki', sortOrder: 5 }, 'Dishwashers', 'Geschirrspüler'),
          withTranslations({ name: 'Kuchnie gazowe i elektryczne', slug: 'kuchnie', sortOrder: 6 }, 'Cookers', 'Herde'),
          withTranslations({ name: 'Piekarniki', slug: 'piekarniki', sortOrder: 7 }, 'Ovens', 'Backöfen'),
          withTranslations({ name: 'Okapy', slug: 'okapy', sortOrder: 8 }, 'Hoods', 'Dunstabzugshauben'),
        ]
      }, 'Large appliances', 'Großgeräte'),

      withSubTranslations({
        name: 'Ogród i narzędzia',
        slug: 'ogrod-narzedzia',
        icon: '🌱',
        sortOrder: 6,
        subcategories: [
          withTranslations({ name: 'Kosiarki', slug: 'kosiarki', sortOrder: 1 }, 'Lawn mowers', 'Rasenmäher'),
          withTranslations({ name: 'Podkaszarki', slug: 'podkaszarki', sortOrder: 2 }, 'Trimmers', 'Trimmer'),
          withTranslations({ name: 'Nożyce do żywopłotu', slug: 'nozyce-zywoplotu', sortOrder: 3 }, 'Hedge trimmers', 'Heckenscheren'),
          withTranslations({ name: 'Piły łańcuchowe', slug: 'pily-lancuchowe', sortOrder: 4 }, 'Chainsaws', 'Kettensägen'),
          withTranslations({ name: 'Dmuchawy', slug: 'dmuchawy', sortOrder: 5 }, 'Leaf blowers', 'Laubbläser'),
          withTranslations({ name: 'Systemy nawadniania', slug: 'nawadnianie', sortOrder: 6 }, 'Irrigation systems', 'Bewässerungssysteme'),
          withTranslations({ name: 'Donice i osłonki', slug: 'donice-oslonki', sortOrder: 7 }, 'Pots and planters', 'Töpfe und Übertöpfe'),
          withTranslations({ name: 'Narzędzia ręczne', slug: 'narzedzia-reczne', sortOrder: 8 }, 'Hand tools', 'Handwerkzeuge'),
        ]
      }, 'Garden and tools', 'Garten und Werkzeuge'),
    ]
  },
  'Home and Garden',
  'Furniture, interior accessories, tools and garden',
  'Haus und Garten',
  'Möbel, Innenausstattung, Werkzeuge und Garten'
  ),

  withCatTranslations({
    name: 'Moda i uroda',
    slug: 'moda-uroda',
    icon: '👗',
    description: 'Odzież, obuwie, akcesoria i kosmetyki',
    sortOrder: 3,
    subcategories: [
      withSubTranslations({
        name: 'Odzież damska',
        slug: 'odziez-damska',
        icon: '👚',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Sukienki', slug: 'sukienki', sortOrder: 1 }, 'Dresses', 'Kleider'),
          withTranslations({ name: 'Bluzki i koszule', slug: 'bluzki-koszule-damskie', sortOrder: 2 }, 'Blouses and shirts', 'Blusen und Hemden'),
          withTranslations({ name: 'Spodnie damskie', slug: 'spodnie-damskie', sortOrder: 3 }, 'Women trousers', 'Dam Hosen'),
          withTranslations({ name: 'Spódnice', slug: 'spodnice', sortOrder: 4 }, 'Skirts', 'Röcke'),
          withTranslations({ name: 'Płaszcze i kurtki damskie', slug: 'plaszcze-kurtki-damskie', sortOrder: 5 }, 'Coats and jackets', 'Mäntel und Jacken'),
          withTranslations({ name: 'Swetry damskie', slug: 'swetry-damskie', sortOrder: 6 }, 'Sweaters', 'Pullover'),
          withTranslations({ name: 'Bielizna damska', slug: 'bielizna-damska', sortOrder: 7 }, 'Lingerie', 'Damenunterwäsche'),
        ]
      }, 'Women clothing', 'Damenbekleidung'),

      withSubTranslations({
        name: 'Odzież męska',
        slug: 'odziez-meska',
        icon: '👔',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Koszule męskie', slug: 'koszule-meskie', sortOrder: 1 }, 'Men shirts', 'Herrenhemden'),
          withTranslations({ name: 'T-shirty męskie', slug: 'tshirty-meskie', sortOrder: 2 }, 'Men t-shirts', 'Herren-T-Shirts'),
          withTranslations({ name: 'Spodnie męskie', slug: 'spodnie-meskie', sortOrder: 3 }, 'Men trousers', 'Herrenhosen'),
          withTranslations({ name: 'Kurtki męskie', slug: 'kurtki-meskie', sortOrder: 4 }, 'Men jackets', 'Herrenjacken'),
          withTranslations({ name: 'Swetry męskie', slug: 'swetry-meskie', sortOrder: 5 }, 'Men sweaters', 'Herrenpullover'),
          withTranslations({ name: 'Garnitury', slug: 'garnitury', sortOrder: 6 }, 'Suits', 'Anzüge'),
          withTranslations({ name: 'Bielizna męska', slug: 'bielizna-meska', sortOrder: 7 }, 'Men underwear', 'Herrenunterwäsche'),
        ]
      }, 'Men clothing', 'Herrenbekleidung'),

      withSubTranslations({
        name: 'Obuwie',
        slug: 'obuwie',
        icon: '👟',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Buty sportowe', slug: 'buty-sportowe', sortOrder: 1 }, 'Sports shoes', 'Sportschuhe'),
          withTranslations({ name: 'Buty casualowe', slug: 'buty-casual', sortOrder: 2 }, 'Casual shoes', 'Freizeitschuhe'),
          withTranslations({ name: 'Sandały', slug: 'sandaly', sortOrder: 3 }, 'Sandals', 'Sandalen'),
          withTranslations({ name: 'Klapki', slug: 'klapki', sortOrder: 4 }, 'Flip flops', 'Hausschuhe'),
          withTranslations({ name: 'Kozaki', slug: 'kozaki', sortOrder: 5 }, 'Boots', 'Stiefel'),
          withTranslations({ name: 'Szpilki', slug: 'szpilki', sortOrder: 6 }, 'High heels', 'High Heels'),
          withTranslations({ name: 'Trapery', slug: 'trapery', sortOrder: 7 }, 'Hiking boots', 'Wanderschuhe'),
        ]
      }, 'Footwear', 'Schuhe'),

      withSubTranslations({
        name: 'Torebki i plecaki',
        slug: 'torebki-plecaki',
        icon: '👜',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Torebki damskie', slug: 'torebki-damskie', sortOrder: 1 }, 'Women handbags', 'Damenhandtaschen'),
          withTranslations({ name: 'Plecaki', slug: 'plecaki', sortOrder: 2 }, 'Backpacks', 'Rucksäcke'),
          withTranslations({ name: 'Torby podróżne', slug: 'torby-podrozne', sortOrder: 3 }, 'Travel bags', 'Reisetaschen'),
          withTranslations({ name: 'Walizki', slug: 'walizki', sortOrder: 4 }, 'Suitcases', 'Koffer'),
          withTranslations({ name: 'Saszetki i nerki', slug: 'saszetki-nerki', sortOrder: 5 }, 'Waist bags', 'Bauchtaschen'),
        ]
      }, 'Bags and backpacks', 'Taschen und Rucksäcke'),

      withSubTranslations({
        name: 'Biżuteria i zegarki',
        slug: 'bizuteria-zegarki',
        icon: '⌚',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Zegarki damskie', slug: 'zegarki-damskie', sortOrder: 1 }, 'Women watches', 'Damenuhren'),
          withTranslations({ name: 'Zegarki męskie', slug: 'zegarki-meskie', sortOrder: 2 }, 'Men watches', 'Herrenuhren'),
          withTranslations({ name: 'Smartwatche', slug: 'smartwatche', sortOrder: 3 }, 'Smartwatches', 'Smartwatches'),
          withTranslations({ name: 'Biżuteria', slug: 'bizuteria', sortOrder: 4 }, 'Jewelry', 'Schmuck'),
          withTranslations({ name: 'Bransoletki', slug: 'bransoletki', sortOrder: 5 }, 'Bracelets', 'Armbänder'),
          withTranslations({ name: 'Naszyjniki', slug: 'naszyjniki', sortOrder: 6 }, 'Necklaces', 'Halsketten'),
        ]
      }, 'Jewelry and watches', 'Schmuck und Uhren'),

      withSubTranslations({
        name: 'Kosmetyki',
        slug: 'kosmetyki',
        icon: '💄',
        sortOrder: 6,
        subcategories: [
          withTranslations({ name: 'Makijaż', slug: 'makijaz', sortOrder: 1 }, 'Makeup', 'Make-up'),
          withTranslations({ name: 'Pielęgnacja twarzy', slug: 'pielegnacja-twarzy', sortOrder: 2 }, 'Face care', 'Gesichtspflege'),
          withTranslations({ name: 'Pielęgnacja włosów', slug: 'pielegnacja-wlosow', sortOrder: 3 }, 'Hair care', 'Haarpflege'),
          withTranslations({ name: 'Pielęgnacja ciała', slug: 'pielegnacja-ciala', sortOrder: 4 }, 'Body care', 'Körperpflege'),
          withTranslations({ name: 'Perfumy', slug: 'perfumy', sortOrder: 5 }, 'Perfumes', 'Parfums'),
          withTranslations({ name: 'Akcesoria kosmetyczne', slug: 'akcesoria-kosmetyczne', sortOrder: 6 }, 'Cosmetic accessories', 'Kosmetikzubehör'),
        ]
      }, 'Cosmetics', 'Kosmetik'),

      withSubTranslations({
        name: 'Włosy i barber',
        slug: 'wlosy-barber',
        icon: '💇',
        sortOrder: 7,
        subcategories: [
          withTranslations({ name: 'Peruki i doczepy', slug: 'peruki-doczepy', sortOrder: 1, importKeywords: ['wigs', 'hair extensions', 'lace wig'] }, 'Wigs and extensions', 'Perücken und Extensions'),
          withTranslations({ name: 'Trymery i maszynki', slug: 'trymery-maszynki', sortOrder: 2 }, 'Trimmers and clippers', 'Trimmer und Haarschneider'),
          withTranslations({ name: 'Produkty do stylizacji', slug: 'stylizacja-wlosow', sortOrder: 3 }, 'Hair styling products', 'Haarstyling-Produkte'),
          withTranslations({ name: 'Akcesoria fryzjerskie', slug: 'akcesoria-fryzjerskie', sortOrder: 4 }, 'Hairdressing accessories', 'Friseurzubehör'),
        ]
      }, 'Hair and barber', 'Haare und Barber'),
    ]
  },
  'Fashion and Beauty',
  'Clothing, footwear, accessories and cosmetics',
  'Mode und Schönheit',
  'Kleidung, Schuhe, Accessoires und Kosmetik'
  ),

  withCatTranslations({
    name: 'Sport i rekreacja',
    slug: 'sport-rekreacja',
    icon: '⚽',
    description: 'Sprzęt sportowy, fitness, turystyka i outdoor',
    sortOrder: 4,
    subcategories: [
      withSubTranslations({
        name: 'Fitness i siłownia',
        slug: 'fitness-silownia',
        icon: '🏋️',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Bieżnie', slug: 'bieznie', sortOrder: 1 }, 'Treadmills', 'Laufbänder'),
          withTranslations({ name: 'Rowery treningowe', slug: 'rowery-treningowe', sortOrder: 2 }, 'Exercise bikes', 'Heimtrainer'),
          withTranslations({ name: 'Orbitreki', slug: 'orbitreki', sortOrder: 3 }, 'Ellipticals', 'Crosstrainer'),
          withTranslations({ name: 'Zestawy siłowni domowej', slug: 'silownia-domowa', sortOrder: 4 }, 'Home gym sets', 'Home-Gym-Sets'),
          withTranslations({ name: 'Hantle i obciążenia', slug: 'hantle-obciazenia', sortOrder: 5 }, 'Dumbbells and weights', 'Hanteln und Gewichte'),
          withTranslations({ name: 'Maty fitness', slug: 'maty-fitness', sortOrder: 6 }, 'Fitness mats', 'Fitnessmatten'),
          withTranslations({ name: 'Ekspandery i gumy', slug: 'ekspandery-gumy', sortOrder: 7 }, 'Bands and expanders', 'Expander und Bänder'),
        ]
      }, 'Fitness and gym', 'Fitness und Studio'),

      withSubTranslations({
        name: 'Rowery',
        slug: 'rowery',
        icon: '🚴',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Rowery górskie', slug: 'rowery-gorskie', sortOrder: 1 }, 'MTB bikes', 'Mountainbikes'),
          withTranslations({ name: 'Rowery miejskie', slug: 'rowery-miejskie', sortOrder: 2 }, 'City bikes', 'Citybikes'),
          withTranslations({ name: 'Rowery szosowe', slug: 'rowery-szosowe', sortOrder: 3 }, 'Road bikes', 'Rennräder'),
          withTranslations({ name: 'Rowery elektryczne', slug: 'rowery-elektryczne', sortOrder: 4 }, 'E-bikes', 'E-Bikes'),
          withTranslations({ name: 'Hulajnogi elektryczne', slug: 'hulajnogi-elektryczne', sortOrder: 5 }, 'Electric scooters', 'E-Scooter'),
          withTranslations({ name: 'Akcesoria rowerowe', slug: 'akcesoria-rowerowe', sortOrder: 6 }, 'Bike accessories', 'Fahrradzubehör'),
        ]
      }, 'Bikes', 'Fahrräder'),

      withSubTranslations({
        name: 'Turystyka i camping',
        slug: 'turystyka-camping',
        icon: '⛺',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Namioty', slug: 'namioty', sortOrder: 1 }, 'Tents', 'Zelte'),
          withTranslations({ name: 'Śpiwory', slug: 'spiwory', sortOrder: 2 }, 'Sleeping bags', 'Schlafsäcke'),
          withTranslations({ name: 'Karimaty', slug: 'karimaty', sortOrder: 3 }, 'Sleeping pads', 'Isomatten'),
          withTranslations({ name: 'Plecaki turystyczne', slug: 'plecaki-turystyczne', sortOrder: 4 }, 'Hiking backpacks', 'Wanderrucksäcke'),
          withTranslations({ name: 'Latarki i czołówki', slug: 'latarki-czolowki', sortOrder: 5 }, 'Flashlights and headlamps', 'Taschen- und Stirnlampen'),
          withTranslations({ name: 'Kuchenki turystyczne', slug: 'kuchenki-turystyczne', sortOrder: 6 }, 'Camping stoves', 'Campingkocher'),
          withTranslations({ name: 'Termosy', slug: 'termosy', sortOrder: 7 }, 'Thermoses', 'Thermoskannen'),
        ]
      }, 'Trekking and camping', 'Trekking und Camping'),

      withSubTranslations({
        name: 'Sporty wodne',
        slug: 'sporty-wodne',
        icon: '🏊',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Kajaki', slug: 'kajaki', sortOrder: 1 }, 'Kayaks', 'Kajaks'),
          withTranslations({ name: 'SUP-y', slug: 'sup-deski', sortOrder: 2 }, 'SUP boards', 'SUP-Boards'),
          withTranslations({ name: 'Kombinezony neoprenowe', slug: 'kombinezony-neoprenowe', sortOrder: 3 }, 'Wetsuits', 'Neoprenanzüge'),
          withTranslations({ name: 'Kamizelki ratunkowe', slug: 'kamizelki-ratunkowe', sortOrder: 4 }, 'Life jackets', 'Rettungswesten'),
          withTranslations({ name: 'Gogle pływackie', slug: 'gogle-plywackie', sortOrder: 5 }, 'Goggles', 'Schwimmbrillen'),
        ]
      }, 'Water sports', 'Wassersport'),

      withSubTranslations({
        name: 'Sporty zimowe',
        slug: 'sporty-zimowe',
        icon: '⛷️',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Narty', slug: 'narty', sortOrder: 1 }, 'Skis', 'Ski'),
          withTranslations({ name: 'Snowboardy', slug: 'snowboardy', sortOrder: 2 }, 'Snowboards', 'Snowboards'),
          withTranslations({ name: 'Wiązania', slug: 'wiazania', sortOrder: 3 }, 'Bindings', 'Bindungen'),
          withTranslations({ name: 'Buty narciarskie', slug: 'buty-narciarskie', sortOrder: 4 }, 'Ski boots', 'Skischuhe'),
          withTranslations({ name: 'Kaski', slug: 'kaski-narciarskie', sortOrder: 5 }, 'Helmets', 'Helme'),
          withTranslations({ name: 'Gogle narciarskie', slug: 'gogle-narciarskie', sortOrder: 6 }, 'Goggles', 'Skibrillen'),
        ]
      }, 'Winter sports', 'Wintersport'),
    ]
  },
  'Sports and Recreation',
  'Sports gear, fitness, trekking and outdoor',
  'Sport und Freizeit',
  'Sportausrüstung, Fitness, Trekking und Outdoor'
  ),

  withCatTranslations({
    name: 'Zdrowie i uroda',
    slug: 'zdrowie-uroda',
    icon: '💊',
    description: 'Suplementy, zdrowie, urządzenia medyczne',
    sortOrder: 5,
    subcategories: [
      withSubTranslations({
        name: 'Suplementy diety',
        slug: 'suplementy-diety',
        icon: '💊',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Witaminy', slug: 'witaminy', sortOrder: 1 }, 'Vitamins', 'Vitamine'),
          withTranslations({ name: 'Minerały', slug: 'mineraly', sortOrder: 2 }, 'Minerals', 'Mineralien'),
          withTranslations({ name: 'Proteiny', slug: 'proteiny', sortOrder: 3 }, 'Proteins', 'Proteine'),
          withTranslations({ name: 'Aminokwasy', slug: 'aminokwasy', sortOrder: 4 }, 'Amino acids', 'Aminosäuren'),
          withTranslations({ name: 'Kreatyna', slug: 'kreatyna', sortOrder: 5 }, 'Creatine', 'Kreatin'),
          withTranslations({ name: 'Omega-3', slug: 'omega3', sortOrder: 6 }, 'Omega-3', 'Omega-3'),
        ]
      }, 'Diet supplements', 'Nahrungsergänzung'),

      withSubTranslations({
        name: 'Sprzęt medyczny',
        slug: 'sprzet-medyczny',
        icon: '🩺',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Ciśnieniomierze', slug: 'cisnieniomierze', sortOrder: 1 }, 'Blood pressure monitors', 'Blutdruckmessgeräte'),
          withTranslations({ name: 'Termometry', slug: 'termometry', sortOrder: 2 }, 'Thermometers', 'Thermometer'),
          withTranslations({ name: 'Pulsoksymetry', slug: 'pulsoksymetry', sortOrder: 3 }, 'Pulse oximeters', 'Pulsoximeter'),
          withTranslations({ name: 'Glukometry', slug: 'glukometry', sortOrder: 4 }, 'Glucometers', 'Blutzuckermessgeräte'),
          withTranslations({ name: 'Inhalatory', slug: 'inhalatory', sortOrder: 5 }, 'Inhalers', 'Inhalatoren'),
        ]
      }, 'Medical devices', 'Medizinische Geräte'),

      withSubTranslations({
        name: 'Pielęgnacja i uroda',
        slug: 'pielegnacja-uroda',
        icon: '✨',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Masażery', slug: 'masazery', sortOrder: 1 }, 'Massagers', 'Massagegeräte'),
          withTranslations({ name: 'Depilatory', slug: 'depilatory', sortOrder: 2 }, 'Epilators', 'Epilierer'),
          withTranslations({ name: 'Suszarki do włosów', slug: 'suszarki-wlosow', sortOrder: 3 }, 'Hair dryers', 'Haartrockner'),
          withTranslations({ name: 'Prostownice', slug: 'prostownice', sortOrder: 4 }, 'Hair straighteners', 'Glätteisen'),
          withTranslations({ name: 'Lokówki', slug: 'lokowki', sortOrder: 5 }, 'Curling irons', 'Lockenstäbe'),
          withTranslations({ name: 'Szczoteczki elektryczne', slug: 'szczoteczki-elektryczne', sortOrder: 6 }, 'Electric toothbrushes', 'Elektrische Zahnbürsten'),
        ]
      }, 'Care and beauty', 'Pflege und Schönheit'),
    ]
  },
  'Health and Beauty',
  'Supplements, health, medical devices',
  'Gesundheit und Beauty',
  'Nahrungsergänzung, Gesundheit, Medizinische Geräte'
  ),

  withCatTranslations({
    name: 'Dziecko i zabawki',
    slug: 'dziecko-zabawki',
    icon: '🧸',
    description: 'Artykuły dla dzieci, zabawki, ubranka',
    sortOrder: 6,
    subcategories: [
      withSubTranslations({
        name: 'Wózki',
        slug: 'wozki',
        icon: '🍼',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Wózki spacerowe', slug: 'wozki-spacerowe', sortOrder: 1 }, 'Strollers', 'Kinderwagen'),
          withTranslations({ name: 'Wózki głębokie', slug: 'wozki-glebokie', sortOrder: 2 }, 'Prams', 'Kombikinderwagen'),
          withTranslations({ name: 'Wózki wielofunkcyjne', slug: 'wozki-wielofunkcyjne', sortOrder: 3 }, 'Travel systems', 'Kinderwagen-Systeme'),
        ]
      }, 'Strollers', 'Kinderwagen'),

      withSubTranslations({
        name: 'Foteliki samochodowe',
        slug: 'foteliki-samochodowe',
        icon: '🚗',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Foteliki 0-13kg', slug: 'foteliki-0-13kg', sortOrder: 1 }, 'Car seats 0-13kg', 'Autositze 0-13kg'),
          withTranslations({ name: 'Foteliki 9-36kg', slug: 'foteliki-9-36kg', sortOrder: 2 }, 'Car seats 9-36kg', 'Autositze 9-36kg'),
          withTranslations({ name: 'Bazy isofix', slug: 'bazy-isofix', sortOrder: 3 }, 'Isofix bases', 'Isofix-Basen'),
        ]
      }, 'Car seats', 'Autositze'),

      withSubTranslations({
        name: 'Zabawki',
        slug: 'zabawki',
        icon: '🧸',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Klocki', slug: 'klocki', sortOrder: 1 }, 'Blocks', 'Bausteine'),
          withTranslations({ name: 'Lalki', slug: 'lalki', sortOrder: 2 }, 'Dolls', 'Puppen'),
          withTranslations({ name: 'Samochody zabawki', slug: 'samochody-zabawki', sortOrder: 3 }, 'Toy cars', 'Spielzeugautos'),
          withTranslations({ name: 'Gry planszowe', slug: 'gry-planszowe', sortOrder: 4 }, 'Board games', 'Brettspiele'),
          withTranslations({ name: 'Puzzle', slug: 'puzzle', sortOrder: 5 }, 'Puzzles', 'Puzzle'),
          withTranslations({ name: 'Pluszaki', slug: 'pluszaki', sortOrder: 6 }, 'Plush toys', 'Plüschtiere'),
        ]
      }, 'Toys', 'Spielzeug'),

      withSubTranslations({
        name: 'Karmienie',
        slug: 'karmienie',
        icon: '🍼',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Butelki', slug: 'butelki', sortOrder: 1 }, 'Bottles', 'Flaschen'),
          withTranslations({ name: 'Smoczki', slug: 'smoczki', sortOrder: 2 }, 'Pacifiers', 'Schnuller'),
          withTranslations({ name: 'Krzesełka do karmienia', slug: 'krzeselka-karmienia', sortOrder: 3 }, 'High chairs', 'Hochstühle'),
          withTranslations({ name: 'Sterylizatory', slug: 'sterylizatory', sortOrder: 4 }, 'Sterilizers', 'Sterilisatoren'),
        ]
      }, 'Feeding', 'Füttern'),

      withSubTranslations({
        name: 'Edukacyjne i STEM',
        slug: 'edukacyjne-stem',
        icon: '🧠',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Zabawki edukacyjne', slug: 'zabawki-edukacyjne', sortOrder: 1 }, 'Educational toys', 'Lernspielzeug'),
          withTranslations({ name: 'Roboty i programowanie', slug: 'roboty-programowanie-dzieci', sortOrder: 2, importKeywords: ['coding toys', 'kids robot', 'stem toy'] }, 'Coding and robots', 'Programmierung und Roboter'),
          withTranslations({ name: 'Zestawy naukowe', slug: 'zestawy-naukowe', sortOrder: 3 }, 'Science kits', 'Wissenschaftssets'),
          withTranslations({ name: 'RC dla dzieci', slug: 'rc-dla-dzieci', sortOrder: 4, importKeywords: ['rc toy car', 'rc drone kids'] }, 'RC toys for kids', 'RC-Spielzeug für Kinder'),
        ]
      }, 'Educational and STEM', 'Lernen und STEM'),

      withSubTranslations({
        name: 'Ubranka i akcesoria dziecięce',
        slug: 'ubranka-akcesoria-dzieciece',
        icon: '👶',
        sortOrder: 6,
        subcategories: [
          withTranslations({ name: 'Body i pajacyki', slug: 'body-pajacyki', sortOrder: 1 }, 'Bodysuits and sleepsuits', 'Bodys und Strampler'),
          withTranslations({ name: 'Ubranka sezonowe', slug: 'ubranka-sezonowe-dzieci', sortOrder: 2 }, 'Seasonal clothes', 'Saisonkleidung'),
          withTranslations({ name: 'Buty dziecięce', slug: 'buty-dzieciece', sortOrder: 3 }, 'Kids shoes', 'Kinderschuhe'),
          withTranslations({ name: 'Akcesoria niemowlęce', slug: 'akcesoria-niemowlece', sortOrder: 4 }, 'Baby accessories', 'Babyzubehör'),
        ]
      }, 'Kids clothing and accessories', 'Kinderkleidung und Zubehör'),
    ]
  },
  'Kids and Toys',
  'Baby products, toys, clothing',
  'Kinder und Spielzeug',
  'Babyartikel, Spielzeug, Kleidung'
  ),

  withCatTranslations({
    name: 'Książki i media',
    slug: 'ksiazki-media',
    icon: '📚',
    description: 'Książki, filmy, muzyka, gry',
    sortOrder: 7,
    subcategories: [
      withSubTranslations({
        name: 'Książki',
        slug: 'ksiazki',
        icon: '📖',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Beletrystyka', slug: 'beletrystyka', sortOrder: 1 }, 'Fiction', 'Belletristik'),
          withTranslations({ name: 'Kryminał i thriller', slug: 'kryminal-thriller', sortOrder: 2 }, 'Crime and thriller', 'Krimi und Thriller'),
          withTranslations({ name: 'Fantasy i SF', slug: 'fantasy-sf', sortOrder: 3 }, 'Fantasy and SF', 'Fantasy und SF'),
          withTranslations({ name: 'Książki dla dzieci', slug: 'ksiazki-dzieci', sortOrder: 4 }, 'Children books', 'Kinderbücher'),
          withTranslations({ name: 'Komiksy i manga', slug: 'komiksy-manga', sortOrder: 5 }, 'Comics and manga', 'Comics und Manga'),
          withTranslations({ name: 'Poradniki', slug: 'poradniki', sortOrder: 6 }, 'Guides', 'Ratgeber'),
        ]
      }, 'Books', 'Bücher'),

      withSubTranslations({
        name: 'Filmy i seriale',
        slug: 'filmy-seriale',
        icon: '🎬',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Filmy DVD', slug: 'filmy-dvd', sortOrder: 1 }, 'DVD movies', 'DVD-Filme'),
          withTranslations({ name: 'Filmy Blu-ray', slug: 'filmy-bluray', sortOrder: 2 }, 'Blu-ray movies', 'Blu-ray-Filme'),
          withTranslations({ name: 'Seriale', slug: 'seriale', sortOrder: 3 }, 'TV series', 'Serien'),
          withTranslations({ name: 'Subskrypcje VOD', slug: 'subskrypcje-vod', sortOrder: 4 }, 'VOD subscriptions', 'VOD-Abos'),
        ]
      }, 'Movies and series', 'Filme und Serien'),

      withSubTranslations({
        name: 'Muzyka',
        slug: 'muzyka',
        icon: '🎵',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Płyty CD', slug: 'plyty-cd', sortOrder: 1 }, 'CDs', 'CDs'),
          withTranslations({ name: 'Płyty winylowe', slug: 'plyty-winylowe', sortOrder: 2 }, 'Vinyl', 'Vinyl'),
          withTranslations({ name: 'Subskrypcje muzyczne', slug: 'subskrypcje-muzyczne', sortOrder: 3 }, 'Music subscriptions', 'Musik-Abos'),
        ]
      }, 'Music', 'Musik'),
    ]
  },
  'Books and Media',
  'Books, movies, music, games',
  'Bücher und Medien',
  'Bücher, Filme, Musik, Spiele'
  ),

  withCatTranslations({
    name: 'Motoryzacja',
    slug: 'motoryzacja',
    icon: '🚗',
    description: 'Akcesoria samochodowe, nawigacje, kamery',
    sortOrder: 8,
    subcategories: [
      withSubTranslations({
        name: 'Nawigacje i kamery',
        slug: 'nawigacje-kamery',
        icon: '🗺️',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Nawigacje GPS', slug: 'nawigacje-gps', sortOrder: 1 }, 'GPS navigation', 'GPS-Navigation'),
          withTranslations({ name: 'Wideorejestry', slug: 'wideorejestry', sortOrder: 2 }, 'Dash cams', 'Dashcams'),
          withTranslations({ name: 'Kamery cofania', slug: 'kamery-cofania', sortOrder: 3 }, 'Rear cameras', 'Rückfahrkameras'),
        ]
      }, 'Navigation and cameras', 'Navigation und Kameras'),

      withSubTranslations({
        name: 'Audio samochodowe',
        slug: 'audio-samochodowe',
        icon: '🔊',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Radia samochodowe', slug: 'radia-samochodowe', sortOrder: 1 }, 'Car radios', 'Autoradios'),
          withTranslations({ name: 'Głośniki samochodowe', slug: 'glosniki-samochodowe', sortOrder: 2 }, 'Car speakers', 'Autolautsprecher'),
          withTranslations({ name: 'Wzmacniacze', slug: 'wzmacniacze', sortOrder: 3 }, 'Amplifiers', 'Verstärker'),
          withTranslations({ name: 'Subwoofery', slug: 'subwoofery', sortOrder: 4 }, 'Subwoofers', 'Subwoofer'),
        ]
      }, 'Car audio', 'Car-Audio'),

      withSubTranslations({
        name: 'Akcesoria samochodowe',
        slug: 'akcesoria-samochodowe',
        icon: '🚙',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Kompresory', slug: 'kompresory', sortOrder: 1 }, 'Compressors', 'Kompressoren'),
          withTranslations({ name: 'Ładowarki samochodowe', slug: 'ladowarki-samochodowe', sortOrder: 2 }, 'Car chargers', 'Auto-Ladegeräte'),
          withTranslations({ name: 'Uchwyty do telefonu', slug: 'uchwyty-telefonu', sortOrder: 3 }, 'Phone mounts', 'Handyhalterungen'),
          withTranslations({ name: 'Pokrowce na fotele', slug: 'pokrowce-fotele', sortOrder: 4 }, 'Seat covers', 'Sitzbezüge'),
          withTranslations({ name: 'Bagażniki dachowe', slug: 'bagazniki-dachowe', sortOrder: 5 }, 'Roof racks', 'Dachträger'),
          withTranslations({ name: 'Dywaniki samochodowe', slug: 'dywaniki-samochodowe', sortOrder: 6 }, 'Car mats', 'Auto-Fußmatten'),
        ]
      }, 'Car accessories', 'Autozubehör'),

      withSubTranslations({
        name: 'Części samochodowe',
        slug: 'czesci-samochodowe',
        icon: '🧰',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Filtry i oleje', slug: 'filtry-oleje', sortOrder: 1 }, 'Filters and oils', 'Filter und Öle'),
          withTranslations({ name: 'Hamulce i tarcze', slug: 'hamulce-tarcze', sortOrder: 2 }, 'Brakes and discs', 'Bremsen und Scheiben'),
          withTranslations({ name: 'Akumulatory', slug: 'akumulatory', sortOrder: 3 }, 'Car batteries', 'Autobatterien'),
          withTranslations({ name: 'Oświetlenie samochodowe', slug: 'oswietlenie-samochodowe', sortOrder: 4 }, 'Car lighting', 'Autobeleuchtung'),
        ]
      }, 'Car parts', 'Autoteile'),

      withSubTranslations({
        name: 'Motocykle i skutery',
        slug: 'motocykle-skutery',
        icon: '🏍️',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Kaski motocyklowe', slug: 'kaski-motocyklowe', sortOrder: 1 }, 'Motorcycle helmets', 'Motorradhelme'),
          withTranslations({ name: 'Odzież motocyklowa', slug: 'odziez-motocyklowa', sortOrder: 2 }, 'Motorcycle clothing', 'Motorradbekleidung'),
          withTranslations({ name: 'Akcesoria do motocykli', slug: 'akcesoria-motocykle', sortOrder: 3 }, 'Motorcycle accessories', 'Motorradzubehör'),
          withTranslations({ name: 'Części do skuterów', slug: 'czesci-skutery', sortOrder: 4 }, 'Scooter parts', 'Rollerteile'),
        ]
      }, 'Motorcycles and scooters', 'Motorräder und Roller'),
    ]
  },
  'Automotive',
  'Car accessories, navigation, dash cams',
  'Automotive',
  'Autozubehör, Navigation, Kameras'
  ),

  withCatTranslations({
    name: 'Usługi i subskrypcje',
    slug: 'uslugi-subskrypcje',
    icon: '🎫',
    description: 'Usługi cyfrowe, subskrypcje, vouchery',
    sortOrder: 9,
    subcategories: [
      withSubTranslations({
        name: 'Streaming',
        slug: 'streaming',
        icon: '📺',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Netflix', slug: 'netflix', sortOrder: 1 }, 'Netflix', 'Netflix'),
          withTranslations({ name: 'HBO Max', slug: 'hbo-max', sortOrder: 2 }, 'HBO Max', 'HBO Max'),
          withTranslations({ name: 'Disney+', slug: 'disney-plus', sortOrder: 3 }, 'Disney+', 'Disney+'),
          withTranslations({ name: 'Amazon Prime', slug: 'amazon-prime', sortOrder: 4 }, 'Amazon Prime', 'Amazon Prime'),
          withTranslations({ name: 'Spotify', slug: 'spotify', sortOrder: 5 }, 'Spotify', 'Spotify'),
          withTranslations({ name: 'YouTube Premium', slug: 'youtube-premium', sortOrder: 6 }, 'YouTube Premium', 'YouTube Premium'),
          withTranslations({ name: 'Apple TV+', slug: 'apple-tv-plus', sortOrder: 7 }, 'Apple TV+', 'Apple TV+'),
          withTranslations({ name: 'SkyShowtime', slug: 'skyshowtime', sortOrder: 8 }, 'SkyShowtime', 'SkyShowtime'),
        ]
      }, 'Streaming', 'Streaming'),

      withSubTranslations({
        name: 'Gaming',
        slug: 'uslugi-gaming',
        icon: '🎮',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'PlayStation Plus', slug: 'playstation-plus', sortOrder: 1 }, 'PlayStation Plus', 'PlayStation Plus'),
          withTranslations({ name: 'Xbox Game Pass', slug: 'xbox-game-pass', sortOrder: 2 }, 'Xbox Game Pass', 'Xbox Game Pass'),
          withTranslations({ name: 'Nintendo Switch Online', slug: 'nintendo-switch-online', sortOrder: 3 }, 'Nintendo Switch Online', 'Nintendo Switch Online'),
          withTranslations({ name: 'EA Play', slug: 'ea-play', sortOrder: 4 }, 'EA Play', 'EA Play'),
          withTranslations({ name: 'Ubisoft+', slug: 'ubisoft-plus', sortOrder: 5 }, 'Ubisoft+', 'Ubisoft+'),
        ]
      }, 'Gaming', 'Gaming'),

      withSubTranslations({
        name: 'Software',
        slug: 'software',
        icon: '💻',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Microsoft Office', slug: 'microsoft-office', sortOrder: 1 }, 'Microsoft Office', 'Microsoft Office'),
          withTranslations({ name: 'Windows', slug: 'windows', sortOrder: 2 }, 'Windows', 'Windows'),
          withTranslations({ name: 'Antivirus', slug: 'antivirus', sortOrder: 3 }, 'Antivirus', 'Antivirus'),
          withTranslations({ name: 'VPN', slug: 'vpn', sortOrder: 4 }, 'VPN', 'VPN'),
          withTranslations({ name: 'Adobe Creative Cloud', slug: 'adobe-creative-cloud', sortOrder: 5 }, 'Adobe Creative Cloud', 'Adobe Creative Cloud'),
          withTranslations({ name: 'Canva Pro', slug: 'canva-pro', sortOrder: 6 }, 'Canva Pro', 'Canva Pro'),
        ]
      }, 'Software', 'Software'),

      withSubTranslations({
        name: 'Podróże i bilety',
        slug: 'podroze-bilety',
        icon: '✈️',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Loty', slug: 'loty', sortOrder: 1 }, 'Flights', 'Flüge'),
          withTranslations({ name: 'Hotele', slug: 'hotele', sortOrder: 2 }, 'Hotels', 'Hotels'),
          withTranslations({ name: 'Bilety kolejowe', slug: 'bilety-kolejowe', sortOrder: 3 }, 'Train tickets', 'Zugtickets'),
          withTranslations({ name: 'Wynajem samochodów', slug: 'wynajem-samochodow', sortOrder: 4 }, 'Car rental', 'Autovermietung'),
          withTranslations({ name: 'Ubezpieczenia turystyczne', slug: 'ubezpieczenia-turystyczne', sortOrder: 5 }, 'Travel insurance', 'Reiseversicherung'),
        ]
      }, 'Travel and tickets', 'Reisen und Tickets'),
    ]
  },
  'Services and Subscriptions',
  'Digital services, subscriptions, vouchers',
  'Dienste und Abos',
  'Digitale Dienste, Abos, Gutscheine'
  ),

  withCatTranslations({
    name: 'Zwierzęta',
    slug: 'zwierzeta',
    icon: '🐾',
    description: 'Akcesoria, karmy i pielęgnacja dla zwierząt',
    sortOrder: 10,
    subcategories: [
      withSubTranslations({
        name: 'Psy',
        slug: 'psy',
        icon: '🐕',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Karma dla psów', slug: 'karma-psy', sortOrder: 1 }, 'Dog food', 'Hundefutter'),
          withTranslations({ name: 'Smycze i obroże', slug: 'smycze-obroze', sortOrder: 2 }, 'Leashes and collars', 'Leinen und Halsbänder'),
          withTranslations({ name: 'Legowiska', slug: 'legowiska-psy', sortOrder: 3 }, 'Dog beds', 'Hundebetten'),
          withTranslations({ name: 'Zabawki dla psów', slug: 'zabawki-psy', sortOrder: 4 }, 'Dog toys', 'Hundespielzeug'),
          withTranslations({ name: 'Transportery dla psów', slug: 'transportery-psy', sortOrder: 5 }, 'Dog carriers', 'Hundeboxen'),
          withTranslations({ name: 'Pielęgnacja psów', slug: 'pielegnacja-psy', sortOrder: 6 }, 'Dog grooming', 'Hundepflege'),
        ]
      }, 'Dogs', 'Hunde'),

      withSubTranslations({
        name: 'Koty',
        slug: 'koty',
        icon: '🐈',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Karma dla kotów', slug: 'karma-koty', sortOrder: 1 }, 'Cat food', 'Katzenfutter'),
          withTranslations({ name: 'Kuwety i żwirek', slug: 'kuwety-zwirek', sortOrder: 2 }, 'Litter and trays', 'Katzenklos und Streu'),
          withTranslations({ name: 'Drapaki', slug: 'drapaki', sortOrder: 3 }, 'Scratchers', 'Kratzbäume'),
          withTranslations({ name: 'Zabawki dla kotów', slug: 'zabawki-koty', sortOrder: 4 }, 'Cat toys', 'Katzenspielzeug'),
          withTranslations({ name: 'Transportery dla kotów', slug: 'transportery-koty', sortOrder: 5 }, 'Cat carriers', 'Katzentransportboxen'),
        ]
      }, 'Cats', 'Katzen'),

      withSubTranslations({
        name: 'Akwaria i rybki',
        slug: 'akwaria-rybki',
        icon: '🐠',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Akwaria', slug: 'akwaria', sortOrder: 1 }, 'Aquariums', 'Aquarien'),
          withTranslations({ name: 'Filtry do akwarium', slug: 'filtry-akwarium', sortOrder: 2 }, 'Filters', 'Filter'),
          withTranslations({ name: 'Oświetlenie akwariowe', slug: 'oswietlenie-akwarium', sortOrder: 3 }, 'Aquarium lighting', 'Aquarienbeleuchtung'),
          withTranslations({ name: 'Pokarm dla ryb', slug: 'pokarm-ryb', sortOrder: 4 }, 'Fish food', 'Fischfutter'),
        ]
      }, 'Aquarium and fish', 'Aquarium und Fische'),

      withSubTranslations({
        name: 'Ptaki i gryzonie',
        slug: 'ptaki-gryzonie',
        icon: '🐹',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Klatki', slug: 'klatki', sortOrder: 1 }, 'Cages', 'Käfige'),
          withTranslations({ name: 'Karma dla ptaków', slug: 'karma-ptaki', sortOrder: 2 }, 'Bird food', 'Vogelfutter'),
          withTranslations({ name: 'Karma dla gryzoni', slug: 'karma-gryzonie', sortOrder: 3 }, 'Rodent food', 'Nagerfutter'),
          withTranslations({ name: 'Akcesoria dla gryzoni', slug: 'akcesoria-gryzonie', sortOrder: 4 }, 'Rodent accessories', 'Nagerzubehör'),
        ]
      }, 'Birds and rodents', 'Vögel und Nagetiere'),

      withSubTranslations({
        name: 'Smart dla zwierząt',
        slug: 'smart-dla-zwierzat',
        icon: '📡',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Automatyczne karmniki', slug: 'automatyczne-karmniki', sortOrder: 1, importKeywords: ['smart pet feeder', 'automatic pet feeder'] }, 'Automatic feeders', 'Automatische Futterspender'),
          withTranslations({ name: 'Fontanny i poidła smart', slug: 'fontanny-poidla-smart', sortOrder: 2 }, 'Smart fountains and drinkers', 'Smarte Trinkbrunnen'),
          withTranslations({ name: 'Lokalizatory GPS', slug: 'lokalizatory-gps-zwierzeta', sortOrder: 3 }, 'GPS trackers', 'GPS-Tracker'),
          withTranslations({ name: 'Kamery do monitoringu zwierząt', slug: 'kamery-monitoring-zwierzat', sortOrder: 4 }, 'Pet monitoring cameras', 'Haustier-Überwachungskameras'),
        ]
      }, 'Smart pet', 'Smartes Haustier'),
    ]
  },
  'Pets',
  'Accessories, food and care for animals',
  'Haustiere',
  'Zubehör, Futter und Pflege für Tiere'
  ),

  withCatTranslations({
    name: 'Biuro i szkoła',
    slug: 'biuro-szkola',
    icon: '📝',
    description: 'Materiały biurowe, papiernicze i szkolne',
    sortOrder: 11,
    subcategories: [
      withSubTranslations({
        name: 'Materiały piśmienne',
        slug: 'materialy-pismienne',
        icon: '✏️',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Długopisy', slug: 'dlugopisy', sortOrder: 1 }, 'Pens', 'Kugelschreiber'),
          withTranslations({ name: 'Ołówki', slug: 'olowki', sortOrder: 2 }, 'Pencils', 'Bleistifte'),
          withTranslations({ name: 'Markery i flamastry', slug: 'markery-flamastry', sortOrder: 3 }, 'Markers and highlighters', 'Marker und Textmarker'),
          withTranslations({ name: 'Korektory', slug: 'korektory', sortOrder: 4 }, 'Correction', 'Korrekturmittel'),
          withTranslations({ name: 'Zakreślacze', slug: 'zakreslacze', sortOrder: 5 }, 'Highlighters', 'Textmarker'),
        ]
      }, 'Writing materials', 'Schreibwaren'),

      withSubTranslations({
        name: 'Papier i zeszyty',
        slug: 'papier-zeszyty',
        icon: '📄',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Papier ksero', slug: 'papier-ksero', sortOrder: 1 }, 'Copy paper', 'Kopierpapier'),
          withTranslations({ name: 'Zeszyty', slug: 'zeszyty', sortOrder: 2 }, 'Notebooks', 'Hefte'),
          withTranslations({ name: 'Notesy', slug: 'notesy', sortOrder: 3 }, 'Notepads', 'Notizblöcke'),
          withTranslations({ name: 'Bloki rysunkowe', slug: 'bloki-rysunkowe', sortOrder: 4 }, 'Drawing pads', 'Zeichenblöcke'),
        ]
      }, 'Paper and notebooks', 'Papier und Hefte'),

      withSubTranslations({
        name: 'Organizacja',
        slug: 'organizacja-biuro',
        icon: '📋',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Segregatory', slug: 'segregatory', sortOrder: 1 }, 'Binders', 'Ordner'),
          withTranslations({ name: 'Teczki', slug: 'teczki', sortOrder: 2 }, 'Folders', 'Mappen'),
          withTranslations({ name: 'Organizery biurkowe', slug: 'organizery-biurkowe', sortOrder: 3 }, 'Desk organizers', 'Schreibtisch-Organizer'),
          withTranslations({ name: 'Kalendarze i plannery', slug: 'kalendarze-plannery', sortOrder: 4 }, 'Calendars and planners', 'Kalender und Planer'),
          withTranslations({ name: 'Tablice i pinezki', slug: 'tablice-pinezki', sortOrder: 5 }, 'Boards and pins', 'Tafeln und Pins'),
        ]
      }, 'Organization', 'Organisation'),

      withSubTranslations({
        name: 'Plecaki i tornistry',
        slug: 'plecaki-tornistry',
        icon: '🎒',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Tornistry szkolne', slug: 'tornistry-szkolne', sortOrder: 1 }, 'School bags', 'Schulranzen'),
          withTranslations({ name: 'Plecaki szkolne', slug: 'plecaki-szkolne', sortOrder: 2 }, 'School backpacks', 'Schulrucksäcke'),
          withTranslations({ name: 'Piórniki', slug: 'piorniki', sortOrder: 3 }, 'Pencil cases', 'Federmäppchen'),
        ]
      }, 'Bags and backpacks', 'Taschen und Rucksäcke'),
    ]
  },
  'Office and School',
  'Office, paper and school supplies',
  'Büro und Schule',
  'Büro-, Papier- und Schulartikel'
  ),

  withCatTranslations({
    name: 'Smart Home',
    slug: 'smart-home',
    icon: '🏡',
    description: 'Inteligentne urządzenia do domu',
    sortOrder: 12,
    subcategories: [
      withSubTranslations({
        name: 'Oświetlenie inteligentne',
        slug: 'oswietlenie-smart',
        icon: '💡',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Żarówki smart', slug: 'zarowki-smart', sortOrder: 1 }, 'Smart bulbs', 'Smart-Glühbirnen'),
          withTranslations({ name: 'Taśmy LED smart', slug: 'tasmy-led-smart', sortOrder: 2 }, 'Smart LED strips', 'Smart-LED-Streifen'),
          withTranslations({ name: 'Przełączniki smart', slug: 'przelaczniki-smart', sortOrder: 3 }, 'Smart switches', 'Smart-Schalter'),
        ]
      }, 'Smart lighting', 'Smart-Beleuchtung'),

      withSubTranslations({
        name: 'Bezpieczeństwo',
        slug: 'bezpieczenstwo-smart',
        icon: '🔒',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Kamery IP', slug: 'kamery-ip', sortOrder: 1 }, 'IP cameras', 'IP-Kameras'),
          withTranslations({ name: 'Dzwonki wideo', slug: 'dzwonki-wideo', sortOrder: 2 }, 'Video doorbells', 'Video-Türklingeln'),
          withTranslations({ name: 'Alarmy smart', slug: 'alarmy-smart', sortOrder: 3 }, 'Smart alarms', 'Smart-Alarme'),
          withTranslations({ name: 'Zamki smart', slug: 'zamki-smart', sortOrder: 4 }, 'Smart locks', 'Smart-Schlösser'),
          withTranslations({ name: 'Czujniki ruchu', slug: 'czujniki-ruchu', sortOrder: 5 }, 'Motion sensors', 'Bewegungssensoren'),
        ]
      }, 'Security', 'Sicherheit'),

      withSubTranslations({
        name: 'Klimatyzacja i ogrzewanie',
        slug: 'klimatyzacja-smart',
        icon: '🌡️',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Termostaty smart', slug: 'termostaty-smart', sortOrder: 1 }, 'Smart thermostats', 'Smart-Thermostate'),
          withTranslations({ name: 'Czujniki temperatury', slug: 'czujniki-temperatury', sortOrder: 2 }, 'Temperature sensors', 'Temperatursensoren'),
          withTranslations({ name: 'Nawilżacze smart', slug: 'nawilzacze-smart', sortOrder: 3 }, 'Smart humidifiers', 'Smart-Luftbefeuchter'),
        ]
      }, 'Climate', 'Klima'),

      withSubTranslations({
        name: 'Asystenci głosowi',
        slug: 'asystenci-glosowi',
        icon: '🔊',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Amazon Echo', slug: 'amazon-echo', sortOrder: 1 }, 'Amazon Echo', 'Amazon Echo'),
          withTranslations({ name: 'Google Home', slug: 'google-home', sortOrder: 2 }, 'Google Home', 'Google Home'),
          withTranslations({ name: 'Apple HomePod', slug: 'apple-homepod', sortOrder: 3 }, 'Apple HomePod', 'Apple HomePod'),
        ]
      }, 'Voice assistants', 'Sprachassistenten'),

      withSubTranslations({
        name: 'Gniazdka i sterowanie',
        slug: 'gniazdka-sterowanie',
        icon: '🔌',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Gniazdka smart', slug: 'gniazdka-smart', sortOrder: 1 }, 'Smart sockets', 'Smart-Steckdosen'),
          withTranslations({ name: 'Listwy zasilające smart', slug: 'listwy-smart', sortOrder: 2 }, 'Smart power strips', 'Smart-Steckdosenleisten'),
          withTranslations({ name: 'Piloty uniwersalne', slug: 'piloty-uniwersalne', sortOrder: 3 }, 'Universal remotes', 'Universale Fernbedienungen'),
        ]
      }, 'Sockets and control', 'Steckdosen und Steuerung'),

      withSubTranslations({
        name: 'Sprzątanie automatyczne',
        slug: 'sprzatanie-automatyczne',
        icon: '🤖',
        sortOrder: 6,
        subcategories: [
          withTranslations({ name: 'Roboty odkurzające', slug: 'roboty-odkurzajace', sortOrder: 1, importKeywords: ['robot vacuum', 'vacuum robot', 'smart vacuum cleaner'] }, 'Robot vacuums', 'Saugroboter'),
          withTranslations({ name: 'Roboty mopujące', slug: 'roboty-mopujace', sortOrder: 2, importKeywords: ['robot mop', 'mopping robot'] }, 'Robot mops', 'Wischroboter'),
          withTranslations({ name: 'Akcesoria do robotów', slug: 'akcesoria-roboty-sprzatajace', sortOrder: 3, importKeywords: ['robot vacuum accessories', 'robot mop accessories'] }, 'Robot vacuum accessories', 'Saugroboter-Zubehör'),
        ]
      }, 'Automated cleaning', 'Automatisierte Reinigung'),
    ]
  },
  'Smart Home',
  'Intelligent devices for home',
  'Smart Home',
  'Intelligente Geräte für Zuhause'
  ),

  withCatTranslations({
    name: 'Elektronika noszona',
    slug: 'elektronika-noszona',
    icon: '⌚',
    description: 'Smartwatche, opaski, akcesoria wearables',
    sortOrder: 13,
    subcategories: [
      withSubTranslations({
        name: 'Smartwatche',
        slug: 'smartwatche-wearables',
        icon: '⌚',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Apple Watch', slug: 'apple-watch', sortOrder: 1 }, 'Apple Watch', 'Apple Watch'),
          withTranslations({ name: 'Samsung Galaxy Watch', slug: 'samsung-galaxy-watch', sortOrder: 2 }, 'Samsung Galaxy Watch', 'Samsung Galaxy Watch'),
          withTranslations({ name: 'Garmin', slug: 'garmin-smartwatch', sortOrder: 3 }, 'Garmin', 'Garmin'),
          withTranslations({ name: 'Xiaomi Watch', slug: 'xiaomi-watch', sortOrder: 4 }, 'Xiaomi Watch', 'Xiaomi Watch'),
          withTranslations({ name: 'Zegarki dla dzieci', slug: 'zegarki-dzieci', sortOrder: 5 }, 'Kids smartwatches', 'Kinder-Smartwatches'),
        ]
      }, 'Smartwatches', 'Smartwatches'),

      withSubTranslations({
        name: 'Opaski sportowe',
        slug: 'opaski-sportowe',
        icon: '🏃',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Opaski fitness', slug: 'opaski-fitness', sortOrder: 1 }, 'Fitness bands', 'Fitness-Armbänder'),
          withTranslations({ name: 'Pulsometry', slug: 'pulsometry', sortOrder: 2 }, 'Heart rate monitors', 'Pulsmesser'),
          withTranslations({ name: 'Opaski do biegania', slug: 'opaski-bieganie', sortOrder: 3 }, 'Running bands', 'Laufarmbänder'),
        ]
      }, 'Sport bands', 'Sportarmbänder'),

      withSubTranslations({
        name: 'Akcesoria do wearables',
        slug: 'akcesoria-wearables',
        icon: '🔗',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Paski do zegarków', slug: 'paski-smartwatch', sortOrder: 1 }, 'Watch straps', 'Uhrenarmbänder'),
          withTranslations({ name: 'Ładowarki do smartwatchy', slug: 'ladowarki-smartwatch', sortOrder: 2 }, 'Smartwatch chargers', 'Smartwatch-Ladegeräte'),
          withTranslations({ name: 'Folie ochronne', slug: 'folie-smartwatch', sortOrder: 3 }, 'Protective films', 'Schutzfolien'),
        ]
      }, 'Wearable accessories', 'Wearable-Zubehör'),
    ]
  },
  'Wearable Electronics',
  'Smartwatches, bands, accessories',
  'Wearable Elektronik',
  'Smartwatches, Bänder, Zubehör'
  ),

  withCatTranslations({
    name: 'Hobby i rękodzieło',
    slug: 'hobby-rekodzilo',
    icon: '🎨',
    description: 'Modelarstwo, druk 3D, malarstwo, szycie',
    sortOrder: 14,
    subcategories: [
      withSubTranslations({
        name: 'Modelarstwo',
        slug: 'modelarstwo',
        icon: '✈️',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Modele samolotów', slug: 'modele-samolotow', sortOrder: 1 }, 'Airplane models', 'Flugzeugmodelle'),
          withTranslations({ name: 'Modele samochodów', slug: 'modele-samochodow', sortOrder: 2 }, 'Car models', 'Automodelle'),
          withTranslations({ name: 'Modele statków', slug: 'modele-statkow', sortOrder: 3 }, 'Ship models', 'Schiffsmodelle'),
          withTranslations({ name: 'Kleje i farby modelarskie', slug: 'kleje-farby-modelarskie', sortOrder: 4 }, 'Glues and paints', 'Kleber und Farben'),
        ]
      }, 'Model making', 'Modellbau'),

      withSubTranslations({
        name: 'Druk 3D',
        slug: 'druk-3d',
        icon: '🖨️',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Drukarki 3D', slug: 'drukarki-3d', sortOrder: 1 }, '3D printers', '3D-Drucker'),
          withTranslations({ name: 'Filamenty PLA', slug: 'filamenty-pla', sortOrder: 2 }, 'PLA filaments', 'PLA-Filamente'),
          withTranslations({ name: 'Filamenty ABS', slug: 'filamenty-abs', sortOrder: 3 }, 'ABS filaments', 'ABS-Filamente'),
          withTranslations({ name: 'Żywice do druku', slug: 'zywice-druk', sortOrder: 4 }, 'Printing resins', 'Harze für Druck'),
        ]
      }, '3D printing', '3D-Druck'),

      withSubTranslations({
        name: 'Malarstwo i rysowanie',
        slug: 'malarstwo-rysowanie',
        icon: '🎨',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Farby akrylowe', slug: 'farby-akrylowe', sortOrder: 1 }, 'Acrylic paints', 'Acrylfarben'),
          withTranslations({ name: 'Farby olejne', slug: 'farby-olejne', sortOrder: 2 }, 'Oil paints', 'Ölfarben'),
          withTranslations({ name: 'Pędzle', slug: 'pedzle', sortOrder: 3 }, 'Brushes', 'Pinsel'),
          withTranslations({ name: 'Płótna malarskie', slug: 'plotna-malarskie', sortOrder: 4 }, 'Canvas', 'Leinwände'),
          withTranslations({ name: 'Kredki i pastele', slug: 'kredki-pastele', sortOrder: 5 }, 'Crayons and pastels', 'Buntstifte und Pastelle'),
        ]
      }, 'Painting and drawing', 'Malen und Zeichnen'),

      withSubTranslations({
        name: 'Szycie i dziewiarstwo',
        slug: 'szycie-dziewiarstwo',
        icon: '🧵',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Maszyny do szycia', slug: 'maszyny-szycia', sortOrder: 1 }, 'Sewing machines', 'Nähmaschinen'),
          withTranslations({ name: 'Nici i igły', slug: 'nici-igly', sortOrder: 2 }, 'Threads and needles', 'Garn und Nadeln'),
          withTranslations({ name: 'Tkaniny', slug: 'tkaniny', sortOrder: 3 }, 'Fabrics', 'Stoffe'),
          withTranslations({ name: 'Druty i szydełka', slug: 'druty-szydelka', sortOrder: 4 }, 'Knitting needles and hooks', 'Stricknadeln und Häkelnadeln'),
          withTranslations({ name: 'Włóczki', slug: 'wloczki', sortOrder: 5 }, 'Yarns', 'Wolle'),
        ]
      }, 'Sewing and knitting', 'Nähen und Stricken'),

      withSubTranslations({
        name: 'Elektronika DIY',
        slug: 'elektronika-diy',
        icon: '🔧',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Arduino', slug: 'arduino', sortOrder: 1 }, 'Arduino', 'Arduino'),
          withTranslations({ name: 'Raspberry Pi', slug: 'raspberry-pi', sortOrder: 2 }, 'Raspberry Pi', 'Raspberry Pi'),
          withTranslations({ name: 'Zestawy elektroniczne', slug: 'zestawy-elektroniczne', sortOrder: 3 }, 'Electronic kits', 'Elektronik-Bausätze'),
          withTranslations({ name: 'Lutownice', slug: 'lutownice', sortOrder: 4 }, 'Soldering irons', 'Lötkolben'),
          withTranslations({ name: 'Multimetry', slug: 'multimetry', sortOrder: 5 }, 'Multimeters', 'Multimeter'),
        ]
      }, 'DIY electronics', 'Elektronik DIY'),
    ]
  },
  'Hobby and Crafts',
  'Modeling, 3D printing, painting, sewing',
  'Hobby und Handwerk',
  'Modellbau, 3D-Druck, Malen, Nähen'
  ),

  withCatTranslations({
    name: 'Narzędzia i przemysł',
    slug: 'narzedzia-przemysl',
    icon: '🔧',
    description: 'Elektronarzędzia, BHP, osprzęt przemysłowy',
    sortOrder: 15,
    subcategories: [
      withSubTranslations({
        name: 'Elektronarzędzia',
        slug: 'elektronarzedzia',
        icon: '⚙️',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Wiertarko-wkrętarki', slug: 'wiertarko-wkretarki', sortOrder: 1 }, 'Drill drivers', 'Bohrschrauber'),
          withTranslations({ name: 'Młoty udarowe', slug: 'mloty-udarowe', sortOrder: 2 }, 'Hammer drills', 'Bohrhämmer'),
          withTranslations({ name: 'Szlifierki kątowe', slug: 'szlifierki-katowe', sortOrder: 3 }, 'Angle grinders', 'Winkelschleifer'),
          withTranslations({ name: 'Piły tarczowe', slug: 'pily-tarczowe', sortOrder: 4 }, 'Circular saws', 'Kreissägen'),
          withTranslations({ name: 'Frezarki', slug: 'frezarki', sortOrder: 5 }, 'Routers', 'Fräsen'),
          withTranslations({ name: 'Strugarki', slug: 'strugarki', sortOrder: 6 }, 'Planers', 'Hobelmaschinen'),
        ]
      }, 'Power tools', 'Elektrowerkzeuge'),

      withSubTranslations({
        name: 'Osprzęt narzędziowy',
        slug: 'osprzet-narzedzia',
        icon: '🔩',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Wiertła', slug: 'wiertla', sortOrder: 1 }, 'Drill bits', 'Bohrer'),
          withTranslations({ name: 'Bity i nasadki', slug: 'bity-nasadki', sortOrder: 2 }, 'Bits and sockets', 'Bits und Nüsse'),
          withTranslations({ name: 'Tarcze ścierne', slug: 'tarcze-scierne', sortOrder: 3 }, 'Grinding discs', 'Schleifscheiben'),
          withTranslations({ name: 'Tarcze do piły', slug: 'tarcze-pily', sortOrder: 4 }, 'Saw blades', 'Sägeblätter'),
        ]
      }, 'Tool accessories', 'Werkzeugzubehör'),

      withSubTranslations({
        name: 'BHP i ochrona',
        slug: 'bhp-ochrona',
        icon: '🦺',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Kaski ochronne', slug: 'kaski-ochronne', sortOrder: 1 }, 'Safety helmets', 'Schutzhelme'),
          withTranslations({ name: 'Okulary ochronne', slug: 'okulary-ochronne', sortOrder: 2 }, 'Safety glasses', 'Schutzbrillen'),
          withTranslations({ name: 'Rękawice robocze', slug: 'rekawice-robocze', sortOrder: 3 }, 'Work gloves', 'Arbeitshandschuhe'),
          withTranslations({ name: 'Maseczki i respiratory', slug: 'maseczki-respiratory', sortOrder: 4 }, 'Masks and respirators', 'Masken und Respiratoren'),
          withTranslations({ name: 'Buty robocze', slug: 'buty-robocze', sortOrder: 5 }, 'Work shoes', 'Arbeitsschuhe'),
        ]
      }, 'Safety', 'Arbeitsschutz'),

      withSubTranslations({
        name: 'Spawanie i lutowanie',
        slug: 'spawanie-lutowanie',
        icon: '🔥',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Spawarki', slug: 'spawarki', sortOrder: 1 }, 'Welders', 'Schweißgeräte'),
          withTranslations({ name: 'Elektrody', slug: 'elektrody', sortOrder: 2 }, 'Electrodes', 'Elektroden'),
          withTranslations({ name: 'Maski spawalnicze', slug: 'maski-spawalnicze', sortOrder: 3 }, 'Welding masks', 'Schweißmasken'),
          withTranslations({ name: 'Palniki', slug: 'palniki', sortOrder: 4 }, 'Torches', 'Brenner'),
        ]
      }, 'Welding and soldering', 'Schweißen und Löten'),

      withSubTranslations({
        name: 'Pomiary i poziomy',
        slug: 'pomiary-poziomy',
        icon: '📏',
        sortOrder: 5,
        subcategories: [
          withTranslations({ name: 'Poziomice laserowe', slug: 'poziomica-laserowe', sortOrder: 1 }, 'Laser levels', 'Laser-Nivelliere'),
          withTranslations({ name: 'Dalmierze', slug: 'dalmierze', sortOrder: 2 }, 'Rangefinders', 'Entfernungsmesser'),
          withTranslations({ name: 'Mierniki laserowe', slug: 'mierniki-laserowe', sortOrder: 3 }, 'Laser meters', 'Laser-Messgeräte'),
          withTranslations({ name: 'Taśmy miernicze', slug: 'tasmy-miernicze', sortOrder: 4 }, 'Measuring tapes', 'Maßbänder'),
        ]
      }, 'Measurement', 'Messung'),
    ]
  },
  'Tools and Industry',
  'Power tools, safety, industrial accessories',
  'Werkzeuge und Industrie',
  'Elektrowerkzeuge, Arbeitsschutz, Industrie-Zubehör'
  ),

  withCatTranslations({
    name: 'Supermarket i codzienne zakupy',
    slug: 'supermarket-codzienne-zakupy',
    icon: '🛒',
    description: 'Artykuły spożywcze, napoje, chemia domowa i higiena',
    sortOrder: 16,
    subcategories: [
      withSubTranslations({
        name: 'Artykuły spożywcze',
        slug: 'artykuly-spozywcze',
        icon: '🥫',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Kawa i herbata', slug: 'kawa-herbata', sortOrder: 1 }, 'Coffee and tea', 'Kaffee und Tee'),
          withTranslations({ name: 'Przekąski i słodycze', slug: 'przekaski-slodycze', sortOrder: 2 }, 'Snacks and sweets', 'Snacks und Süßigkeiten'),
          withTranslations({ name: 'Dania gotowe', slug: 'dania-gotowe', sortOrder: 3 }, 'Ready meals', 'Fertiggerichte'),
          withTranslations({ name: 'Produkty instant', slug: 'produkty-instant', sortOrder: 4 }, 'Instant products', 'Instantprodukte'),
          withTranslations({ name: 'Przyprawy i dodatki', slug: 'przyprawy-dodatki', sortOrder: 5 }, 'Spices and additives', 'Gewürze und Zusätze'),
        ]
      }, 'Groceries', 'Lebensmittel'),

      withSubTranslations({
        name: 'Napoje',
        slug: 'napoje',
        icon: '🥤',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Woda i napoje izotoniczne', slug: 'woda-izotoniki', sortOrder: 1 }, 'Water and isotonic drinks', 'Wasser und Isogetränke'),
          withTranslations({ name: 'Napoje gazowane', slug: 'napoje-gazowane', sortOrder: 2 }, 'Carbonated drinks', 'Kohlensäurehaltige Getränke'),
          withTranslations({ name: 'Soki', slug: 'soki', sortOrder: 3 }, 'Juices', 'Säfte'),
          withTranslations({ name: 'Napoje energetyczne', slug: 'napoje-energetyczne', sortOrder: 4 }, 'Energy drinks', 'Energy-Drinks'),
        ]
      }, 'Drinks', 'Getränke'),

      withSubTranslations({
        name: 'Chemia gospodarcza',
        slug: 'chemia-gospodarcza',
        icon: '🧴',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Detergenty do prania', slug: 'detergenty-pranie', sortOrder: 1 }, 'Laundry detergents', 'Waschmittel'),
          withTranslations({ name: 'Płyny do mycia naczyń', slug: 'plyny-mycie-naczyn', sortOrder: 2 }, 'Dishwashing liquids', 'Spülmittel'),
          withTranslations({ name: 'Środki do czyszczenia', slug: 'srodki-czyszczenia', sortOrder: 3 }, 'Cleaning products', 'Reinigungsmittel'),
          withTranslations({ name: 'Akcesoria do sprzątania', slug: 'akcesoria-sprzatanie', sortOrder: 4 }, 'Cleaning accessories', 'Reinigungszubehör'),
        ]
      }, 'Household chemicals', 'Haushaltschemie'),

      withSubTranslations({
        name: 'Higiena codzienna',
        slug: 'higiena-codzienna',
        icon: '🧻',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Mydła i żele', slug: 'mydla-zele', sortOrder: 1 }, 'Soaps and gels', 'Seifen und Gele'),
          withTranslations({ name: 'Pasty i szczoteczki do zębów', slug: 'pasty-szczoteczki-zeby', sortOrder: 2 }, 'Toothpaste and toothbrushes', 'Zahnpasta und Zahnbürsten'),
          withTranslations({ name: 'Papier toaletowy i ręczniki', slug: 'papier-reczniki', sortOrder: 3 }, 'Toilet paper and towels', 'Toilettenpapier und Handtücher'),
          withTranslations({ name: 'Artykuły higieniczne', slug: 'artykuly-higieniczne', sortOrder: 4 }, 'Hygiene products', 'Hygieneprodukte'),
        ]
      }, 'Daily hygiene', 'Tägliche Hygiene'),
    ]
  },
  'Supermarket and Daily Shopping',
  'Groceries, beverages, household chemicals and hygiene essentials',
  'Supermarkt und tägliche Einkäufe',
  'Lebensmittel, Getränke, Haushaltschemie und Hygieneartikel'
  ),

  withCatTranslations({
    name: 'Ślub i imprezy',
    slug: 'slub-imprezy',
    icon: '🎉',
    description: 'Dekoracje okolicznościowe, akcesoria ślubne i imprezowe',
    sortOrder: 17,
    subcategories: [
      withSubTranslations({
        name: 'Dekoracje imprezowe',
        slug: 'dekoracje-imprezowe',
        icon: '🎈',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Balony i girlandy', slug: 'balony-girlandy', sortOrder: 1 }, 'Balloons and garlands', 'Ballons und Girlanden'),
          withTranslations({ name: 'Dekoracje stołu', slug: 'dekoracje-stolu', sortOrder: 2 }, 'Table decorations', 'Tischdekoration'),
          withTranslations({ name: 'Świece i konfetti', slug: 'swiece-konfetti', sortOrder: 3 }, 'Candles and confetti', 'Kerzen und Konfetti'),
          withTranslations({ name: 'Banery i ozdoby', slug: 'banery-ozdoby', sortOrder: 4 }, 'Banners and ornaments', 'Banner und Deko'),
        ]
      }, 'Party decorations', 'Partydekoration'),

      withSubTranslations({
        name: 'Akcesoria ślubne',
        slug: 'akcesoria-slubne',
        icon: '💍',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Dekoracje ślubne', slug: 'dekoracje-slubne', sortOrder: 1 }, 'Wedding decorations', 'Hochzeitsdekoration'),
          withTranslations({ name: 'Akcesoria dla pary młodej', slug: 'akcesoria-para-mloda', sortOrder: 2 }, 'Bride and groom accessories', 'Brautpaar-Accessoires'),
          withTranslations({ name: 'Upominki dla gości', slug: 'upominki-goscie', sortOrder: 3 }, 'Guest favors', 'Gastgeschenke'),
          withTranslations({ name: 'Papeteria ślubna', slug: 'papeteria-slubna', sortOrder: 4 }, 'Wedding stationery', 'Hochzeitspapeterie'),
        ]
      }, 'Wedding accessories', 'Hochzeitszubehör'),

      withSubTranslations({
        name: 'Kostiumy i przebrania',
        slug: 'kostiumy-przebrania',
        icon: '🦸',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Kostiumy dla dorosłych', slug: 'kostiumy-dorosli', sortOrder: 1 }, 'Adult costumes', 'Kostüme für Erwachsene'),
          withTranslations({ name: 'Kostiumy dla dzieci', slug: 'kostiumy-dzieci', sortOrder: 2 }, 'Kids costumes', 'Kostüme für Kinder'),
          withTranslations({ name: 'Maski i peruki', slug: 'maski-peruki', sortOrder: 3 }, 'Masks and wigs', 'Masken und Perücken'),
          withTranslations({ name: 'Akcesoria do przebrań', slug: 'akcesoria-przebrania', sortOrder: 4 }, 'Costume accessories', 'Kostümzubehör'),
        ]
      }, 'Costumes and outfits', 'Kostüme und Verkleidungen'),
    ]
  },
  'Weddings and Parties',
  'Party decorations, wedding accessories and costumes',
  'Hochzeit und Party',
  'Partydekoration, Hochzeitszubehör und Kostüme'
  ),

  withCatTranslations({
    name: 'Bezpieczeństwo i ochrona',
    slug: 'bezpieczenstwo-ochrona',
    icon: '🛡️',
    description: 'Monitoring, kontrola dostępu, alarmy i ochrona osobista',
    sortOrder: 18,
    subcategories: [
      withSubTranslations({
        name: 'Monitoring i CCTV',
        slug: 'monitoring-cctv',
        icon: '📹',
        sortOrder: 1,
        subcategories: [
          withTranslations({ name: 'Kamery zewnętrzne', slug: 'kamery-zewnetrzne', sortOrder: 1, importKeywords: ['outdoor security camera', 'cctv camera'] }, 'Outdoor cameras', 'Außenkameras'),
          withTranslations({ name: 'Kamery wewnętrzne', slug: 'kamery-wewnetrzne', sortOrder: 2 }, 'Indoor cameras', 'Innenkameras'),
          withTranslations({ name: 'Rejestratory NVR/DVR', slug: 'rejestratory-nvr-dvr', sortOrder: 3 }, 'NVR/DVR recorders', 'NVR/DVR-Rekorder'),
          withTranslations({ name: 'Zestawy monitoringu', slug: 'zestawy-monitoringu', sortOrder: 4 }, 'Surveillance kits', 'Überwachungssets'),
        ]
      }, 'Monitoring and CCTV', 'Überwachung und CCTV'),

      withSubTranslations({
        name: 'Kontrola dostępu',
        slug: 'kontrola-dostepu',
        icon: '🚪',
        sortOrder: 2,
        subcategories: [
          withTranslations({ name: 'Wideodomofony', slug: 'wideodomofony', sortOrder: 1 }, 'Video intercoms', 'Video-Gegensprechanlagen'),
          withTranslations({ name: 'Czytniki RFID', slug: 'czytniki-rfid', sortOrder: 2 }, 'RFID readers', 'RFID-Leser'),
          withTranslations({ name: 'Elektrozaczepy i zamki', slug: 'elektrozaczepy-zamki', sortOrder: 3 }, 'Electric strikes and locks', 'Elektrische Türöffner und Schlösser'),
          withTranslations({ name: 'Systemy kodowe', slug: 'systemy-kodowe', sortOrder: 4 }, 'Keypad systems', 'Codeschlosssysteme'),
        ]
      }, 'Access control', 'Zutrittskontrolle'),

      withSubTranslations({
        name: 'Alarmy i czujniki',
        slug: 'alarmy-czujniki',
        icon: '🚨',
        sortOrder: 3,
        subcategories: [
          withTranslations({ name: 'Centrale alarmowe', slug: 'centrale-alarmowe', sortOrder: 1 }, 'Alarm control panels', 'Alarmzentralen'),
          withTranslations({ name: 'Czujniki ruchu i otwarcia', slug: 'czujniki-ruchu-otwarcia', sortOrder: 2 }, 'Motion and door sensors', 'Bewegungs- und Türsensoren'),
          withTranslations({ name: 'Czujniki dymu i gazu', slug: 'czujniki-dymu-gazu', sortOrder: 3 }, 'Smoke and gas detectors', 'Rauch- und Gasmelder'),
          withTranslations({ name: 'Syreny i moduły GSM', slug: 'syreny-moduly-gsm', sortOrder: 4 }, 'Sirens and GSM modules', 'Sirenen und GSM-Module'),
        ]
      }, 'Alarms and sensors', 'Alarme und Sensoren'),

      withSubTranslations({
        name: 'Ochrona osobista',
        slug: 'ochrona-osobista',
        icon: '🦺',
        sortOrder: 4,
        subcategories: [
          withTranslations({ name: 'Latarki taktyczne', slug: 'latarki-taktyczne', sortOrder: 1 }, 'Tactical flashlights', 'Taktische Taschenlampen'),
          withTranslations({ name: 'Kamizelki i ochraniacze', slug: 'kamizelki-ochraniacze', sortOrder: 2 }, 'Vests and protectors', 'Westen und Schutzausrüstung'),
          withTranslations({ name: 'Sejfy i skrytki', slug: 'sejfy-skrytki', sortOrder: 3 }, 'Safes and lockboxes', 'Safes und Geldkassetten'),
          withTranslations({ name: 'Akcesoria bezpieczeństwa', slug: 'akcesoria-bezpieczenstwa', sortOrder: 4 }, 'Safety accessories', 'Sicherheitszubehör'),
        ]
      }, 'Personal safety', 'Persönliche Sicherheit'),
    ]
  },
  'Safety and Security',
  'Monitoring, access control, alarms and personal safety',
  'Sicherheit und Schutz',
  'Überwachung, Zutrittskontrolle, Alarmanlagen und persönlicher Schutz'
  ),
];

export default CATEGORY_SEEDS;