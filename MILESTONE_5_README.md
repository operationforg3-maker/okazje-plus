# Milestone 5: Personalization Engine & User Analytics

## 📋 Przegląd

Milestone 5 wprowadza zaawansowany silnik personalizacji i system analityki użytkowników dla platformy Okazje Plus. System automatycznie klasyfikuje użytkowników na podstawie ich zachowań, generuje spersonalizowane rekomendacje i dostarcza szczegółowe insighty analityczne.

## 🎯 Zaimplementowane Funkcje

### 1. Segmentacja Użytkowników

System automatycznie klasyfikuje użytkowników do 6 segmentów behawioralnych:

#### Typy Segmentów

1. **💰 Wrażliwi na cenę (price_sensitive)**
   - Preferują najniższe ceny i największe rabaty
   - Średnia wartość zakupu < 100 PLN
   - Wysokie zaangażowanie w kupony i promocje

2. **🚀 Szybka dostawa (fast_delivery)**
   - Priorytet to szybkość dostawy
   - Preferują darmową i ekspresową dostawę
   - Szybkość ważniejsza niż cena

3. **⭐ Miłośnicy marek (brand_lover)**
   - Lojalni wobec 2-3 określonych marek
   - Niska wrażliwość cenowa
   - Konsekwentne zakupy od tych samych sprzedawców

4. **🎯 Łowcy okazji (deal_hunter)**
   - Bardzo aktywni, codzienne logowania
   - Wysoki engagement (komentarze, głosy)
   - Szybka reakcja na nowe okazje

5. **✨ Poszukiwacze jakości (quality_seeker)**
   - Preferują produkty z oceną > 4.5★
   - Dłuższy czas decyzji (czytanie recenzji)
   - Wyższa średnia wartość koszyka

6. **⚡ Impulsywni kupujący (impulse_buyer)**
   - Krótki czas od wizyty do kliknięcia
   - Współczynnik konwersji > 40%
   - Często jednorazowe wizyty

#### Algorytm Klasyfikacji

```typescript
import { classifyUserSegment, getUserSegment } from '@/lib/segmentation';

// Klasyfikuj użytkownika
const segment = await classifyUserSegment(userId);

// Pobierz istniejący segment (cache 7 dni)
const cachedSegment = await getUserSegment(userId);
```

Klasyfikacja bazuje na:
- **Behavioral Scores**: 6 wymiarów (price sensitivity, brand loyalty, quality focus, speed priority, engagement, conversion)
- **Interaction History**: ostatnie 100 interakcji użytkownika
- **Category Preferences**: preferencje kategorii produktowych
- **Price Points**: średnia cena produktów, z którymi użytkownik wchodzi w interakcję

### 2. Scoring Behawioralny

System oblicza 6 wymiarów zachowań użytkownika (skala 0-100):

```typescript
import { calculateUserBehaviorScores } from '@/lib/segmentation';

const scores = await calculateUserBehaviorScores(userId);
// {
//   pricesensitivity: 85,      // Wrażliwość na cenę
//   brandLoyalty: 45,          // Lojalność wobec marek
//   qualityFocus: 72,          // Fokus na jakość
//   speedPriority: 50,         // Priorytet szybkości
//   engagementLevel: 68,       // Poziom zaangażowania
//   conversionPotential: 55    // Potencjał konwersji
// }
```

### 3. User Embeddings

Wektorowe reprezentacje preferencji użytkowników:

```typescript
import { generateUserEmbedding, getUserEmbedding } from '@/lib/embeddings';

// Generuj embedding (128-wymiarowy wektor)
const embedding = await generateUserEmbedding(userId);

// Pobierz cached embedding
const cachedEmbedding = await getUserEmbedding(userId);
```

Embeddings opierają się na:
- Typach interakcji (view, click, favorite, vote, comment, share)
- Preferencjach kategorii (znormalizowane wagi)
- Zakresach cenowych (buckets: <100, 100-500, 500-1000, >1000)

### 4. AI-Powered Feed Rekomendacyjny

System generuje spersonalizowane rekomendacje z wieloczynnikowym scoringiem:

```typescript
import { generateEnhancedFeedRecommendations, calculateAIRelevanceScore } from '@/lib/personalization';

// Generuj feed (domyślnie 20 itemów)
const recommendations = await generateEnhancedFeedRecommendations(userId, 20);

// Oblicz relevance score dla pojedynczego itemu
const { score, reason, confidence } = await calculateAIRelevanceScore(userId, item, 'deal');
```

#### Scoring Algorithm

Każdy item otrzymuje score 0-1 bazujący na:
- **Category Match** (30%): dopasowanie do ulubionych kategorii
- **Price Alignment** (25%): zgodność z preferencjami cenowymi
- **Segment-Specific** (25%): scoring bazowany na typie segmentu
- **Trending/Popularity** (10%): temperatura/popularność itemu
- **Recency** (10%): jak niedawno został dodany

### 5. Zaawansowana Analityka

#### Session Tracking

```typescript
import { startSession, endSession, recordPageView, recordSessionInteraction } from '@/lib/analytics';

// Rozpocznij sesję
const sessionId = await startSession(userId);

// Śledź page views
await recordPageView(sessionId, '/deals/elektronika');

// Śledź interakcje
await recordSessionInteraction(sessionId, 'click');

// Zakończ sesję
await endSession(sessionId);
```

#### KPI Snapshots

System generuje snapshoty kluczowych metryk:

```typescript
import { calculateKPISnapshot, getLatestKPISnapshot } from '@/lib/analytics';

// Generuj snapshot za ostatni dzień
const endDate = new Date();
const startDate = new Date(endDate);
startDate.setDate(startDate.getDate() - 1);

const kpi = await calculateKPISnapshot('daily', startDate, endDate);
```

Metryki w KPI:
- **totalUsers**, **activeUsers**, **newUsers**, **returningUsers**
- **totalSessions**, **avgSessionDuration**
- **pageViews**, **uniquePageViews**
- **bounceRate**, **avgPagesPerSession**
- **ctr** (Click-Through Rate)
- **conversionRate**, **retentionRate**, **churnRate**

#### Heatmap Data Collection

```typescript
import { recordHeatmapClick, recordScrollDepth } from '@/lib/analytics';

// Śledź kliknięcia
await recordHeatmapClick('deal', dealId, 0.5, 0.3, 'buy-button');

// Śledź scroll depth
await recordScrollDepth('deal', dealId, 75); // 75% strony
```

### 6. BigQuery Export

System exportuje dane do BigQuery dla zaawansowanej analizy:

```typescript
import { exportToBigQuery, listRecentExportJobs } from '@/lib/bigquery-export';

// Manualny export
const job = await exportToBigQuery(
  'interactions',  // 'interactions' | 'sessions' | 'kpis' | 'segments' | 'full'
  startDate,
  endDate,
  'manual',
  adminUid
);

// Lista ostatnich eksportów
const jobs = await listRecentExportJobs(20);
```

#### Tabele BigQuery

| Tabela | Opis | Główne pola |
|--------|------|-------------|
| `okazje_plus_interactions` | Interakcje użytkowników | userId, itemId, interactionType, timestamp |
| `okazje_plus_sessions` | Metryki sesji | sessionId, userId, duration, pageViews, converted |
| `okazje_plus_kpis` | Snapshoty KPI | period, totalUsers, ctr, conversionRate, bounceRate |
| `okazje_plus_segments` | Segmentacja | userId, segmentType, confidence, activityLevel |

### 7. Personalized Feed Configuration

Użytkownicy mogą dostosować swój feed:

```typescript
import { getPersonalizedFeedConfig, updatePersonalizedFeedConfig } from '@/lib/personalization';

// Pobierz config
const config = await getPersonalizedFeedConfig(userId);

// Aktualizuj preferencje
await updatePersonalizedFeedConfig(userId, {
  boostCategories: ['elektronika', 'dom-ogrod'],
  suppressCategories: ['moda'],
  priceRangeFilter: { min: 50, max: 500 },
  contentTypes: {
    showDeals: true,
    showProducts: true,
    dealToProductRatio: 0.7,
  },
  freshness: 'recent', // 'all' | 'recent' | 'today'
});
```

## 🖥️ Admin UI

### Analytics Dashboard (`/admin/analytics`)

Dashboard z 4 zakładkami:

1. **Przegląd**: Core metryki, wykresy, top content
2. **KPI Szczegółowe**: Bounce rate, avg session duration, top categories
3. **Segmentacja**: Rozkład segmentów, pie chart, charakterystyki
4. **Eksporty BigQuery**: Historia eksportów, konfiguracja tabel

Funkcje:
- Wybór zakresu czasowego (7/14/30 dni)
- Generowanie KPI snapshot on-demand
- Real-time metryki z Firestore

### Segments Management (`/admin/segments`)

Zarządzanie segmentami użytkowników:

- 6 kart segmentów z rozkładem procentowym
- Lista użytkowników w wybranym segmencie
- Wyszukiwanie użytkowników
- Re-klasyfikacja użytkowników on-demand
- Charakterystyki zachowań i strategie personalizacji

## 📊 Firestore Collections

### Nowe Kolekcje

| Kolekcja | Opis | Index Required |
|----------|------|----------------|
| `user_segments` | Segmenty użytkowników | userId, segmentType, confidence |
| `user_behavior_scores` | Scoring behawioralny | userId |
| `user_embeddings` | Wektorowe reprezentacje | userId |
| `personalized_feed_configs` | Konfiguracje feedu | userId |
| `session_metrics` | Metryki sesji | sessionId, startTime, userId |
| `kpi_snapshots` | Snapshoty KPI | period, timestamp |
| `heatmap_clicks` | Dane heatmap | pageType, timestamp |
| `scroll_depths` | Głębokość scrollu | sessionId, timestamp |
| `bigquery_export_jobs` | Jobs eksportu | status, startedAt, dataType |

### Composite Indexes

Wymagane composite indexes w Firestore:

```javascript
// user_segments
{ segmentType: asc, confidence: desc }

// session_metrics
{ startTime: asc }
{ userId: asc, startTime: desc }

// kpi_snapshots
{ period: asc, timestamp: desc }

// bigquery_export_jobs
{ status: asc, startedAt: desc }
```

## 🔧 Konfiguracja

### Environment Variables

Nie wymaga dodatkowych zmiennych środowiskowych - wykorzystuje istniejącą konfigurację Firebase i Google AI.

### Firebase Security Rules

Dodaj do `firestore.rules`:

```javascript
// User segments (read own, admins read all)
match /user_segments/{userId} {
  allow read: if request.auth != null && 
    (request.auth.uid == userId || hasRole('admin'));
  allow write: if hasRole('admin');
}

// Behavior scores (read own, admins read all)
match /user_behavior_scores/{userId} {
  allow read: if request.auth != null && 
    (request.auth.uid == userId || hasRole('admin'));
  allow write: if hasRole('admin');
}

// User embeddings (admins only)
match /user_embeddings/{userId} {
  allow read, write: if hasRole('admin');
}

// Feed configs (read/write own, admins read all)
match /personalized_feed_configs/{userId} {
  allow read: if request.auth != null && 
    (request.auth.uid == userId || hasRole('admin'));
  allow write: if request.auth != null && request.auth.uid == userId;
}

// Session metrics (write only, admins read)
match /session_metrics/{docId} {
  allow read: if hasRole('admin');
  allow create: if request.auth != null;
}

// KPI snapshots (admins only)
match /kpi_snapshots/{docId} {
  allow read, write: if hasRole('admin');
}

// BigQuery export jobs (admins only)
match /bigquery_export_jobs/{jobId} {
  allow read, write: if hasRole('admin');
}
```

## 📈 Monitorowanie i Performance

### Zalecane Monitoring

1. **Query Performance**: Monitoruj czas wykonania dla:
   - `calculateUserBehaviorScores()` (powinno < 2s)
   - `generateEnhancedFeedRecommendations()` (powinno < 3s)
   - `calculateKPISnapshot()` (może trwać 10-30s)

2. **Firestore Reads**: Segmentacja i embeddings mogą generować wiele odczytów
   - Cache embeddings przez 7 dni
   - Cache segmentów przez 7 dni
   - Batch operations gdzie możliwe

3. **BigQuery Exports**: Monitoruj rozmiar eksportów
   - Scheduled daily exports w nocy
   - Limit rekordów dla manual exports

### Optymalizacje

1. **Embeddings**: 
   - Use simplified 128-dim vectors (production może użyć 256/512)
   - Consider dedicated vector DB (Pinecone, Weaviate) dla similarity search

2. **Session Tracking**:
   - Debounce page view events (max 1/sekunda)
   - Batch session updates

3. **KPI Calculations**:
   - Pre-aggregate gdzie możliwe
   - Use incremental calculations

## 🧪 Testing

### Unit Tests (TODO)

```bash
npm run test
```

Testy powinny pokrywać:
- Segmentation logic
- Behavior scoring calculations
- AI relevance scoring
- Embedding generation

### Integration Tests (TODO)

```bash
npm run test:e2e
```

Scenariusze testowe:
- User journey z generowaniem segmentu
- Feed personalization flow
- KPI snapshot generation
- BigQuery export

## 🚀 Deployment

### Cloud Functions (Opcjonalne)

Dla automatycznych zadań można utworzyć Cloud Functions:

```typescript
// Scheduled KPI snapshots
export const dailyKPISnapshot = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Europe/Warsaw')
  .onRun(async () => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);
    
    await calculateKPISnapshot('daily', startDate, endDate);
  });

// Scheduled BigQuery exports
export const dailyBigQueryExport = functions.pubsub
  .schedule('0 1 * * *')
  .timeZone('Europe/Warsaw')
  .onRun(async () => {
    await scheduleDailyExport();
  });

// User segment recalculation
export const weeklySegmentUpdate = functions.pubsub
  .schedule('0 2 * * 0')
  .timeZone('Europe/Warsaw')
  .onRun(async () => {
    // Recalculate segments for all active users
  });
```

## 📚 API Reference

### Segmentation

- `calculateUserBehaviorScores(userId: string): Promise<UserBehaviorScore>`
- `classifyUserSegment(userId: string): Promise<UserSegment>`
- `getUserSegment(userId: string, forceRecalculate?: boolean): Promise<UserSegment>`
- `getUsersBySegment(segmentType, limit): Promise<UserSegment[]>`
- `getSegmentDistribution(): Promise<Record<string, number>>`

### Personalization

- `calculateAIRelevanceScore(userId, item, type): Promise<{score, reason, confidence}>`
- `generateEnhancedFeedRecommendations(userId, count): Promise<FeedRecommendation[]>`
- `getPersonalizedFeedConfig(userId): Promise<PersonalizedFeedConfig>`
- `updatePersonalizedFeedConfig(userId, updates): Promise<void>`

### Analytics

- `startSession(userId?): Promise<string>`
- `endSession(sessionId): Promise<void>`
- `recordPageView(sessionId, page): Promise<void>`
- `recordSessionInteraction(sessionId, type): Promise<void>`
- `calculateKPISnapshot(period, startDate, endDate): Promise<KPISnapshot>`
- `getLatestKPISnapshot(period): Promise<KPISnapshot | null>`
- `recordHeatmapClick(pageType, pageId, x, y, element?): Promise<void>`
- `recordScrollDepth(pageType, pageId, depth): Promise<void>`

### Embeddings

- `generateUserEmbedding(userId): Promise<UserEmbedding>`
- `getUserEmbedding(userId, regenerate?): Promise<UserEmbedding>`
- `calculateUserItemSimilarity(userEmb, itemEmb): number`

### BigQuery

- `exportToBigQuery(dataType, startDate, endDate, triggeredBy, uid?): Promise<BigQueryExportJob>`
- `scheduleDailyExport(): Promise<void>`
- `getExportJobStatus(jobId): Promise<BigQueryExportJob | null>`
- `listRecentExportJobs(limit): Promise<BigQueryExportJob[]>`

## 🎓 Best Practices

1. **Cache Strategy**: Embeddings i segmenty są cache'owane przez 7 dni - użyj forceRecalculate tylko gdy konieczne

2. **Batch Operations**: Przy operacjach na wielu użytkownikach użyj batch API Firestore

3. **Rate Limiting**: AI scoring może być kosztowne - implementuj rate limiting dla generateEnhancedFeedRecommendations

4. **Privacy**: Embeddings zawierają wrażliwe dane - nigdy nie exposuj ich publicznie

5. **Monitoring**: Śledź accuracy segmentacji poprzez manual review i A/B testing

## 📞 Support

W przypadku pytań lub problemów:
- Dokumentacja kodu w plikach source
- Issues na GitHub
- Comments w kodzie zawierają szczegóły implementacji
