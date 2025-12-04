/**
 * Telegram Broadcaster for Hot Deals
 * 
 * Sends formatted messages to Telegram channel when deals get hot (temperature > 100)
 * Uses fetch API (no SDK needed) for lightweight integration
 */

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
}

export interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat?: { id: number };
  };
  error_code?: number;
  description?: string;
}

/**
 * Send message to Telegram channel
 */
export async function sendTelegramMessage(
  message: TelegramMessage
): Promise<TelegramResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    const data = (await response.json()) as TelegramResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        `Telegram API error: ${data.description || response.statusText}`
      );
    }

    return data;
  } catch (error: any) {
    console.error('[Telegram] Failed to send message:', error.message);
    throw error;
  }
}

/**
 * Format deal into Telegram message
 */
export function formatDealMessage(deal: any): string {
  const title = deal.title || 'Unknown Deal';
  const price = deal.price ? `PLN ${deal.price.toFixed(2)}` : 'N/A';
  const original = deal.originalPrice
    ? `PLN ${deal.originalPrice.toFixed(2)}`
    : null;
  const discountPercent =
    (deal.originalPrice ?? 0) > 0
      ? Math.round(((Number(deal.originalPrice ?? 0) - Number(deal.price ?? 0)) / Number(deal.originalPrice ?? 0)) * 100)
      : 0;
  const temp = deal.temperature || 0;
  const link = `https://okazje.plus/deals/${deal.id}`;

  let discount_badge = '';
  if (discountPercent > 0) {
    discount_badge = ` <b>-${discountPercent}%</b>`;
  }

  let temp_emoji = '❄️';
  if (temp >= 100) temp_emoji = '🔥';
  if (temp >= 200) temp_emoji = '🌡️🔥';

  const message = `
${temp_emoji} <b>${title}</b>${discount_badge}

💰 <b>Cena:</b> ${price}${original ? ` <strike>${original}</strike>` : ''}
🌡️ <b>Gorący:</b> ${temp}°

<a href="${link}">👉 Zobacz okazję</a>
  `.trim();

  return message;
}

/**
 * Broadcast hot deal
 */
export async function broadcastHotDeal(deal: any): Promise<boolean> {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    console.warn('[Telegram] TELEGRAM_CHAT_ID not set, skipping');
    return false;
  }

  try {
    const text = formatDealMessage(deal);

    const result = await sendTelegramMessage({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    console.log('[Telegram] ✓ Sent to channel:', result.result?.message_id);
    return true;
  } catch (error) {
    console.error('[Telegram] Failed to broadcast deal:', error);
    return false;
  }
}
