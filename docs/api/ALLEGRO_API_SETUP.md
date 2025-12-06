# Allegro API Integration Setup

## 📌 Overview

Allegro integration uses **OAuth 2.0** for authentication. Unlike AliExpress (which uses API keys), Allegro requires:
1. OAuth 2.0 credentials (app_key, app_secret)
2. User authorization via callback
3. Token storage in Firestore
4. Periodic token refresh

## �� Required Setup

### 1. Register Application on Allegro Developer Portal
- Visit: https://developer.allegro.pl
- Create an application
- Get your **app_key** and **app_secret**

### 2. Environment Variables (App Hosting / .env.local)
```bash
# Allegro OAuth (for app hosting secrets)
ALLEGRO_APP_KEY=your_app_key_here
ALLEGRO_APP_SECRET=your_app_secret_here
ALLEGRO_SANDBOX=false  # Set to true for testing
```

### 3. Firestore Setup
Tokens are stored in `oauthTokens` collection with structure:
```typescript
{
  vendorId: "allegro",
  accountName: "seller_username",  // Allegro seller account
  accessToken: "...",
  refreshToken: "...",
  expiresAt: Timestamp,
  obtainedAt: Timestamp,
  lastRefreshedAt: Timestamp
}
```

### 4. OAuth Redirect URI
Register this redirect URI in Allegro Developer Portal:
```
https://your-domain.com/api/oauth/callback/allegro
```

## 🔄 Authentication Flow

1. User clicks "Connect Allegro" in admin panel
2. Redirects to: `https://allegro.pl/auth/oauth?client_id=...&redirect_uri=...`
3. User authorizes app on Allegro
4. Redirected back to your callback endpoint
5. Exchange authorization code for access token
6. Store token in Firestore
7. Ready to use API!

## 🧪 Testing

### Sandbox Mode
```bash
# Use sandbox for testing:
ALLEGRO_SANDBOX=true
```

Sandbox API: `https://api.allegro.pl.allegrosandbox.pl`

### Test Credentials
Contact Allegro support for sandbox seller account credentials.

## 📞 API Rate Limits

- Rate limit: 60 requests/minute (check rate limit headers)
- Implementation: Automatic rate limit checking in client
- Auto-retry on rate limit: Yes (with exponential backoff)

## 🐛 Troubleshooting

**"No valid OAuth token available"**
- Token expired → needs refresh
- User hasn't authorized app → redirect to OAuth flow
- Check Firestore `oauthTokens` collection

**"Rate limit exceeded"**
- Wait 60 seconds
- Reduce batch size
- Implement caching (already done! ✅)

**Sandbox vs Production**
- Sandbox: `ALLEGRO_SANDBOX=true`
- Production: `ALLEGRO_SANDBOX=false`

## 📄 Implementation Files

- **Client**: `src/integrations/allegro/client.ts` (123 KB)
- **OAuth**: `src/lib/oauth.ts` (multi-vendor support)
- **Types**: `src/integrations/allegro/types.ts`
- **Ingest**: `src/integrations/allegro/ingest.ts` (Smart Import integration ✅)

## ✅ Smart Import Integration Status

Allegro importer is **fully integrated** with Smart Import pipeline:
- ✅ Quality scoring (0-100)
- ✅ Polish content generation
- ✅ 3-level category mapping
- ✅ Batch processing support
- ✅ Performance optimization (cache)

Performance: **3-5 seconds per product** (with AI processing)

---

For API documentation: https://developer.allegro.pl/documentation
For OAuth flow: https://developer.allegro.pl/auth
