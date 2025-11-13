# Milestone 3: Quick Start Guide

## Overview
This guide helps you quickly integrate and test the new M3 features: Price Monitoring, AI Review Summaries, Community Gamification, Personalization, and Multi-Marketplace Integration.

## Setup

### 1. Run Seed Script
Populate initial data (badges, marketplaces):
```bash
npm run seed:m3
# Add this to package.json if not present:
# "seed:m3": "ts-node src/scripts/seed-m3.ts"
```

### 2. Environment Variables
Ensure these are set in `.env.local`:
```env
# Required for AI features
GOOGLE_GENAI_API_KEY=your_google_ai_key

# Firebase (already configured)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase vars
```

## Quick Integration Examples

### Price Monitoring on Product Pages

**1. Add to product detail page** (`src/app/produkty/[id]/page.tsx`):
```tsx
import { PriceHistoryChart } from '@/components/price-history-chart';
import { PriceAlertButton } from '@/components/price-alert-button';

export default function ProductPage({ params }: { params: { id: string } }) {
  // ... existing code ...

  return (
    <div>
      {/* Existing product info */}
      
      {/* Add price monitoring */}
      <div className="mt-8 space-y-6">
        <PriceHistoryChart 
          itemId={product.id} 
          itemType="product" 
        />
        
        <PriceAlertButton
          itemId={product.id}
          itemType="product"
          currentPrice={product.price}
          itemName={product.name}
          itemImage={product.image}
        />
      </div>
    </div>
  );
}
```

**2. Record price snapshots** (backend/cron job):
```typescript
import { recordPriceSnapshot } from '@/lib/price-monitoring';

// In your price update function
await recordPriceSnapshot(
  productId,
  'product',
  newPrice,
  {
    originalPrice: product.originalPrice,
    source: 'aliexpress',
    availability: 'in_stock',
    metadata: {
      shippingCost: 0,
      couponCode: 'SAVE10',
    }
  }
);
```

### AI Review Summaries on Product Pages

**1. Add review summary display**:
```tsx
import { ReviewSummaryCard } from '@/components/review-summary-card';

// In product page
<ReviewSummaryCard productId={product.id} />
```

**2. Generate summaries** (admin panel or cron):
```typescript
import { analyzeReviewsAction } from '@/app/admin/m3-tools/actions';

// After reviews are added
const result = await analyzeReviewsAction(productId);
if (result.success) {
  console.log('Summary generated:', result.summary);
}
```

**3. Or use the admin interface**:
- Navigate to `/admin/m3-tools`
- Enter product ID
- Click "Analizuj Recenzje"
- Summary is saved automatically

### Gamification - Award Points for Actions

**1. On deal submission**:
```typescript
import { awardPoints, POINT_VALUES } from '@/lib/gamification';

// After deal created
await awardPoints(
  userId,
  POINT_VALUES.DEAL_SUBMITTED,
  'deal_submitted',
  'Zgłoszono nową okazję',
  {
    relatedItemId: dealId,
    relatedItemType: 'deal'
  }
);
```

**2. On deal approval (moderator action)**:
```typescript
await awardPoints(
  userId,
  POINT_VALUES.DEAL_APPROVED,
  'deal_approved',
  'Okazja została zatwierdzona!',
  { relatedItemId: dealId }
);
```

**3. Check and award badges**:
```typescript
import { awardBadge, getUserPoints } from '@/lib/gamification';

const userPoints = await getUserPoints(userId);
if (userPoints && userPoints.breakdown.dealSubmissions === 1) {
  await awardBadge(userId, 'first_step'); // First deal badge
}
if (userPoints && userPoints.breakdown.dealSubmissions === 10) {
  await awardBadge(userId, 'deal_hunter'); // 10 deals badge
}
```

**4. Display user stats on profile**:
```tsx
import { UserStatsCard } from '@/components/user-stats-card';

// In user profile page
<UserStatsCard userId={userId} />
```

**5. Add leaderboard page**:
```tsx
// app/ranking/page.tsx
import { LeaderboardCard } from '@/components/leaderboard-card';

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Ranking Społeczności</h1>
      <LeaderboardCard />
    </div>
  );
}
```

### Personalization - Track Interactions

**1. Track product views**:
```typescript
import { recordUserInteraction } from '@/lib/personalization';

// In product page, when user views
if (user) {
  await recordUserInteraction(
    user.uid,
    productId,
    'product',
    'view',
    {
      source: 'category_browse',
      categorySlug: product.mainCategorySlug,
      duration: 30000 // 30 seconds
    }
  );
}
```

**2. Track deal clicks**:
```typescript
// When user clicks deal link
await recordUserInteraction(
  userId,
  dealId,
  'deal',
  'click',
  {
    source: 'homepage_feed',
    position: 3 // 3rd item in list
  }
);
```

**3. Generate personalized feed**:
```typescript
import { getPersonalizedFeed } from '@/lib/personalization';

// On homepage or feed page
const personalizedItems = await getPersonalizedFeed(userId, {
  includeRecommendations: true,
  count: 20
});
```

**4. Create preference management page**:
```tsx
import { getUserPreferences, addFavoriteCategory } from '@/lib/personalization';

export default function PreferencesPage() {
  // Let users select favorite categories
  // Manage notification settings
  // Set price range preferences
  // etc.
}
```

### Multi-Marketplace - Price Comparison

**1. Aggregate prices from sources**:
```typescript
import { aggregateProductPrices, getPriceComparison } from '@/lib/multi-marketplace';

// When syncing products from multiple sources
const sources: ProductSource[] = [
  {
    marketplaceId: 'aliexpress',
    productId: 'ali_12345',
    name: 'Product Name',
    url: 'https://...',
    price: 99.99,
    inStock: true,
    rating: 4.5,
    reviewCount: 1200,
    lastSynced: new Date().toISOString()
  },
  // ... more sources
];

await aggregateProductPrices(
  canonicalProductId,
  productName,
  productImage,
  sources
);
```

**2. Display price comparison**:
```tsx
import { getPriceComparison, getBestOffer } from '@/lib/multi-marketplace';

// In product page
const comparison = await getPriceComparison(productId);
const bestOffer = await getBestOffer(productId);

// Render comparison table showing all prices
```

## Background Jobs (Recommended)

### Price Monitoring Job
```typescript
// Run hourly
export async function monitorPrices() {
  // Get all active alerts
  // Check current prices
  // Trigger alerts if conditions met
  // Send notifications
}
```

### AI Review Analysis Job
```typescript
// Run daily
export async function analyzeProductReviews() {
  // Find products with new reviews
  // Batch analyze reviews
  // Update summaries
}
```

### Leaderboard Generation Job
```typescript
// Run weekly
export async function updateLeaderboards() {
  await generateLeaderboard('weekly', { topN: 100 });
  await generateLeaderboard('monthly', { topN: 100 });
  await generateLeaderboard('all_time', { topN: 100 });
}
```

## Testing

### Test Price Alerts
1. Create product with price
2. Log in as user
3. Set price alert (target price or % drop)
4. Update product price to trigger alert
5. Check notifications

### Test AI Analysis
1. Go to `/admin/m3-tools`
2. Enter product ID (or create one)
3. Click "Analizuj Recenzje"
4. View results
5. Check product page for ReviewSummaryCard

### Test Gamification
1. Submit a deal
2. Check user points increased
3. Check first badge awarded
4. View leaderboard
5. Check activity history

### Test Personalization
1. Browse products in categories
2. Click and favorite items
3. Check interactions recorded
4. View personalized feed
5. Verify recommendations match behavior

## Admin Interfaces

### M3 Tools (`/admin/m3-tools`)
- Test AI review analysis
- View system status
- Quick testing interface

### Future Admin Pages
- Price monitoring dashboard
- Badge management
- Leaderboard management
- A/B test configuration
- Marketplace management

## Troubleshooting

### AI Analysis Not Working
- Check `GOOGLE_GENAI_API_KEY` is set
- Verify Genkit AI is configured
- Check server logs for errors
- Ensure product has reviews

### Price Alerts Not Triggering
- Verify alert is active
- Check price threshold
- Ensure background job is running
- Check notification creation

### Points Not Awarded
- Verify user is authenticated
- Check function is being called
- Review transaction logs
- Ensure Firestore rules allow writes

### Components Not Displaying
- Check data exists in Firestore
- Verify user permissions
- Review browser console for errors
- Ensure imports are correct

## API Reference

See `docs/M3_COMPLETION_SUMMARY.md` for comprehensive API documentation.

## Next Steps

1. ✅ Run seed script
2. ✅ Add components to product pages
3. ✅ Hook up gamification to actions
4. ✅ Test AI review analysis
5. ✅ Create user profile page
6. ✅ Add leaderboard page
7. ✅ Implement background jobs
8. ✅ Create preference management UI

## Support

For issues or questions:
- Check `docs/M3_COMPLETION_SUMMARY.md`
- Review component source code
- Check Firestore security rules
- Review existing M2 implementation patterns

Happy coding! 🚀
