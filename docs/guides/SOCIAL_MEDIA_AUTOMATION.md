# Social Media Automation - Setup Guide

## 📋 Przegląd

System automatyzacji postowania na social media pozwala na automatyczne publikowanie najlepszych okazji i produktów na platformach społecznościowych z minimalnym nadzorem.

## 🎯 Funkcje

- ✅ Automatyczne publikowanie deals i products
- ✅ Kolejkowanie postów z ręcznym zatwierdzaniem (opcjonalne)
- ✅ Szablony treści z placeholderami
- ✅ UTM tracking dla każdej platformy
- ✅ Rate limiting (max X postów/dzień na platformę)
- ✅ Retry mechanizm dla failed posts
- ✅ Logi i statystyki

## 🔧 Wspierane platformy

| Platforma | Status | API Version | Wymagania |
|-----------|--------|-------------|-----------|
| Facebook | ✅ Ready | Graph API v19 | Page Access Token + Page ID |
| Instagram | ✅ Ready | Graph API v19 | Connected to Facebook Page |
| Twitter/X | ✅ Ready | API v2 | Bearer Token |
| LinkedIn | ✅ Ready | v2 | OAuth 2.0 + Organization ID |
| TikTok | 🚧 Coming soon | - | - |

## 📦 Architektura

```
User/System Trigger
        ↓
    Queue Post (socialPosts collection)
        ↓
    Status: pending → approved (manual/auto)
        ↓
    Cloud Function (social-poster) - cron co 5 min
        ↓
    Platform API → Post published
        ↓
    Status: posted (with platformPostId)
        ↓
    socialPostLogs collection (audit trail)
```

## 🔑 Jak uzyskać tokeny

### 1. Facebook Page Access Token

#### Krok 1: Utwórz Facebook App
1. Przejdź do https://developers.facebook.com/apps
2. **Create App** → **Business** → **Nazwa: Okazje+ Social**
3. W App Dashboard: **Add Product** → **Facebook Login**

#### Krok 2: Uzyskaj Page Access Token
1. **Tools** → **Graph API Explorer**
2. **Permissions** → Dodaj:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
3. **Generate Access Token** → **Get User Access Token**
4. Skopiuj token (ważny 1-2h)

#### Krok 3: Zamień na Long-Lived Page Token
```bash
# 1. Zamień User Token na Long-Lived User Token (60 dni)
curl -X GET "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_USER_TOKEN"

# 2. Pobierz listę stron
curl -X GET "https://graph.facebook.com/v19.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN"

# 3. Użyj access_token z odpowiedzi (to jest Page Access Token - nigdy nie wygasa!)
```

#### Krok 4: Znajdź Page ID
1. Idź na swoją stronę Facebook
2. **Settings** → **About** → skopiuj **Page ID**

**LUB** użyj Graph API:
```bash
curl -X GET "https://graph.facebook.com/v19.0/me/accounts?access_token=USER_TOKEN"
```

#### Dodaj w panelu admin:
```
Platform: Facebook
Access Token: EAAx... (Page Access Token)
Page ID: 123456789012345
```

---

### 2. Instagram Business Account

Instagram używa Facebook Graph API, więc potrzebujesz:

#### Wymagania:
- Instagram Business Account (nie Personal!)
- Połączony z Facebook Page
- Ten sam Page Access Token co Facebook

#### Krok 1: Połącz Instagram z Facebook Page
1. W ustawieniach Facebook Page: **Instagram** → **Connect Account**
2. Zaloguj się do Instagram Business

#### Krok 2: Pobierz Instagram Account ID
```bash
curl -X GET "https://graph.facebook.com/v19.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_ACCESS_TOKEN"
```

#### Dodaj w panelu admin:
```
Platform: Instagram
Access Token: EAAx... (ten sam co Facebook)
Page ID: Instagram Account ID (z API response)
```

---

### 3. Twitter/X Bearer Token

#### Krok 1: Utwórz Twitter App
1. Przejdź do https://developer.twitter.com/en/portal/dashboard
2. **Create Project** → **Okazje+ Social**
3. **Create App** → **Production**

#### Krok 2: Uzyskaj Bearer Token
1. W App Settings: **Keys and Tokens**
2. **Bearer Token** → **Generate** (lub użyj istniejącego)
3. Skopiuj Bearer Token (`AAAAAxxxxx...`)

#### Krok 3: Enable OAuth 2.0 (dla postowania)
1. **Settings** → **User authentication settings** → **Set up**
2. **Type of App**: Web App
3. **Callback URL**: `https://okazjeplus.pl/api/auth/twitter/callback`
4. **Website URL**: `https://okazjeplus.pl`
5. **Permissions**: Read and Write
6. Save

#### Krok 4: OAuth 2.0 Access Token (do postowania)
```bash
# Redirect user to:
https://twitter.com/i/oauth2/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=CALLBACK_URL&scope=tweet.read%20tweet.write%20users.read&state=state&code_challenge=challenge&code_challenge_method=plain

# Exchange code for token:
curl -X POST "https://api.twitter.com/2/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "code=AUTH_CODE&grant_type=authorization_code&redirect_uri=CALLBACK_URL&code_verifier=challenge"
```

**Łatwiejszy sposób (dla testów):**
Użyj OAuth 1.0a z API Key/Secret + Access Token/Secret:
1. **Keys and Tokens** → **Access Token and Secret** → **Generate**
2. Zapisz wszystkie 4 klucze

#### Dodaj w panelu admin:
```
Platform: Twitter
Access Token: <OAuth 2.0 Access Token lub OAuth 1.0a Access Token>
Account ID: <Twój @username lub user ID>
```

---

### 4. LinkedIn Organization

#### Krok 1: Utwórz LinkedIn App
1. Przejdź do https://www.linkedin.com/developers/apps
2. **Create app**
   - **App name**: Okazje+ Social
   - **LinkedIn Page**: Wybierz swoją Company Page
3. W **Products** → Request access do **Share on LinkedIn** i **Sign In with LinkedIn**

#### Krok 2: Skonfiguruj OAuth
1. **Auth** tab:
   - **Redirect URLs**: `https://okazjeplus.pl/api/auth/linkedin/callback`
   - **Scopes**: `w_member_social`, `r_liteprofile`, `r_organization_social`, `w_organization_social`

#### Krok 3: Uzyskaj Access Token (OAuth 2.0 flow)
```bash
# 1. Redirect user to:
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=CALLBACK_URL&scope=w_member_social%20w_organization_social

# 2. Exchange code for token:
curl -X POST "https://www.linkedin.com/oauth/v2/accessToken" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=CALLBACK_URL&client_id=CLIENT_ID&client_secret=CLIENT_SECRET"
```

#### Krok 4: Pobierz Organization ID
```bash
curl -X GET "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id)))" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

#### Dodaj w panelu admin:
```
Platform: LinkedIn
Access Token: <OAuth 2.0 Access Token>
Organization ID: urn:li:organization:123456789
```

---

## 🔒 Bezpieczeństwo tokenów

**⚠️ WAŻNE: Tokeny w Secret Manager, NIE w env vars!**

### Setup dla Cloud Functions:

1. Dodaj tokeny do GCP Secret Manager:
```bash
# Facebook
echo -n "EAAx..." | gcloud secrets create facebook-page-token --data-file=-

# Instagram  
echo -n "EAAx..." | gcloud secrets create instagram-page-token --data-file=-

# Twitter
echo -n "AAAAAx..." | gcloud secrets create twitter-bearer-token --data-file=-

# LinkedIn
echo -n "AQVx..." | gcloud secrets create linkedin-access-token --data-file=-
```

2. Grant access do Cloud Function:
```bash
gcloud secrets add-iam-policy-binding facebook-page-token \
    --member="serviceAccount:okazje-plus@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

3. W Cloud Function (`okazje-plus/src/social-poster.ts`):
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/okazje-plus/secrets/${name}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

const fbToken = await getSecret('facebook-page-token');
```

---

## 📝 Szablony postów

### Placeholder dostępne:
- `{title}` - Tytuł okazji/produktu
- `{description}` - Opis (skrócony)
- `{price}` - Cena (formatowana: "99 zł")
- `{url}` - Link (z UTM tracking)
- `{merchant}` - Nazwa sklepu
- `{temperature}` - Temperature (np. "450°")
- `{category}` - Kategoria

### Przykładowe szablony:

**Facebook (max 63,206 znaków):**
```
🔥 {title}

💰 Cena: {price}
🏪 {merchant}
🌡️ Hot-o-metr: {temperature}

Kliknij i sprawdź: {url}

#okazje #promocje #oszczedzanie
```

**Twitter/X (max 280 znaków):**
```
🔥 {title}
💰 {price} w {merchant}
🌡️ {temperature}

{url}

#okazje #deals
```

**LinkedIn (max 3000 znaków):**
```
Odkryliśmy świetną okazję na {category}!

{title}

💰 Cena: {price}
🏪 Dostępne w: {merchant}

Zobacz szczegóły: {url}
```

**Instagram (max 2200 znaków + obraz wymagany):**
```
🔥 HOT DEAL! 🔥

{title}

💰 {price}
🏪 {merchant}

Link w bio! 👆

#okazje #promocje #zakupy #oszczedzanie #polskiinternet
```

---

## 🤖 Cloud Function - Auto Poster

Plik: `okazje-plus/src/social-poster.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export const socialPoster = functions
  .region('europe-west1')
  .pubsub.schedule('every 5 minutes')
  .onRun(async (context) => {
    const db = admin.firestore();
    const secretClient = new SecretManagerServiceClient();

    // Get pending/approved posts
    const postsSnap = await db.collection('socialPosts')
      .where('status', 'in', ['approved'])
      .orderBy('createdAt', 'asc')
      .limit(10)
      .get();

    for (const postDoc of postsSnap.docs) {
      const post = postDoc.data();
      
      try {
        // Get platform config
        const configDoc = await db.collection('socialConfig').doc(post.platform).get();
        const config = configDoc.data();
        
        if (!config?.enabled) continue;
        
        // Check rate limit
        const recentPosts = await db.collection('socialPosts')
          .where('platform', '==', post.platform)
          .where('status', '==', 'posted')
          .where('postedAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .get();
        
        if (recentPosts.size >= config.settings.maxPostsPerDay) continue;
        
        // Get token from Secret Manager
        const token = await getSecret(secretClient, `${post.platform}-page-token`);
        
        // Post to platform
        await updateStatus(postDoc.ref, 'posting');
        
        let platformPostId;
        switch (post.platform) {
          case 'facebook':
            platformPostId = await postToFacebook(token, config.credentials.pageId, post);
            break;
          case 'twitter':
            platformPostId = await postToTwitter(token, post);
            break;
          case 'linkedin':
            platformPostId = await postToLinkedIn(token, config.credentials.organizationId, post);
            break;
        }
        
        await updateStatus(postDoc.ref, 'posted', { platformPostId });
        
      } catch (error: any) {
        console.error(`Error posting to ${post.platform}:`, error);
        await updateStatus(postDoc.ref, 'failed', { 
          error: { 
            code: error.code || 'UNKNOWN',
            message: error.message,
            details: error.response?.data
          },
          attempts: (post.attempts || 0) + 1
        });
      }
    }
  });

async function postToFacebook(token: string, pageId: string, post: any) {
  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${pageId}/feed`,
    {
      message: post.content.text,
      link: post.content.linkUrl,
      ...(post.content.imageUrl && { picture: post.content.imageUrl })
    },
    {
      params: { access_token: token }
    }
  );
  return response.data.id;
}

async function postToTwitter(token: string, post: any) {
  const response = await axios.post(
    'https://api.twitter.com/2/tweets',
    {
      text: post.content.text + '\n\n' + post.content.linkUrl
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data.data.id;
}

async function postToLinkedIn(token: string, orgId: string, post: any) {
  const response = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: orgId,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.content.text },
          shareMediaCategory: 'ARTICLE',
          media: [{
            status: 'READY',
            originalUrl: post.content.linkUrl,
            ...(post.content.imageUrl && {
              thumbnails: [{ url: post.content.imageUrl }]
            })
          }]
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    },
    {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    }
  );
  return response.headers['x-restli-id'];
}
```

### Deploy Cloud Function:
```bash
cd okazje-plus
npm run deploy:functions
```

---

## 🚦 Flow użycia

### 1. Konfiguracja w panelu admin
1. Przejdź do **Admin** → **Marketing** → **Social Media**
2. Dla każdej platformy:
   - Włącz platformę (toggle)
   - Wklej Access Token
   - Wklej Page ID / Organization ID
   - Ustaw czy auto-post (bez zatwierdzania)
   - Ustaw częstotliwość postów
3. **Zapisz**

### 2. Automatyczne dodawanie do kolejki
W przyszłości: Hook w `src/lib/data.ts` po utworzeniu deala/produktu:
```typescript
// Po addDeal() / addProduct()
if (deal.temperature > 500) {
  await createSocialPost('facebook', 'deal', dealId, dealData, content);
}
```

### 3. Ręczne dodawanie (tymczasowo)
W panelu **Social Media** → **Kolejka** → **Dodaj Post**

### 4. Zatwierdzanie (jeśli autoPost = false)
- Status `pending` → kliknij ✓ → status `approved`
- Cloud Function pobierze i opublikuje

### 5. Monitoring
- **Kolejka** tab: zobacz pending/approved/posted/failed
- **Logi**: zobacz historię akcji dla każdego posta
- **Stats**: zobacz ile postów opublikowano

---

## 🔍 Testowanie

### Test tokena Facebook:
```bash
curl "https://graph.facebook.com/v19.0/me?access_token=YOUR_PAGE_TOKEN"
# Should return page info
```

### Test posta Facebook:
```bash
curl -X POST "https://graph.facebook.com/v19.0/PAGE_ID/feed" \
  -d "message=Test post from Okazje+" \
  -d "link=https://okazjeplus.pl" \
  -d "access_token=YOUR_PAGE_TOKEN"
```

### Test tokena Twitter:
```bash
curl "https://api.twitter.com/2/users/me" \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN"
```

### Test posta Twitter:
```bash
curl -X POST "https://api.twitter.com/2/tweets" \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test tweet from Okazje+ https://okazjeplus.pl"}'
```

---

## 📊 Metryki do monitorowania

- **Posts per day** per platform
- **Success rate** (posted / total)
- **Average time in queue** (created → posted)
- **Error rate** per platform
- **CTR from social** (via UTM in GA4)

---

## 🐛 Troubleshooting

### "Invalid OAuth access token"
- Token wygasł → wygeneruj nowy (Facebook Page Tokens nie wygasają jeśli prawidłowo wygenerowane)
- Sprawdź czy to Page Token, nie User Token

### "OAuthException: (#200) Permissions error"
- Brakujące permissions → dodaj w Graph API Explorer i regeneruj token
- Wymagane: `pages_manage_posts`, `pages_read_engagement`

### "403 Forbidden" (Twitter)
- App nie ma uprawnień Write → enable w App Settings
- Użyj OAuth 2.0 Access Token, nie Bearer Token (Bearer jest read-only)

### "Rate limit exceeded"
- Facebook: 200 calls/hour per User, 4800 calls/hour per App
- Twitter: 300 tweets/3h, 50 tweets/15min
- LinkedIn: 100 posts/day per Organization
- Zwiększ `postFrequency` w config

### Posts nie są publikowane
- Sprawdź czy Cloud Function `socialPoster` jest deployed
- Sprawdź logi: `gcloud functions logs read socialPoster --region=europe-west1`
- Sprawdź czy platform `enabled = true` w config

---

## 🎯 Roadmap

- ✅ Basic queue system
- ✅ Facebook/Instagram support
- ✅ Twitter/X support  
- ✅ LinkedIn support
- ⬜ TikTok support
- ⬜ Automatic post generation (AI-powered)
- ⬜ A/B testing templates
- ⬜ Optimal posting time (ML)
- ⬜ Reply automation
- ⬜ Engagement tracking

---

**Questions? Check docs or ask in #social-media channel!** 🚀
