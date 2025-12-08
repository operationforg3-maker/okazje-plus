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

export default CATEGORY_SEEDS;