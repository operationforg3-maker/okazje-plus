# Production Checklist & Deployment Guide

## Okazje+ AliExpress Integration & Scaling Improvements

### Completed Features

✅ **Search Infrastructure**
- Server-side Typesense proxy at `/api/search` and `/api/search/autocomplete`
- Redis-backed cache adapter (`src/lib/cache.ts`) with LRU fallback
- Firestore fallback search for robustness
- Per-IP rate-limiting to prevent abuse

✅ **AliExpress Integration**
- AOP MD5 signing helper (`src/lib/aliexpress.ts`)
- Server proxy endpoints for product search and item details
- Admin-only import endpoint (`POST /api/admin/aliexpress/import`)
- Callable Cloud Functions for single and batch import (`importAliProduct`, `bulkImportAliProducts`)
- Automatic image download and upload to Firebase Storage during import
- Category mapping and deduplication (by externalId and link)

✅ **Admin UI**
- AliExpress importer component with search, preview, and bulk import
- Mock data fallback when API not configured
- Category assignment workflow (single and bulk)
- Status tracking and user feedback (Toast notifications)

✅ **Testing**
- Comprehensive unit tests for AOP signing (16 test cases, 100% pass rate)
- Jest setup with ts-jest transformer
- E2E tests for legal pages (Playwright)

---

## Environment Variables Required

### Firebase & Authentication
```env
# Firebase Project Config (for Server-side Firebase Admin)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Or use Application Default Credentials (ADC) in Firebase App Hosting
```

### Search (Typesense)
```env
# Typesense Cloud (server-side)
TYPESENSE_HOST=nodes.typsense.org
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
TYPESENSE_SEARCH_ONLY_API_KEY=your-search-only-key

# Typesense (client-side, optional for browser usage)
NEXT_PUBLIC_TYPESENSE_HOST=nodes.typesense.org
NEXT_PUBLIC_TYPESENSE_PORT=443
NEXT_PUBLIC_TYPESENSE_PROTOCOL=https
NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_API_KEY=your-search-only-key
```

### AliExpress Integration
```env
# AliExpress OpenAPI (AOP) credentials
ALIEXPRESS_API_BASE=https://api.aliexpress.com  # or openapi.aliexpress.com
ALIEXPRESS_APP_KEY=521398  # Provided by user
ALIEXPRESS_APP_SECRET=<secret-key>  # Provided by user

# Optional: Alternative API key if using different endpoint
# ALIEXPRESS_API_KEY=<alternative-key>
# ALIEXPRESS_API_KEY_HEADER=Authorization  # Header name for alternative key
```

### Caching & Rate-Limiting
```env
# Redis (for production cache & rate-limiter)
REDIS_URL=redis://:password@host:6379  # Optional; uses LRU fallback if not set

# Rate-limit thresholds (recommendations)
# Default: 100 requests per minute per IP
# Configurable in src/lib/cache.ts
```

### Image Storage
```env
# Firebase Storage bucket for downloaded product images
STORAGE_BUCKET=your-project.appspot.com  # Optional; skip image upload if not set
```

### Genkit AI (Optional)
```env
# For trending prediction features
GOOGLE_API_KEY=your-google-api-key
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Set all required environment variables in Firebase Console (Environment section)
- [ ] Ensure Firebase Storage bucket exists and is configured
- [ ] Configure Redis instance (production recommended) or use LRU fallback (dev/staging)
- [ ] Test locally with `npm run dev` and visit `/admin` to verify importer
- [ ] Run `npm test` to ensure all unit tests pass
- [ ] Run `npm run typecheck` to verify TypeScript compilation
- [ ] Run `npm run test:e2e` to verify Playwright tests pass

### Build & Deploy
```bash
# Build the application
npm run build

# Deploy to Firebase App Hosting
firebase apphosting:deploy

# Or if using Cloud Functions
cd okazje-plus && npm install && npm run build
firebase deploy --only functions
```

### Post-Deployment
- [ ] Monitor Firebase Firestore for import errors
- [ ] Check Cloud Functions logs for AOP signing errors
- [ ] Verify rate-limiting is working (check response headers for rate-limit info)
- [ ] Test AliExpress search with real API (use `/api/admin/aliexpress/search`)
- [ ] Monitor Redis connection and cache hit rates (if using Redis)
- [ ] Verify image downloads and Storage uploads complete successfully
- [ ] Review admin import history and created products in Firestore

---

## Rate-Limiting Configuration

Default rate limits (per IP, per minute):
- **Search endpoints**: 100 requests/min
- **AliExpress proxy**: 50 requests/min
- **Import endpoints**: 20 requests/min (admin only)

To adjust, modify `src/lib/cache.ts`:
```typescript
const RATE_LIMITS = {
  'search': { max: 100, window: 60 },
  'aliexpress': { max: 50, window: 60 },
  'import': { max: 20, window: 60 },
};
```

---

## Monitoring & Debugging

### Common Issues

**1. AliExpress API returns 403 Unauthorized**
- Verify `ALIEXPRESS_APP_KEY` and `ALIEXPRESS_APP_SECRET` are correct
- Check AOP signature: test with `npm test -- src/lib/aliexpress.test.ts`
- Verify timestamp format is correct (YYYY-MM-DD HH:mm:ss)

**2. Image upload to Storage fails**
- Verify `STORAGE_BUCKET` env var is set
- Check Firebase Storage bucket permissions allow admin writes
- Verify service account has `roles/storage.admin` role

**3. Redis connection errors**
- Check `REDIS_URL` format and connectivity
- If Redis unavailable, app will fall back to LRU cache automatically
- Monitor Cloud Functions logs for warnings

**4. Rate-limiting too aggressive**
- Adjust thresholds in `src/lib/cache.ts`
- Consider whitelisting admin IPs for import operations

---

## Performance Optimization

### Current Architecture
- **Search**: Typesense (full-text) + Firestore (fallback)
- **Caching**: Redis (production) + LRU (fallback)
- **Images**: Firebase Storage (persisted) + Firestore refs
- **Rate-limiting**: Per-IP in-memory tracking (scales with connections)

### Recommended Improvements (Future)
- [ ] Add CloudFront CDN for image serving
- [ ] Implement Firestore read/write quotas monitoring
- [ ] Add distributed cache invalidation for multi-server deployments
- [ ] Consider Memcached for ultra-low-latency caching
- [ ] Add request batching for bulk product imports

---

## Rollback Procedure

If issues arise after deployment:

1. **Revert to previous version**:
   ```bash
   git revert <commit-hash>
   firebase apphosting:deploy
   ```

2. **Disable AliExpress import** (if issue is import-related):
   - Remove/comment out importer tab in admin panel
   - Or set `ALIEXPRESS_APP_KEY=` (empty) to use mock data

3. **Clear cache if corrupted**:
   - For Redis: `redis-cli FLUSHDB`
   - For LRU: Redeploy (fresh instance)

---

## Testing Checklist

### Unit Tests
```bash
npm test                          # Run all tests
npm test -- --watch              # Watch mode
npm test -- src/lib/aliexpress   # Specific test
```

### Manual Testing (Admin UI)
1. Navigate to `http://localhost:9002/admin`
2. Click on "Importuj produkty" tab
3. Search for products (uses mock data if API not configured)
4. Select 2-3 products
5. Assign categories (select main → subcategory)
6. Click "Importuj wybrane"
7. Verify products appear in Firestore (`/products` collection)

### End-to-End Testing (E2E)
```bash
npm run test:e2e                 # Run Playwright tests
npm run test:e2e -- --ui         # Open Playwright UI
```

---

## Support & Troubleshooting

- **Logs**: Check Firebase Cloud Functions logs in Firebase Console
- **Errors**: Review `src/app/api/` endpoint responses for detailed error messages
- **Performance**: Monitor Firestore read/write metrics in Console
- **Caching**: Review Redis commands and hit rates if using Redis

---

## Sign-Off

- [ ] All env vars configured in Firebase Console
- [ ] Build successful (`npm run build` completes)
- [ ] Tests passing (`npm test` 16/16 ✅)
- [ ] Typecheck passing (`npx tsc --noEmit` no errors)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Manual admin UI testing completed
- [ ] Firebase deployment successful (`firebase deploy`)
- [ ] Monitoring configured (Cloud Logging alerts)

Deployment ready: **YES / NO**
