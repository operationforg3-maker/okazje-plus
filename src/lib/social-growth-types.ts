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
 * Usuwa formatowanie Markdown (w szczególności podwójne gwiazdki **pogrubienie**,
 * pojedyncze gwiazdki *kursywa*, znaczniki nagłówków ### oraz markdownowe linki),
 * ponieważ Facebook NIE interpretuje Markdownu i wyświetla brzydkie znaki '**'.
 * Ujednolica także punktor na estetyczne kropki '• '.
 */
export function sanitizeSocialPostText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Zamień nagłówki Markdown '### Tytuł' lub '## Tytuł' na czysty tekst
  cleaned = cleaned.replace(/^#{1,6}\s*(.*?)$/gm, '$1');

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

  // 6. Usuń wielokrotne puste linie (maksymalnie dwie pod rząd)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 7. Bezpieczeństwo końcowe: usuń pojedyncze wiszące gwiazdki **
  cleaned = cleaned.replace(/\*\*/g, '');

  return cleaned.trim();
}

