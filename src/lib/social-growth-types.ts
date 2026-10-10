/**
 * social-growth-types.ts
 * Typy i utilsy wspólne dla klienta i serwera dla modułu rozwoju społeczności.
 * Plik wolny od zależności serwerowych (Node.js / Genkit).
 */

export type SocialNiche = 'general' | 'fishing' | 'baby';

export interface TargetGroupItem {
  id: string;
  name: string;
  url: string;
  category?: string;
  notes?: string;
}

export interface FbCommentItem {
  id: string;
  message: string;
  createdTime: string;
  from?: {
    id: string;
    name: string;
  };
  likeCount?: number;
  userLikes?: boolean;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
}

export interface VersusDealInput {
  title: string;
  price: string;
  oldPrice?: string;
  merchant?: string;
  imageUrl?: string;
  dealUrl: string;
}

export interface TelegramAlertPayload {
  title: string;
  price?: string;
  oldPrice?: string;
  discount?: string;
  store?: string;
  dealUrl: string;
  photoUrl?: string;
  hashtags?: string;
}

/**
 * Buduje oficjalny URL Facebook Share Dialog dla szybkiego 1-Click udostępniania w grupach.
 */
export function buildFacebookShareDialogUrl(postUrl: string, quote?: string): string {
  const base = 'https://www.facebook.com/sharer/sharer.php';
  const params = new URLSearchParams();
  params.set('u', postUrl);
  if (quote) {
    params.set('quote', quote);
  }
  return `${base}?${params.toString()}`;
}

/**
 * Usuwa z tekstu wyciekłe nagłówki promptów meta AI (np. '🎯 CHWYTLIWY NAGŁÓWEK', '🚀 KRÓTKI OPIS', itp.).
 */
export function cleanPromptMetaHeaders(text: string): string {
  if (!text) return '';
  const metaRegex = /^[^\w\n\r]*\b(?:CHWYTLIWY NAGŁÓWEK|KRÓTKI OPIS|KLUCZOWE PARAMETRY|CENY|PRO-TIP BOTA|PRO-TIP|CALL TO ACTION|HASHTAGI NA KOŃCU|DOŁĄCZ HASHTAGI|STRUKTURA I WYMOGI POSTA|ELEMENTY POSTA|DANE PRODUKTU I OKAZJI)\b.*$/gmi;
  let cleaned = text.replace(metaRegex, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

/**
 * Weryfikuje kompletność i poprawność wygenerowanego posta przed publikacją.
 * Odrzuca teksty urwane w pół słowa/zdania (np. 'Hej Łowcy! M') oraz zawierające wycieki promptu.
 */
export function isValidSocialPost(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();

  // Wymóg minimalnej długości całego posta
  if (trimmed.length < 120) return false;

  // Sprawdź czy nie zawiera surowych instrukcji promptu
  const leakedRegex = /(?:CHWYTLIWY NAGŁÓWEK|KRÓTKI OPIS|KLUCZOWE PARAMETRY|PRO-TIP BOTA|CALL TO ACTION|STRUKTURA I WYMOGI|ELEMENTY POSTA)/i;
  if (leakedRegex.test(trimmed)) return false;

  // Wyciągnij treść przed końcowymi hashtagami
  const bodyWithoutHashtags = trimmed
    .replace(/(?:#[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_\-]+\s*)+$/g, '')
    .trim();

  if (bodyWithoutHashtags.length < 70) return false;

  // Odrzuć urwane w pół słowa (np. pojedyncza wisząca litera 'M' lub 'a' na końcu)
  if (/\b[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]$/.test(bodyWithoutHashtags)) return false;

  // Odrzuć urwane w pół zdania znaki interpunkcyjne (np. wiszący przecinek, dwukropek, myślnik)
  if (/[,:\-—]\s*$/.test(bodyWithoutHashtags)) return false;

  // Post powinien kończyć się logicznie: kropka, wykrzyknik, pytajnik, wielokropek, emoji, cudzysłów lub nawias
  const endsCleanly = /[.!?:…"'\)\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]$/u.test(bodyWithoutHashtags);
  if (!endsCleanly) return false;

  return true;
}

/**
 * Usuwa formatowanie Markdown (w szczególności podwójne gwiazdki **pogrubienie**,
 * pojedyncze gwiazdki *kursywa*, znaczniki nagłówków ### oraz markdownowe linki),
 * ponieważ Facebook NIE interpretuje Markdownu i wyświetla brzydkie znaki '**'.
 * Ujednolica także punktor na estetyczne kropki '• '.
 * Usuwa również wyciekłe nagłówki szablonu promptu oraz pojedyncze wiszące hashtagi '#'.
 */
export function sanitizeSocialPostText(text: string): string {
  if (!text) return '';

  // 0. Usuń wyciekłe nagłówki promptu meta AI (np. 🎯 CHWYTLIWY NAGŁÓWEK...)
  let cleaned = cleanPromptMetaHeaders(text);

  // 1. Zamień nagłówki Markdown '### Tytuł' lub '## Tytuł' na czysty tekst (WYMAGA spacji po # aby nie niszczyć #Hashtag)
  cleaned = cleaned.replace(/^#{1,6}\s+(.*?)$/gm, '$1');

  // 2. Zamień bold Markdown **tekst** lub __tekst__ na czysty tekst
  cleaned = cleaned.replace(/\*\*([\s\S]*?)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([\s\S]*?)__/g, '$1');

  // 3. Zamień italic Markdown *tekst* lub _tekst_ na czysty tekst
  cleaned = cleaned.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, '$1$2$3');
  cleaned = cleaned.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, '$1$2$3');

  // 4. Zamień Markdownowe punktor listy (* punkt lub - punkt) na ładne '• punkt'
  cleaned = cleaned.replace(/^[\*\-]\s+/gm, '• ');

  // 5. Zamień Markdownowe linki [tekst](url) na sam tekst (url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1 ($2)');

  // 6. Usuń pojedyncze, wiszące znaki '#' (np. '# ' lub '#' na końcu tekstu)
  cleaned = cleaned.replace(/(^|\s)#(?=\s|$)/g, '$1');

  // 7. Usuń wielokrotne puste linie (maksymalnie dwie pod rząd)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 8. Bezpieczeństwo końcowe: usuń pojedyncze wiszące gwiazdki **
  cleaned = cleaned.replace(/\*\*/g, '');

  return cleaned.trim();
}


