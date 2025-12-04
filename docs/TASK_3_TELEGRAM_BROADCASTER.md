# Task 3: Telegram Hot Deal Broadcaster

**Status:** ✅ COMPLETE  
**Files:** 2 | **LOC:** ~195  
**Dependencies:** fetch (native)

## Overview

Automatic Telegram notifications for hot deals. Firebase Cloud Function trigger sends formatted messages to a Telegram channel when deals get approved or reach hot thresholds.

## Files

### `/src/integrations/telegram.ts` (80 LOC)

Telegram messaging utilities using the Bot API.

**Functions:**

- **`sendTelegramMessage(message: TelegramMessage): Promise<TelegramResponse>`**
  - Direct fetch-based HTTP POST to Telegram Bot API
  - Headers: `Content-Type: application/json`
  - Uses `TELEGRAM_BOT_TOKEN` from env
  - Returns: message_id on success, throws on error

- **`formatDealMessage(deal: any): string`**
  - Formats deal into HTML-formatted Telegram message
  - Features:
    - Temperature emoji (❄️ cold, 🔥 hot, 🌡️🔥 very hot)
    - Price with discount percentage
    - Original price strikethrough
    - Deal link with button
  - Polish text: "Cena:", "Gorący:", "Zobacz okazję"
  - Returns: HTML-formatted string

- **`broadcastHotDeal(deal: any): Promise<boolean>`**
  - Main entry point for broadcasting
  - Uses `TELEGRAM_CHAT_ID` env variable
  - Calls `sendTelegramMessage` with `parse_mode: 'HTML'`
  - Disables web page preview
  - Returns: true on success, false on failure
  - Error handling: logs but doesn't throw

### `/okazje-plus/src/triggers/telegramBroadcaster.ts` (115 LOC)

Firebase Cloud Function trigger for automatic broadcasting.

**Trigger:** `onDocumentUpdated` for `deals` collection

**Conditions for broadcast:**

1. **New approved deal**: `status` changes from ≠'approved' → 'approved'
2. **Deal went hot**: `temperature` crosses threshold 100 (< 100 → ≥ 100)

**Workflow:**

```
Deal updated in Firestore
    ↓
Check if already notified (notified === true)
    ↓
Condition 1: Status → approved?
    ├─ YES → formatDealMessage → sendTelegramMessage → update notified=true
    └─ NO → Check Condition 2
    ↓
Condition 2: Temperature ≥ 100?
    ├─ YES → formatDealMessage → sendTelegramMessage → update notified=true
    └─ NO → Skip, log reason
```

**Metadata updates:**

After successful broadcast, updates Firestore:
```typescript
{
  notified: true,
  notifiedAt: "2025-11-15T10:30:45.123Z"
}
```

**Error handling:**

- Non-throwing to preserve deal document
- Logs all conditions and decisions
- Silent skip if already notified

## Environment Variables

Required in App Hosting (Firebase Console):

```
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
TELEGRAM_CHAT_ID=<your-channel-id>
```

### Getting Telegram Bot Token

1. Talk to @BotFather on Telegram
2. `/newbot` → follow prompts → get token
3. Format: `123456789:ABCDEFGHIJKLMNOPQRSTUVWxyz`

### Getting Chat ID

1. Add bot to your channel
2. Send a message: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Look for `chat.id` in JSON response
4. Negative number for private channels: `-1001234567890`

## Message Format Example

```
🔥 Samsung Galaxy S24 Ultra -23%

💰 Cena: PLN 4499.00 PLN 5999.00
🌡️ Gorący: 157°

👉 Zobacz okazję
```

## Local Testing

```typescript
// Test via Firebase Emulator
import { broadcastHotDeal } from './integrations/telegram';

const testDeal = {
  id: 'deal-123',
  title: 'Test Deal',
  price: 99.99,
  originalPrice: 199.99,
  temperature: 150,
};

await broadcastHotDeal(testDeal);
```

## Rate Limiting

Telegram Bot API has rate limits:
- ~30 messages/second per bot
- Current implementation: no built-in rate limiting
- Recommended: add queue if volume > 100 deals/day

## Monitoring

Check function logs in Firebase Console:

```bash
firebase functions:log --region europe-west1
```

Key logs:
- `[Telegram] Deal updated` - trigger fired
- `[Telegram] Deal approved: <dealId>, broadcasting` - sending
- `[Telegram] ✓ Sent hot deal notification` - success
- `[Telegram] Failed to broadcast deal` - error

## Deployment

```bash
firebase deploy --only functions:telegramBroadcaster
```

Deployed as: `telegramBroadcaster` (europe-west1)

## Security

- Bot token in environment variables (never in code)
- Chat ID in environment variables
- All secrets in Firebase Secrets Manager
- Function not accessible via HTTP (Cloud Function only)

## Future Enhancements

- [ ] Channel subscriptions (category-based)
- [ ] User preferences (min temperature, categories)
- [ ] Message history/archives
- [ ] Rate limiting queue (BullMQ)
- [ ] Multiple channels/groups
- [ ] A/B testing message formats
