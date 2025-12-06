# Cache Invalidation Integration Guide

## Overview

This guide explains how to integrate cache invalidation into your application to ensure users always see fresh data after admin modifications.

## When to Invalidate Cache

### 1. Category Management

**Trigger**: After creating, updating, or deleting categories, subcategories, or category tiles

**Example Integration**:
```typescript
// In admin API route: src/app/api/admin/categories/route.ts
import { invalidateCategoriesCache } from '@/lib/cache-invalidation';

export async function POST(request: Request) {
  // ... create/update category logic ...
  
  // Invalidate cache after successful update
  await invalidateCategoriesCache();
  
  return NextResponse.json({ success: true });
}
```

### 2. Navigation Showcase

**Trigger**: After updating navigation showcase configuration

**Example Integration**:
```typescript
// In admin settings API route
import { invalidateNavigationShowcaseCache } from '@/lib/cache-invalidation';

export async function PUT(request: Request) {
  // ... update showcase config ...
  
  await invalidateNavigationShowcaseCache();
  
  return NextResponse.json({ success: true });
}
```

### 3. Deal Approvals/Rejections

**Trigger**: After approving or rejecting deals (affects hot deals list)

**Example Integration**:
```typescript
// In moderation API route
import { invalidateHotDealsCache } from '@/lib/cache-invalidation';

export async function PATCH(request: Request) {
  const { dealId, status } = await request.json();
  
  // ... update deal status ...
  
  if (status === 'approved' or status === 'rejected') {
    await invalidateHotDealsCache();
  }
  
  return NextResponse.json({ success: true });
}
```

### 4. Product Approvals

**Trigger**: After approving or rejecting products

**Example Integration**:
```typescript
import { invalidateRecommendedProductsCache } from '@/lib/cache-invalidation';

export async function PATCH(request: Request) {
  const { productId, status } = await request.json();
  
  // ... update product status ...
  
  if (status === 'approved' or status === 'rejected') {
    await invalidateRecommendedProductsCache();
  }
  
  return NextResponse.json({ success: true });
}
```

### 5. Admin Dashboard Refresh

**Trigger**: Manual refresh button in admin dashboard or after bulk operations

**Example Integration**:
```typescript
// Add to admin dashboard page or create API endpoint
import { invalidateAdminStatsCache } from '@/lib/cache-invalidation';

// Button click handler
async function handleRefreshStats() {
  await fetch('/api/admin/cache/invalidate', {
    method: 'POST',
    body: JSON.stringify({ cacheKey: 'admin-stats' })
  });
  
  // Reload stats
  await fetchStats();
}
```

## API Endpoint for Cache Management

Create a dedicated endpoint for cache management:

**File**: `src/app/api/admin/cache/invalidate/route.ts`

```typescript
import { NextResponse } from 'next/server';
import {
  invalidateCategoriesCache,
  invalidateNavigationShowcaseCache,
  invalidateHotDealsCache,
  invalidateRecommendedProductsCache,
  invalidateAdminStatsCache,
  invalidateAllCache,
} from '@/lib/cache-invalidation';

export async function POST(request: Request) {
  // TODO: Add admin authentication check
  // const user = await getAuthenticatedUser(request);
  // if (user?.role !== 'admin') {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  // }

  try {
    const body = await request.json();
    const { cacheKey } = body;

    switch (cacheKey) {
      case 'categories':
        await invalidateCategoriesCache();
        break;
      case 'navigation':
        await invalidateNavigationShowcaseCache();
        break;
      case 'hot-deals':
        await invalidateHotDealsCache();
        break;
      case 'products':
        await invalidateRecommendedProductsCache();
        break;
      case 'admin-stats':
        await invalidateAdminStatsCache();
        break;
      case 'all':
        await invalidateAllCache();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid cache key' },
          { status: 400 }
        );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cache invalidated: ${cacheKey}` 
    });
  } catch (error) {
    console.error('Cache invalidation failed:', error);
    return NextResponse.json(
      { error: 'Cache invalidation failed' },
      { status: 500 }
    );
  }
}
```

## Admin UI Integration

Add cache management buttons to the admin interface:

```typescript
// In admin dashboard or settings page
export function CacheManagementPanel() {
  const [loading, setLoading] = useState(false);

  const handleInvalidate = async (cacheKey: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheKey }),
      });

      if (response.ok) {
        toast.success(`Cache cleared: ${cacheKey}`);
      } else {
        toast.error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
      toast.error('Cache invalidation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Cache Management</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button 
          onClick={() => handleInvalidate('categories')}
          disabled={loading}
          variant="outline"
        >
          Clear Categories
        </Button>
        <Button 
          onClick={() => handleInvalidate('hot-deals')}
          disabled={loading}
          variant="outline"
        >
          Clear Hot Deals
        </Button>
        <Button 
          onClick={() => handleInvalidate('products')}
          disabled={loading}
          variant="outline"
        >
          Clear Products
        </Button>
        <Button 
          onClick={() => handleInvalidate('admin-stats')}
          disabled={loading}
          variant="outline"
        >
          Refresh Stats
        </Button>
        <Button 
          onClick={() => handleInvalidate('all')}
          disabled={loading}
          variant="destructive"
          className="col-span-2"
        >
          Clear All Cache
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Cache is automatically refreshed based on TTL. Manual clearing is only needed for immediate updates.
      </p>
    </div>
  );
}
```

## Automatic Invalidation Hooks

For more advanced scenarios, create hooks in your data mutation functions:

```typescript
// Example: In a Cloud Function or API route
import { invalidateHotDealsCache } from '@/lib/cache-invalidation';

export const onDealUpdate = functions.firestore
  .document('deals/{dealId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // If temperature changed significantly or status changed
    if (
      Math.abs(after.temperature - before.temperature) > 10 ||
      after.status !== before.status
    ) {
      await invalidateHotDealsCache();
    }
  });
```

## Monitoring Cache Performance

Add logging to track cache hit rates:

```typescript
// In your data.ts functions
import { cacheGet, cacheSet } from '@/lib/cache';

export async function getHotDeals(count: number): Promise<Deal[]> {
  const cacheKey = `deals:hot:${count}`;
  const cached = await cacheGet(cacheKey);
  
  if (cached) {
    console.log(`[CACHE HIT] ${cacheKey}`);
    return cached as Deal[];
  }
  
  console.log(`[CACHE MISS] ${cacheKey}`);
  
  // ... fetch from database ...
  
  await cacheSet(cacheKey, deals, 300);
  return deals;
}
```

## Testing Cache Behavior

### Test Cache Hit
```bash
# First request - should be CACHE MISS
curl http://localhost:9002/api/deals/hot

# Second request within TTL - should be CACHE HIT
curl http://localhost:9002/api/deals/hot
```

### Test Cache Invalidation
```bash
# Clear cache
curl -X POST http://localhost:9002/api/admin/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"cacheKey": "hot-deals"}'

# Next request should be CACHE MISS
curl http://localhost:9002/api/deals/hot
```

## Best Practices

1. **Don't over-invalidate**: Only clear cache when data actually changes
2. **Use appropriate TTLs**: Longer for stable data, shorter for dynamic data
3. **Log invalidations**: Track when and why cache is cleared
4. **Monitor hit rates**: Aim for 70%+ cache hit rate
5. **Gradual rollout**: Test cache behavior in staging before production

## Troubleshooting

### Cache not clearing
- Check Redis connection if using Redis
- Verify cache key names match exactly
- Check logs for invalidation errors

### Stale data after invalidation
- Verify all relevant cache keys are cleared
- Check if browser is caching responses (add cache-control headers)
- Ensure multiple app instances are using shared Redis

### Poor cache hit rate
- TTL might be too short
- Too many invalidations
- Add monitoring to identify patterns
