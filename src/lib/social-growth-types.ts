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
