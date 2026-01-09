# Import Queue System - 504 Timeout Fix

## Problem

Endpoint `/api/admin/ai/auto-import` powodował 504 Gateway Timeout z powodu:
- Synchroniczne przetwarzanie wszystkich kategorii (50-100+)
- Dla każdej kategorii: zewnętrzne API calls (1-5s każde)
- Dla każdego produktu: dodatkowe zapytania (details, shipping, stats)
- AI enrichment z 3 agentami (Quality Score + Copywriter + Librarian)
- Brak timeoutów (domyślnie 60s na Firebase App Hosting)

## Rozwiązanie

### 1. Import Queue System (`/src/lib/import-queue.ts`)

Job queue z Firestore do długotrwałych operacji:
- **Progress tracking**: real-time status updates
- **Error recovery**: kontynuacja po błędach
- **Cancellation support**: możliwość przerwania
- **Rate limiting**: kontrola obciążenia API

### 2. Nowe API Endpoints

#### `POST /api/admin/import/queue`
Tworzy nowy job w tle:
```json
{
  "sources": {
    "aliexpress": true,
    "convertiser": true
  },
  "maxProductsPerCategory": 20,
  "enableAdvancedFeatures": true,
  "enableAIEnrichment": true
}
```

Response:
```json
{
  "success": true,
  "jobId": "abc123",
  "message": "Import job created"
}
```

#### `GET /api/admin/import/queue/{jobId}`
Sprawdza status i postęp:
```json
{
  "success": true,
  "job": {
    "id": "abc123",
    "status": "running",
    "progress": {
      "currentSource": "aliexpress",
      "currentCategory": "electronics",
      "processedCategories": 15,
      "totalCategories": 50,
      "importedProducts": 234,
      "errors": []
    }
  }
}
```

#### `GET /api/admin/import/queue`
Lista jobów użytkownika:
```json
{
  "success": true,
  "jobs": [...]
}
```

#### `DELETE /api/admin/import/queue/{jobId}`
Anuluj running job:
```json
{
  "success": true,
  "message": "Job cancelled"
}
```

### 3. Ulepszenia w oryginalnym endpoincie

`/api/admin/ai/auto-import` teraz:
- **Limit kategorii**: domyślnie max 5 (parametr `maxCategories`)
- **Timeout detection**: early exit po 50s
- **Warning message**: sugestia użycia queue API dla większych importów
- **Dokumentacja**: ostrzeżenia o timeoutach

## Użycie

### Szybki import (≤5 kategorii, bez AI)
```typescript
// Bezpośrednie użycie - synchroniczne
POST /api/admin/ai/auto-import
{
  "sources": { "aliexpress": true },
  "maxCategories": 5,
  "enableAIEnrichment": false
}
```

### Duży import (>5 kategorii, z AI)
```typescript
// 1. Utwórz job
const { jobId } = await fetch('/api/admin/import/queue', {
  method: 'POST',
  body: JSON.stringify({
    sources: { aliexpress: true, convertiser: true },
    maxProductsPerCategory: 20,
    enableAIEnrichment: true
  })
}).then(r => r.json());

// 2. Poll status co 5s
const interval = setInterval(async () => {
  const { job } = await fetch(`/api/admin/import/queue/${jobId}`)
    .then(r => r.json());
  
  console.log(`Progress: ${job.progress.importedProducts} products`);
  
  if (job.status === 'completed' || job.status === 'failed') {
    clearInterval(interval);
    console.log('Import finished:', job.results);
  }
}, 5000);
```

## Dalsze ulepszenia (TODO)

1. **Cloud Function deployment**: Extended timeout (540s)
2. **Pub/Sub trigger**: Async job processing
3. **Cloud Tasks**: Scheduled retry logic
4. **Rate limiting**: Per-source API quotas
5. **Webhook notifications**: Job completion alerts
6. **Admin UI**: Job management dashboard w harvestere

## Testy

```bash
# Test queue creation
curl -X POST http://localhost:9002/api/admin/import/queue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sources":{"aliexpress":true},"maxProductsPerCategory":5}'

# Test status check
curl http://localhost:9002/api/admin/import/queue/{jobId} \
  -H "Authorization: Bearer $TOKEN"

# Test cancellation
curl -X DELETE http://localhost:9002/api/admin/import/queue/{jobId} \
  -H "Authorization: Bearer $TOKEN"
```

## Migracja

Stare wywołania `/api/admin/ai/auto-import`:
- Działają nadal (limit 5 kategorii)
- Logują ostrzeżenia o timeoutach
- Sugerują użycie queue API

Nowe projekty: używaj `/api/admin/import/queue` od razu.
