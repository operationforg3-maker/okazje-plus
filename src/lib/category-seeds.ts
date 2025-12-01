/**
 * Rozbudowana struktura kategorii dla Okazje Plus
 * Inspirowana pepper.pl i AliExpress - kompletna hierarchia 3-poziomowa
 */

import { Category } from './types';

export const CATEGORY_SEEDS: Omit<Category, 'id'>[] = [
  {
    name: 'Elektronika',
    slug: 'elektronika',
    icon: '📱',
    description: 'Smartfony, komputery, akcesoria elektroniczne i sprzęt audio-wideo',
    sortOrder: 1,
    subcategories: [
      {
        name: 'Smartfony i telefony',
        slug: 'smartfony-telefony',
        icon: '📱',
        sortOrder: 1,
        subcategories: [
          { name: 'Smartfony', slug: 'smartfony', sortOrder: 1 },
          { name: 'Telefony klasyczne', slug: 'telefony-klasyczne', sortOrder: 2 },
          { name: 'Akcesoria GSM', slug: 'akcesoria-gsm', sortOrder: 3 },
          { name: 'Etui i pokrowce', slug: 'etui-pokrowce', sortOrder: 4 },
          { name: 'Ładowarki i kable', slug: 'ladowarki-kable', sortOrder: 5 },
          { name: 'Power banki', slug: 'power-banki', sortOrder: 6 },
          { name: 'Folie i szkła ochronne', slug: 'folie-szkla', sortOrder: 7 },
        ]
      },
      {
        name: 'Komputery i laptopy',
        slug: 'komputery-laptopy',
        icon: '💻',
        sortOrder: 2,
        subcategories: [
          { name: 'Laptopy', slug: 'laptopy', sortOrder: 1 },
          { name: 'Komputery stacjonarne', slug: 'komputery-stacjonarne', sortOrder: 2 },
          { name: 'Monitory', slug: 'monitory', sortOrder: 3 },
          { name: 'Dyski twarde i SSD', slug: 'dyski-ssd', sortOrder: 4 },
          { name: 'Karty graficzne', slug: 'karty-graficzne', sortOrder: 5 },
          { name: 'Procesory', slug: 'procesory', sortOrder: 6 },
          { name: 'Płyty główne', slug: 'plyty-glowne', sortOrder: 7 },
          { name: 'Pamięci RAM', slug: 'pamieci-ram', sortOrder: 8 },
          { name: 'Obudowy PC', slug: 'obudowy-pc', sortOrder: 9 },
          { name: 'Zasilacze', slug: 'zasilacze', sortOrder: 10 },
          { name: 'Chłodzenie PC', slug: 'chlodzenie-pc', sortOrder: 11 },
        ]
      },
      {
        name: 'Tablety i czytniki',
        slug: 'tablety-czytniki',
        icon: '📱',
        sortOrder: 3,
        subcategories: [
          { name: 'Tablety', slug: 'tablety', sortOrder: 1 },
          { name: 'Czytniki e-booków', slug: 'czytniki-ebookow', sortOrder: 2 },
          { name: 'Akcesoria do tabletów', slug: 'akcesoria-tablety', sortOrder: 3 },
        ]
      },
      {
        name: 'Audio i wideo',
        slug: 'audio-wideo',
        icon: '🎧',
        sortOrder: 4,
        subcategories: [
          { name: 'Słuchawki', slug: 'sluchawki', sortOrder: 1 },
          { name: 'Głośniki', slug: 'glosniki', sortOrder: 2 },
          { name: 'Soundbary', slug: 'soundbary', sortOrder: 3 },
          { name: 'Mikrofony', slug: 'mikrofony', sortOrder: 4 },
          { name: 'Amplitunery', slug: 'amplitunery', sortOrder: 5 },
          { name: 'Odtwarzacze MP3/MP4', slug: 'odtwarzacze-mp3', sortOrder: 6 },
        ]
      },
      {
        name: 'Telewizory i projektory',
        slug: 'telewizory-projektory',
        icon: '📺',
        sortOrder: 5,
        subcategories: [
          { name: 'Telewizory', slug: 'telewizory', sortOrder: 1 },
          { name: 'Projektory', slug: 'projektory', sortOrder: 2 },
          { name: 'Uchwyty do TV', slug: 'uchwyty-tv', sortOrder: 3 },
          { name: 'Anteny', slug: 'anteny', sortOrder: 4 },
        ]
      },
      {
        name: 'Fotografia i kamery',
        slug: 'fotografia-kamery',
        icon: '📷',
        sortOrder: 6,
        subcategories: [
          { name: 'Aparaty cyfrowe', slug: 'aparaty-cyfrowe', sortOrder: 1 },
          { name: 'Obiektywy', slug: 'obiektywy', sortOrder: 2 },
          { name: 'Kamery sportowe', slug: 'kamery-sportowe', sortOrder: 3 },
          { name: 'Drony', slug: 'drony', sortOrder: 4 },
          { name: 'Akcesoria fotograficzne', slug: 'akcesoria-foto', sortOrder: 5 },
          { name: 'Statywy', slug: 'statywy', sortOrder: 6 },
        ]
      },
      {
        name: 'Gaming',
        slug: 'gaming',
        icon: '🎮',
        sortOrder: 7,
        subcategories: [
          { name: 'Konsole', slug: 'konsole', sortOrder: 1 },
          { name: 'Gry wideo', slug: 'gry-wideo', sortOrder: 2 },
          { name: 'Akcesoria do konsol', slug: 'akcesoria-konsole', sortOrder: 3 },
          { name: 'Kontrolery i pada', slug: 'kontrolery-pady', sortOrder: 4 },
          { name: 'Zestawy VR', slug: 'zestawy-vr', sortOrder: 5 },
          { name: 'Fotele gamingowe', slug: 'fotele-gamingowe', sortOrder: 6 },
        ]
      },
      {
        name: 'Akcesoria komputerowe',
        slug: 'akcesoria-komputerowe',
        icon: '⌨️',
        sortOrder: 8,
        subcategories: [
          { name: 'Klawiatury', slug: 'klawiatury', sortOrder: 1 },
          { name: 'Myszki', slug: 'myszki', sortOrder: 2 },
          { name: 'Podkładki pod mysz', slug: 'podkladki-mysz', sortOrder: 3 },
          { name: 'Głośniki komputerowe', slug: 'glosniki-komputerowe', sortOrder: 4 },
          { name: 'Kamery internetowe', slug: 'kamery-internetowe', sortOrder: 5 },
          { name: 'Pendrive i karty pamięci', slug: 'pendrive-karty', sortOrder: 6 },
          { name: 'Drukarki i skanery', slug: 'drukarki-skanery', sortOrder: 7 },
        ]
      },
    ]
  },
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
        ]
      },
    ]
  },
];

export default CATEGORY_SEEDS;