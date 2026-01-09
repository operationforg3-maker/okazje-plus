# AI-Driven Operations Center

Unified dashboard for managing automated background operations with natural language command interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   /admin/filling Dashboard                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Commander: Natural language input                 │   │
│  │ "Import 20 gaming laptops from AliExpress"           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/admin/ai/command → Vertex AI Parser             │   │
│  │ Gemini 1.5 Flash analyzes intent                     │   │
│  │ Returns: { tool: "import_products", count: 20 }      │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ JobQueue.enqueue(type, payload, metadata)            │   │
│  │ Persists to Firestore /jobs collection               │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ /api/cron/process-jobs (Cloud Scheduler)             │   │
│  │ Fetches pending jobs → Routes to handlers            │   │
│  │ Updates logs, progress, stats in real-time           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ JobMonitorWidget: Real-time Firestore listener       │   │
│  │ onSnapshot() → Live console, progress, stats         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Dashboard Page (`/admin/filling/page.tsx`)

Full-screen admin interface with 5 sections:

- **AI Commander**: Textarea + Execute button, command history (last 10)
- **Product Ingestion Stream**: JobMonitorWidget for `import_filling`
- **Quality & SEO Guardian**: JobMonitorWidget for `audit_content`
- **Link Doctor**: JobMonitorWidget for `validate_links`
- **System Pulse**: Manual trigger buttons (Typesense sync, link check, content audit)

**Features**:
- Real-time command history via Firestore listener
- Example commands for quick testing
- Role-based access (admin only)
- Responsive grid layout

### 2. AI Command API (`/api/admin/ai/command/route.ts`)

Unified dispatcher with dual-mode support:

**Natural Language Mode**:
```typescript
POST /api/admin/ai/command
{ "prompt": "Import 20 gaming laptops" }

→ Vertex AI parsing
→ { tool: "import_products", category: "Electronics", count: 20 }
→ JobQueue.enqueue('import_filling', payload)
→ { success: true, jobId: "abc123", message: "✅ Product import queued" }
```

**Legacy Command Mode** (backward compatibility):
```typescript
POST /api/admin/ai/command
{ "command": "createCategoryStructure" }

→ Direct flow invocation (existing behavior)
→ { success: true, result: "Categories created" }
```

**Supported Tools**:
- `import_products`: AliExpress product import with AI enhancement
- `audit_seo`: SEO quality checks
- `audit_content`: Content quality analysis
- `validate_links`: Affiliate link health checks
- `maintenance_typesense`: Search index synchronization
- `create_category`: New category/subcategory creation

**Auth**: Requires admin role via `getServerAuthSession()`

### 3. Job Monitor Widget (`/components/admin/job-monitor-widget.tsx`)

Reusable real-time monitoring component:

**Props**:
```typescript
{
  jobType: string;           // Filter: 'import_filling', 'audit_seo', etc.
  title: string;             // Widget display name
  description?: string;      // Subtitle text
  icon?: React.ReactNode;    // Custom icon
  onStart?: () => Promise<void>;  // Start action callback
  onStop?: (jobId) => Promise<void>;  // Stop action callback
  maxLogs?: number;          // Console log limit (default 50)
}
```

**Features**:
- Real-time Firestore `onSnapshot()` for instant updates
- Circular progress indicator with percentage
- Scrollable console with log levels (info, warn, error, success)
- Auto-scroll toggle
- Stats grid (imported, skipped, errors, etc.)
- Start/Stop controls
- Status badges (pending, processing, completed, failed)

**UI Elements**:
- Header: Title, icon, status badge, controls
- Progress bar: Current/total with percentage
- Stats grid: 2-column layout for metrics
- Console: Mono font, color-coded logs, timestamps
- Footer: Job ID, start time, error messages

### 4. Job Worker (`/api/cron/process-jobs/route.ts`)

Background job processor triggered by Cloud Scheduler:

**Endpoints**:
- `POST /api/cron/process-jobs`: Process up to 10 pending jobs
- `GET /api/cron/process-jobs`: Health check with queue stats

**Job Handlers**:

**`import_filling`**:
1. Initialize AliExpressClient with OAuth
2. Search products via TOP API (`aliexpress.affiliate.product.query`)
3. Check Firestore for duplicates (by `externalId`)
4. AI enhancement: Generate Polish SEO description with Vertex AI
5. Save to `/products` collection (status: draft)
6. Update job logs, progress, stats

**`audit_seo`**:
1. Query deals (approved status, optional date filter)
2. Check: title length, description length, image presence, category
3. Flag issues in logs
4. Update deal doc with `seoIssues` array
5. Stats: passed, warnings, failed

**`audit_content`**:
- Placeholder for grammar, readability, spam checks
- Similar structure to SEO audit

**`validate_links`**:
1. Query deals (approved, optional category filter)
2. Use LinkValidator with Puppeteer fallback
3. Check `result.isValid`
4. Update deal status to `expired` if invalid
5. Stats: valid, invalid, errors

**`maintenance_typesense`**:
- Placeholder (requires admin API key for upsert)
- Logs operation details
- Stats: would_sync count

**`create_category`**:
- Placeholder for Firestore category creation

**Real-time Updates**:
- `addJobLog(jobId, level, message)`: Appends to `metadata.logs[]`
- `updateJobProgress(jobId, current, total)`: Sets `metadata.progress`
- `updateJobStats(jobId, stats)`: Sets `metadata.stats`

**Auth**: Bearer token verification with `CRON_SECRET`

### 5. Server Auth (`/lib/auth-server.ts`)

Server-side authentication utilities:

**Functions**:
```typescript
getServerAuthSession(): Promise<ServerAuthSession | null>
requireAdmin(): Promise<ServerAuthSession>
requireModerator(): Promise<ServerAuthSession>
```

**Session Object**:
```typescript
{
  uid: string;
  email: string | undefined;
  role: 'admin' | 'moderator' | 'user';
  emailVerified: boolean;
}
```

**Flow**:
1. Check `Authorization: Bearer <token>` header
2. Fallback to `firebaseIdToken` cookie
3. Verify token with Firebase Admin SDK
4. Fetch user role from Firestore `/users/{uid}`
5. Return session or null

## Data Flow

### Job Lifecycle

```typescript
// 1. User enters command
"Import 20 gaming laptops"

// 2. API parses with Vertex AI
{
  tool: "import_products",
  category: "Electronics",
  subcategory: "Laptops",
  count: 20,
  keywords: "gaming laptop"
}

// 3. JobQueue creates document
/jobs/abc123 {
  type: "import_filling",
  status: "pending",
  payload: { category, subcategory, count, keywords },
  attempts: 0,
  maxAttempts: 3,
  createdAt: 1234567890,
  invokedBy: "user-uid",
  metadata: {
    logs: [],
    progress: { current: 0, total: 0, percentage: 0 },
    stats: {}
  }
}

// 4. Cron worker picks up job
/api/cron/process-jobs → handleImportFilling()

// 5. Worker updates in real-time
metadata.logs[] ← "Starting import: 20 products"
metadata.logs[] ← "AliExpress client initialized"
metadata.logs[] ← "Found 25 products"
metadata.progress ← { current: 5, total: 25, percentage: 20 }
metadata.logs[] ← "Import complete: 18 added, 7 skipped"
status ← "completed"
result ← { success: true }

// 6. Widget shows live updates
JobMonitorWidget detects Firestore change via onSnapshot()
→ Updates progress bar
→ Scrolls console
→ Shows stats grid
```

### Real-time Monitoring

```typescript
// Widget listens to Firestore
const q = query(
  collection(db, 'jobs'),
  where('type', '==', 'import_filling'),
  where('status', 'in', ['pending', 'processing']),
  orderBy('createdAt', 'desc'),
  limit(1)
);

onSnapshot(q, (snapshot) => {
  if (!snapshot.empty) {
    setActiveJob({ id, ...data });
  }
});

// Worker updates trigger instant UI refresh
await adminDb.collection('jobs').doc(jobId).update({
  'metadata.logs': [...currentLogs, newLog]
});
// → Widget console scrolls to bottom
// → New log appears instantly
```

## Setup

### Environment Variables

```bash
# Required for AI parsing
VERTEX_AI_PROJECT_ID=your-project
VERTEX_AI_LOCATION=europe-west1

# Required for product import
ALIEXPRESS_APP_KEY=your-app-key
ALIEXPRESS_APP_SECRET=your-app-secret

# Required for cron worker
CRON_SECRET=secure-random-string

# Optional for Typesense sync
TYPESENSE_HOST=your-host
TYPESENSE_SEARCH_ONLY_API_KEY=your-key
```

### Firebase Scheduled Function

Add to `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

export const processJobsCron = functions
  .region('europe-west1')
  .pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const response = await fetch(
      'https://your-app.web.app/api/cron/process-jobs',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );
    
    const result = await response.json();
    console.log('[Cron] Job processing result:', result);
    return null;
  });
```

### Firestore Security Rules

```javascript
match /jobs/{jobId} {
  // Allow admins to read all jobs
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  
  // Allow system to write (server-side only)
  allow write: if false; // Server uses Admin SDK
}

match /aiCommandHistory/{commandId} {
  // Allow users to read their own history
  allow read: if request.auth != null && 
    resource.data.invokedBy == request.auth.uid;
  
  // Allow system to write
  allow write: if false; // Server uses Admin SDK
}
```

## Usage Examples

### Natural Language Commands

```typescript
// Product import
"Import 20 gaming laptops from AliExpress"
→ { tool: "import_products", category: "Electronics", subcategory: "Laptops", count: 20 }

// SEO audit
"Check SEO on deals from last week"
→ { tool: "audit_seo", scope: "recent", days: 7 }

// Link validation
"Validate all affiliate links in Electronics category"
→ { tool: "validate_links", scope: "category", category: "Electronics" }

// System maintenance
"Sync Typesense search index"
→ { tool: "maintenance_typesense", action: "sync" }

// Category creation
"Create new subcategory Mechanical Keyboards under Electronics"
→ { tool: "create_category", name: "Mechanical Keyboards", parent: "Electronics" }
```

### Programmatic API Calls

```typescript
// From admin panel
const response = await fetch('/api/admin/ai/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Import 10 wireless mice'
  }),
});

const result = await response.json();
// { success: true, jobId: "abc123", tool: "import_products", message: "✅ Product import queued: 10 items" }

// Monitor job in real-time
<JobMonitorWidget
  jobType="import_filling"
  title="Product Ingestion"
  description="AliExpress → AI Enhancement → Firestore"
  icon={<Package />}
  onStart={async () => {
    await fetch('/api/admin/ai/command', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Resume import' }),
    });
  }}
/>
```

## Testing

### Manual Testing

1. Navigate to `/admin/filling`
2. Enter command: "Import 5 USB cables"
3. Click "Execute Command"
4. Watch Product Ingestion widget for:
   - Status: pending → processing → completed
   - Progress bar: 0% → 100%
   - Console logs: real-time updates
   - Stats: imported, skipped counts

### Cron Worker Testing

```bash
# Local test (requires CRON_SECRET)
curl -X POST http://localhost:9002/api/cron/process-jobs \
  -H "Authorization: Bearer dev-secret-change-in-production"

# Health check
curl -X GET http://localhost:9002/api/cron/process-jobs \
  -H "Authorization: Bearer dev-secret-change-in-production"

# Response
{
  "healthy": true,
  "queueStats": {
    "pending": 2,
    "processing": 1,
    "completed": 15,
    "failed": 0
  },
  "timestamp": 1234567890
}
```

### Firestore Data Inspection

```typescript
// Check job document
firebase.firestore().collection('jobs').doc('abc123').get()
  .then(doc => console.log(doc.data()));

// Structure
{
  type: "import_filling",
  status: "completed",
  payload: { category: "Electronics", count: 5 },
  result: { success: true },
  attempts: 1,
  maxAttempts: 3,
  createdAt: 1234567890,
  startedAt: 1234567891,
  completedAt: 1234567920,
  invokedBy: "user-uid",
  metadata: {
    logs: [
      { timestamp: 1234567891, level: "info", message: "Starting import: 5 products" },
      { timestamp: 1234567895, level: "info", message: "Found 7 products" },
      { timestamp: 1234567920, level: "success", message: "Import complete: 5 added, 2 skipped" }
    ],
    progress: { current: 5, total: 7, percentage: 71 },
    stats: { imported: 5, skipped: 2, total: 7 }
  }
}
```

## Troubleshooting

### Widget Not Updating

**Symptom**: Console logs frozen, progress stuck

**Causes**:
1. Firestore listener disconnected
2. Job status not in ['pending', 'processing']
3. Network firewall blocking WebSocket

**Fix**:
- Check browser console for Firestore errors
- Verify Firestore rules allow read access
- Test with `firebase.firestore().collection('jobs').get()`

### Jobs Not Processing

**Symptom**: Jobs stuck in "pending" status

**Causes**:
1. Cron function not deployed
2. CRON_SECRET mismatch
3. Worker endpoint error

**Fix**:
- Check Cloud Scheduler logs in Firebase Console
- Verify `CRON_SECRET` env var matches
- Manually trigger: `curl -X POST .../api/cron/process-jobs`

### AI Parsing Errors

**Symptom**: "Unknown tool" or parsing failure

**Causes**:
1. Vertex AI quota exceeded
2. Ambiguous command
3. Network timeout

**Fix**:
- Check Vertex AI usage in GCP Console
- Use more specific commands
- Fall back to legacy mode: `{ command: "fillCategoriesWithProducts" }`

### Import Failures

**Symptom**: Jobs complete but no products added

**Causes**:
1. AliExpress API errors (invalid credentials, rate limit)
2. Duplicate detection (products already exist)
3. AI enhancement timeout

**Fix**:
- Check job logs: `metadata.logs[]`
- Verify `ALIEXPRESS_APP_KEY` and `ALIEXPRESS_APP_SECRET`
- Check AliExpress API dashboard for quota

## Monitoring & Observability

### Cloud Logging Queries

```sql
-- Job processing errors
resource.type="cloud_function"
jsonPayload.message=~"JobWorker.*failed"
severity>=ERROR

-- AI parsing activity
resource.type="cloud_function"
jsonPayload.message=~"AI Command.*Parsing"
timestamp>="2025-01-15T00:00:00Z"

-- Performance: job completion times
resource.type="cloud_function"
jsonPayload.message=~"Job.*completed"
```

### Firestore Dashboard

Create custom views:
- Jobs by status (pie chart)
- Jobs by type (bar chart)
- Average completion time (line chart)
- Error rate over time (area chart)

### Alerting

Set up Cloud Monitoring alerts:
- Job failure rate > 10% (5 min window)
- Queue depth > 50 pending jobs
- Worker execution time > 60s
- AI parsing errors > 5/min

## Future Enhancements

### Planned Features

1. **Batch Operations**: Process multiple jobs in parallel
2. **Priority Queue**: High-priority jobs jump queue
3. **Job Dependencies**: Chain jobs (import → audit → publish)
4. **Scheduled Jobs**: Recurring imports (daily, weekly)
5. **Webhook Notifications**: Slack/Discord alerts on completion
6. **Job Templates**: Save and reuse common commands
7. **Analytics Dashboard**: Aggregate stats, charts, trends
8. **Manual Retry**: Re-run failed jobs from UI
9. **Job Cancellation**: Stop in-progress jobs
10. **Export Reports**: CSV/PDF job history

### Architecture Improvements

- **Worker Pool**: Multiple instances for parallelization
- **Dead Letter Queue**: Failed jobs for manual review
- **Redis Cache**: Faster job state queries
- **GraphQL Subscriptions**: Real-time updates without Firestore polling
- **Rate Limiting**: Per-user, per-tool quotas
- **Cost Tracking**: Estimate cloud costs per job type

## Contributing

When extending this system:

1. **New Job Types**: Add handler in `process-jobs/route.ts` + tool definition in `command/route.ts`
2. **New Widgets**: Clone `JobMonitorWidget`, adjust `jobType` prop
3. **AI Tools**: Update Vertex AI prompt with tool spec + JSON schema
4. **Testing**: Add unit tests for handlers, E2E tests for full flow
5. **Docs**: Update this file with examples and troubleshooting tips

## References

- [Vertex AI Gemini](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Firestore Real-time Updates](https://firebase.google.com/docs/firestore/query-data/listen)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)
- [AliExpress Affiliate API](https://portals.aliexpress.com/affdeveloper/docs)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
