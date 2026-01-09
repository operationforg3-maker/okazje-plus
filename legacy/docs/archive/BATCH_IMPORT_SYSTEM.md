# Batch Import System - Quick Start

## Backend API Gotowe! ✅

### Dostępne endpointy:

#### 1. Start Import
```bash
POST /api/admin/import/start
Body: {
  "type": "products",  # lub "deals"
  "maxItemsPerSubcategory": 10
}

Response 202:
{
  "success": true,
  "jobId": "abc123",
  "status": "queued",
  "totalBatches": 45,
  "message": "Import started..."
}
```

#### 2. Sprawdź Status
```bash
GET /api/admin/import/status?jobId=abc123

Response:
{
  "success": true,
  "job": {
    "id": "abc123",
    "type": "products",
    "status": "running",  # queued|running|paused|completed|failed
    "progress": {
      "total": 45,
      "completed": 12,
      "failed": 1,
      "current": 13
    },
    "logs": [...]
  }
}
```

#### 3. Pause/Resume/Cancel
```bash
POST /api/admin/import/status
Body: {
  "jobId": "abc123",
  "action": "pause"  # pause|resume|cancel
}
```

#### 4. Rollback (usuń wszystko)
```bash
POST /api/admin/import/rollback
Body: {
  "jobId": "abc123"
}

Response:
{
  "success": true,
  "itemsDeleted": 150
}
```

#### 5. Historia
```bash
GET /api/admin/import/history?limit=20&status=completed
```

## Jak używać w admin panelu:

### Przykład JavaScript:

```javascript
// 1. Start import
const startImport = async () => {
  const res = await fetch('/api/admin/import/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'products',
      maxItemsPerSubcategory: 10
    })
  });
  const data = await res.json();
  console.log('Job started:', data.jobId);
  return data.jobId;
};

// 2. Poll status co 5s
const pollStatus = async (jobId) => {
  const res = await fetch(`/api/admin/import/status?jobId=${jobId}`);
  const data = await res.json();
  const progress = data.job.progress;
  console.log(`Progress: ${progress.completed}/${progress.total} (${progress.failed} failed)`);
  
  // Update UI
  const percentage = Math.round((progress.completed / progress.total) * 100);
  document.getElementById('progress-bar').style.width = `${percentage}%`;
  document.getElementById('progress-text').textContent = `${percentage}%`;
  
  if (data.job.status === 'completed') {
    console.log('Import completed!');
    return true;
  }
  return false;
};

// 3. Pause
const pauseImport = async (jobId) => {
  await fetch('/api/admin/import/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, action: 'pause' })
  });
};

// 4. Resume
const resumeImport = async (jobId) => {
  await fetch('/api/admin/import/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, action: 'resume' })
  });
};

// 5. Rollback
const rollback = async (jobId) => {
  if (!confirm('Usunąć wszystkie zaimportowane produkty?')) return;
  await fetch('/api/admin/import/rollback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId })
  });
};

// Full workflow:
const runImport = async () => {
  const jobId = await startImport();
  
  // Poll every 5 seconds
  const interval = setInterval(async () => {
    const done = await pollStatus(jobId);
    if (done) clearInterval(interval);
  }, 5000);
};
```

## Struktura Firestore:

```
import_jobs/{jobId}:
  id: string
  type: "products" | "deals"
  status: "queued" | "running" | "paused" | "completed" | "failed" | "rolled_back"
  progress: {
    total: number
    completed: number
    failed: number
    current: number
  }
  batches: Array<{
    categoryId, categoryName, categorySlug,
    subcategoryId, subcategoryName, subcategorySlug,
    subsubcategoryId, subsubcategoryName, subsubcategorySlug
  }>
  maxItemsPerSubcategory: number
  createdAt: ISO timestamp
  updatedAt: ISO timestamp
  startedAt: ISO timestamp | null
  completedAt: ISO timestamp | null
  logs: Array<{
    timestamp: ISO,
    batchIndex: number,
    subcategory: string,
    status: "success" | "error",
    itemsAdded?: number,
    itemsUpdated?: number,
    error?: string
  }>
  itemsCreated: string[] # Product/Deal IDs for rollback
  itemsUpdated: string[]
```

## TODO Frontend UI:

Potrzebujesz stworzyć w admin panelu:

1. **Import Tab** z przyciskami:
   - "Start Import Products" (10/subcategory)
   - "Start Import Deals" (10/subcategory)

2. **Progress Card** z:
   - Progress bar (%)
   - Status badge (running/paused/completed)
   - Buttons: Pause/Resume/Cancel
   - Live logs stream (ostatnie 10 wpisów)

3. **History Table** z:
   - Lista jobów (sortowane po createdAt desc)
   - Kolumny: ID, Type, Status, Progress, Created At, Actions
   - Action buttons: View Logs, Rollback

## Przykład React Component:

```tsx
'use client';
import { useState, useEffect } from 'react';

export function ImportManager() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);

  const startImport = async () => {
    const res = await fetch('/api/admin/import/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'products', maxItemsPerSubcategory: 10 })
    });
    const data = await res.json();
    setJobId(data.jobId);
  };

  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      const res = await fetch(`/api/admin/import/status?jobId=${jobId}`);
      const data = await res.json();
      setJob(data.job);
      
      if (data.job.status === 'completed' || data.job.status === 'failed') {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId]);

  const progress = job?.progress;
  const percentage = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div>
      <button onClick={startImport}>Start Import</button>
      
      {job && (
        <div>
          <h3>Status: {job.status}</h3>
          <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: 4 }}>
            <div style={{ width: `${percentage}%`, backgroundColor: '#4caf50', height: 24, borderRadius: 4 }}>
              {percentage}%
            </div>
          </div>
          <p>{progress.completed} / {progress.total} batches</p>
          <p>{progress.failed} failed</p>
        </div>
      )}
    </div>
  );
}
```

## Następne kroki:

1. ✅ Backend API - **GOTOWE**
2. ⏳ Frontend UI - Stwórz komponent ImportManager w admin panelu
3. ⏳ AI Quality - Popraw prompty dla lepszych opisów
4. ⏳ Deals Import - Skopiuj fillSubSubcategoryProducts jako fillSubSubcategoryDeals

Teraz możesz testować przez cURL/Postman lub dodać prosty UI!
