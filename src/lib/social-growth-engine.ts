/**
 * social-growth-engine.ts
 * Kompleksowy silnik automatyzacji i rozwoju społeczności dla Okazje Plus:
 * 1. AI Startery Dyskusji (Engagement Boosters)
 * 2. AI Auto-Reply na komentarze czytelników na Facebooku
 * 3. Posty typu "Pojedynek Okazji (A vs B)" z głosowaniem reakcjami
 * 4. Posty Lifestylowe / Humor / Porady dla budowania relacji
 * 5. Narzędzie 1-Click Share do Grup Facebooka + Automatyczny Crossposting do Połączonej Grupy
 * 6. Natychmiastowe powiadomienia Push na Kanał Telegram
 */

import { ai } from '@/ai/genkit';
import type {
  SocialNiche,
  TargetGroupItem,
  FbCommentItem,
  TelegramConfig,
  VersusDealInput,
  TelegramAlertPayload,
} from './social-growth-types';

export type {
  SocialNiche,
  TargetGroupItem,
  FbCommentItem,
  TelegramConfig,
  VersusDealInput,
  TelegramAlertPayload,
};

// ============================================================================
// 1. AI STARTER DYSKUSJI (ENGAGEMENT BOOSTER)
// ============================================================================

/**
 * Generuje naturalny, angażujący komentarz w imieniu Strony,
 * publikowany po poście głównym w celu pobudzenia dyskusji i algorytmu FB.
 */
export async function generateEngagementStarterComment(
  niche: SocialNiche,
  dealTitle: string,
  dealDescription?: string,
  botPersonaName?: string
): Promise<string> {
  try {
    let nicheContext = '';
    if (niche === 'fishing') {
      nicheContext = `Nisza: Wędkarstwo (spinning, grunt, karp, spławik). Grupa docelowa: zapaleni polscy wędkarze. Styl: kumpelski, z wędkarskim żargonem (np. "kij", "plecionka", "żyłka", "woda", "brania", "zaczepy").`;
    } else if (niche === 'baby') {
      nicheContext = `Nisza: Artykuły dla dzieci, niemowląt i mam. Grupa docelowa: mamy i rodzice. Styl: ciepły, pomocny, empatyczny, pytający o doświadczenia z dziećmi.`;
    } else {
      nicheContext = `Nisza: Łowcy okazji technologicznych, AGD, elektroniki i gadżetów. Grupa docelowa: smart-shopperzy. Styl: dynamiczny, pytający o opłacalność, jakość i testy.`;
    }

    const prompt = `
Jesteś animatorem społeczności na fanpage'u na Facebooku (${botPersonaName || 'Ekspert'}).
${nicheContext}

Właśnie opublikowaliśmy post o produkcie: "${dealTitle}".
${dealDescription ? `Opis produktu: ${dealDescription.slice(0, 300)}` : ''}

Twoje zadanie:
Napisz KRÓTKI (1-3 zdania), naturalny komentarz, który zadasz pod postem jako Strona, aby rozkręcić dyskusję w komentarzach (tzw. starter dyskusji).
Zasady:
- Zadaj otwarte, ciekawe pytanie do czytelników związane z używaniem tego typu sprzętu/produktu.
- Użyj 1-2 pasujących emoji.
- Nie reklamuj bezpośrednio, nie wklejaj linków ani cen — chodzi o prawdziwą dyskusję i opinie ludzi (np. "Ktoś już testował?", "Jak to wypada w porównaniu z...", "Od którego miesiąca u Was...?").
- Zwróć WYŁĄCZNIE treść komentarza.
`;

    const res = await ai.generate({
      prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    });

    if (res && res.text) {
      return res.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (err) {
    console.warn('[SocialGrowthEngine] Error generating engagement comment, fallback:', err);
  }

  // Fallback w zależności od niszy
  if (niche === 'fishing') {
    return '🎣 Panowie, testowaliście już ten sprzęt nad wodą czy wolicie klasyczne rozwiązania? Jak oceniacie w tej cenie? Piszcie w komentarzach!';
  } else if (niche === 'baby') {
    return '👶 Mamuśki, od jakiego wieku Wasze maluszki zaczęły z tego korzystać? Sprawdza się na co dzień czy leży w szafie? Dajcie znać!';
  }
  return '💬 Co sądzicie o tym modelu w tej cenie? Ktoś z Was już zamawiał z tej partii? Czekamy na Wasze opinie!';
}

// ============================================================================
// 2. AI AUTO-REPLY NA KOMENTARZE CZYTELNIKÓW
// ============================================================================

/**
 * Generuje naturalną, spersonalizowaną odpowiedź na komentarz użytkownika na FB.
 */
export async function generateAutoReplyToUserComment(
  niche: SocialNiche,
  postTitle: string,
  userComment: string,
  affiliateUrl?: string,
  botPersonaName?: string
): Promise<string> {
  try {
    const prompt = `
Jesteś oficjalnym asystentem fanpage'a na Facebooku (${botPersonaName || 'Moderator'}).
Nisza: ${niche === 'fishing' ? 'Wędkarstwo' : niche === 'baby' ? 'Dla Malucha i Mamy' : 'Okazje Plus'}.

Tytuł posta: "${postTitle}"
Komentarz użytkownika: "${userComment}"
${affiliateUrl ? `Link do oferty (możesz go podać jeśli użytkownik pyta o link/sklep): ${affiliateUrl}` : ''}

Twoje zadanie:
Napisz krótką, uprzejmą, pomocną i naturalną odpowiedź na komentarz użytkownika (1-3 zdania).
- Odpowiedz bezpośrednio na jego pytanie lub wątpliwość.
- Jeśli pyta o link, cenę lub dostępność, wskaż mu link lub wyjaśnij.
- Dodaj 1 pasujące emoji.
- Styl: przyjazny, profesjonalny i autentyczny.
- Zwróć WYŁĄCZNIE treść odpowiedzi.
`;

    const res = await ai.generate({
      prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 300,
      },
    });

    if (res && res.text) {
      return res.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (err) {
    console.warn('[SocialGrowthEngine] Error generating reply, fallback:', err);
  }

  return `Dzięki za komentarz! Jeśli szukasz szczegółów lub bezpośredniego linku, sprawdź pierwszy komentarz pod postem ⬇️ Pozdrawiamy!`;
}

// ============================================================================
// 3. POJEDYNEK OKAZJI (A vs B) - WIRUSOWE POSTY Z GŁOSOWANIEM
// ============================================================================

/**
 * Generuje post "Pojedynek Okazji (A vs B)" z wezwaniem do głosowania reakcjami na Facebooku.
 */
export async function generateVersusPost(
  niche: SocialNiche,
  dealA: VersusDealInput,
  dealB: VersusDealInput,
  botPersonaName?: string
): Promise<{ postText: string; firstComment: string }> {
  let nicheName = 'promocji';
  let emojiReactionA = '👍';
  let emojiReactionB = '❤️';

  if (niche === 'fishing') {
    nicheName = 'wędkarski';
  } else if (niche === 'baby') {
    nicheName = 'dla mam i maluchów';
  }

  const prompt = `
Napisz wirusowy, angażujący post na Facebooka w formie "WIELKIEGO POJEDYNKU OKAZJI (A vs B)".
Nisza: ${nicheName}
Persona bota: ${botPersonaName || 'Ekspert Promocji'}

PRODUKT A:
- Nazwa: ${dealA.title}
- Cena: ${dealA.price} ${dealA.oldPrice ? `(zamiast ${dealA.oldPrice})` : ''}
- Sklep: ${dealA.merchant || 'Sklep A'}
- Głosowanie: Reakcja ${emojiReactionA}

PRODUKT B:
- Nazwa: ${dealB.title}
- Cena: ${dealB.price} ${dealB.oldPrice ? `(zamiast ${dealB.oldPrice})` : ''}
- Sklep: ${dealB.merchant || 'Sklep B'}
- Głosowanie: Reakcja ${emojiReactionB}

WYMOGI POSTA:
1. 🥊 Chwytliwy, emocjonujący nagłówek (np. "🔥 POJEDYNEK GIGANTÓW! CO WYBIERASZ?").
2. 🥊 Krótki opis dlaczego ten pojedynek ma sens (oba w świetnej cenie).
3. 🥊 KARTA ZAWODNIKA A: zwięzłe zalety, cena i wezwanie do kliknięcia ${emojiReactionA}.
4. 🥊 KARTA ZAWODNIKA B: zwięzłe zalety, cena i wezwanie do kliknięcia ${emojiReactionB}.
5. 🗳️ Wyraźne wezwanie do głosowania reakcjami i uzasadnienia w komentarzach.
6. 🔗 Wezwanie do sprawdzenia linków w pierwszym komentarzu:
   "👉 Bezpośrednie linki i kody rabatowe do OBU okazji znajdziecie w PIERWSZYM KOMENTARZU ⬇️!"
7. #️⃣ Pasujące hashtagi (#pojedynek #okazje #promocje).

Nie urywaj posta! Zwróć PEŁNĄ treść posta.
`;

  let postText = '';
  try {
    const res = await ai.generate({
      prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2500,
      },
    });
    if (res && res.text) {
      postText = res.text.trim();
    }
  } catch (err) {
    console.warn('[SocialGrowthEngine] Error generating versus post:', err);
  }

  if (!postText) {
    postText = `🥊 🔥 WIELKI POJEDYNEK OKAZJI! CO WYBIERASZ? 🔥 🥊\n\n` +
      `Mamy dla Was dwa hity cenowe, ale wybór może być tylko jeden!\n\n` +
      `🔵 ZAWODNIK A: ${dealA.title}\n` +
      `💰 Cena: ${dealA.price}\n` +
      `👉 Zostaw ${emojiReactionA} jeśli wybierasz opcję A!\n\n` +
      `🔴 ZAWODNIK B: ${dealB.title}\n` +
      `💰 Cena: ${dealB.price}\n` +
      `👉 Zostaw ${emojiReactionB} jeśli wybierasz opcję B!\n\n` +
      `Napiszcie w komentarzu, dlaczego właśnie ten wybór! ⬇️\n\n` +
      `👉 Bezpośrednie linki do OBU okazji znajdziecie w PIERWSZYM KOMENTARZU ⬇️!\n\n` +
      `#pojedynek #okazjeplus #promocje #zakupy`;
  }

  const firstComment = `🔗 Bezpośrednie linki do pojedynku:\n` +
    `1️⃣ Opcja A (${dealA.title}):\n${dealA.dealUrl}\n\n` +
    `2️⃣ Opcja B (${dealB.title}):\n${dealB.dealUrl}`;

  return { postText, firstComment };
}

// ============================================================================
// 4. POST LIFESTYLOWY / HUMOR / PORADA
// ============================================================================

export async function generateLifestylePost(
  niche: SocialNiche,
  topic?: string,
  botPersonaName?: string
): Promise<string> {
  let context = '';
  if (niche === 'fishing') {
    context = `Nisza: Wędkarska. Tematyka: humor z życia wędkarza (zakupy przed żoną, wyprawa o 4:00 rano, zerwana żyłka życia, przygotowania do weekendu).`;
  } else if (niche === 'baby') {
    context = `Nisza: Rodzicielska. Tematyka: ciepły humor z życia mamy/taty (picie zimnej kawy, usypianie malucha 40 minut i skrzypiąca podłoga, sprytne triki rodzicielskie).`;
  } else {
    context = `Nisza: Łowcy okazji i gadżetów. Tematyka: syndrom kuriera, radość z rabatu -70%, testowanie niepotrzebnych gadżetów, piątkowe polowanie na okazje.`;
  }

  const prompt = `
Napisz krótki, humorystyczny i relacyjny post na fanpage Facebooka (${botPersonaName || 'Animator'}).
${context}
${topic ? `Sugerowany temat: ${topic}` : ''}

Zasady:
- Lekki, naturalny ton, budujący silną relację ze społecznością.
- Użyj odpowiednich emoji.
- Zakończ pytaniem otwartym do społeczności.
- Dodaj 3-4 hashtagi.
- Zwróć PEŁNĄ treść posta.
`;

  try {
    const res = await ai.generate({
      prompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 1500,
      },
    });
    if (res && res.text) {
      return res.text.trim();
    }
  } catch (err) {
    console.warn('[SocialGrowthEngine] Error generating lifestyle post:', err);
  }

  return `Dzień dobry łowcy! ☕ Jak Wasze plany na nadchodzący weekend? Polujecie na nowe rekordy czy odpoczynek z rodziną? Dajcie znać w komentarzu! 👇 #weekend #społeczność #okazje`;
}

// ============================================================================
// 5. FACEBOOK GRAPH API - KOMENTARZE, ODPOWIEDZI, CROPOSTING
// ============================================================================

/**
 * Publikuje komentarz pod postem na Facebooku w imieniu Strony.
 */
export async function postFacebookComment(
  postId: string,
  message: string,
  accessToken: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}/comments`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
    });
    const data = await res.json();
    if (res.ok && data.id) {
      return { success: true, commentId: data.id };
    }
    return { success: false, error: data.error?.message || 'Błąd dodawania komentarza na FB' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Pobiera ostatnie komentarze pod postem na Facebooku.
 */
export async function fetchFacebookPostComments(
  postId: string,
  accessToken: string,
  limit: number = 25
): Promise<{ success: boolean; comments: FbCommentItem[]; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}/comments?fields=id,message,created_time,from,like_count,user_likes&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && Array.isArray(data.data)) {
      const comments: FbCommentItem[] = data.data.map((c: any) => ({
        id: c.id,
        message: c.message || '',
        createdTime: c.created_time || '',
        from: c.from ? { id: c.from.id, name: c.from.name } : undefined,
        likeCount: c.like_count || 0,
        userLikes: Boolean(c.user_likes),
      }));
      return { success: true, comments };
    }
    return { success: false, comments: [], error: data.error?.message || 'Błąd pobierania komentarzy' };
  } catch (err: any) {
    return { success: false, comments: [], error: err.message };
  }
}

/**
 * Publikuje post na połączonej Grupie Facebooka zarządzanej przez Stronę.
 */
export async function shareToLinkedFacebookGroup(
  groupId: string,
  message: string,
  link?: string,
  accessToken?: string
): Promise<{ success: boolean; groupPostId?: string; error?: string }> {
  if (!groupId || !accessToken) {
    return { success: false, error: 'Brak groupId lub tokena dostępu dla grupy' };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(groupId)}/feed`;
    const body: Record<string, string> = {
      message,
      access_token: accessToken,
    };
    if (link) {
      body.link = link;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.id) {
      return { success: true, groupPostId: data.id };
    }
    return { success: false, error: data.error?.message || 'Błąd publikacji na grupie FB' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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

// ============================================================================
// 6. POWIADOMIENIA PUSH NA TELEGRAM
// ============================================================================

/**
 * Wysyła natychmiastowe powiadomienie Push z ofertą i linkiem na kanał Telegram.
 */
export async function sendTelegramPostAlert(
  botToken: string,
  chatId: string,
  payload: TelegramAlertPayload
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Brak botToken lub chatId Telegram' };
  }

  try {
    const captionLines: string[] = [
      `🔥 *${escapeTelegramMarkdown(payload.title)}*`,
      '',
    ];

    if (payload.price) {
      const priceLine = payload.oldPrice
        ? `💰 *Cena:* ${payload.price} ~(${payload.oldPrice})~`
        : `💰 *Cena:* ${payload.price}`;
      captionLines.push(priceLine);
    }

    if (payload.discount) {
      captionLines.push(`📉 *Rabat:* ${payload.discount}`);
    }
    if (payload.store) {
      captionLines.push(`🏬 *Sklep:* ${payload.store}`);
    }

    captionLines.push('');
    captionLines.push(`👉 [KLIKNIJ TUTAJ ABY PRZEJŚĆ DO OKAZJI](${payload.dealUrl})`);
    
    if (payload.hashtags) {
      captionLines.push('');
      captionLines.push(payload.hashtags);
    }

    const caption = captionLines.join('\n');

    // Jeśli mamy zdjęcie, wysyłamy sendPhoto, w przeciwnym razie sendMessage
    if (payload.photoUrl && payload.photoUrl.startsWith('http')) {
      const photoApiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      const res = await fetch(photoApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: payload.photoUrl,
          caption,
          parse_mode: 'Markdown',
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        return { success: true, messageId: data.result?.message_id };
      }
    }

    // Fallback: sendMessage
    const msgApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(msgApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      return { success: true, messageId: data.result?.message_id };
    }
    return { success: false, error: data.description || 'Błąd wysyłania na Telegram' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function escapeTelegramMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}
