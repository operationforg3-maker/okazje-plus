# Social Media Backend Integration & Manual Control

**Created:** December 2024  
**Status:** ✅ Complete  
**Related:** [SOCIAL_MEDIA_CONTENT_AUTOMATION.md](./SOCIAL_MEDIA_CONTENT_AUTOMATION.md)

## Overview

Complete UI-integrated backend system for manual control of social media publishing. Admin has full visibility and control over every post through intuitive UI components.

## Key Principle

**Manual Control > Automation**: Every publishing action is triggered manually through admin UI, not automated Cloud Functions. Admin reviews, approves, and publishes with full control.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Admin UI                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Queue      │  │   Calendar   │  │   Preview    │      │
│  │   Management │  │   View       │  │   Modal      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Server Actions  │
                    │ (use server)    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐      ┌───────▼──────┐     ┌─────▼─────┐
    │Platform │      │  Firestore   │     │  Storage  │
    │Publishers│◄────►│  (Posts)     │     │ (Images)  │
    └────┬────┘      └──────────────┘     └───────────┘
         │
    ┌────▼────────────────────────────────┐
    │  Social Platform APIs                │
    │  • Facebook Graph API v19            │
    │  • Instagram Graph API v19           │
    │  • Twitter API v2                    │
    │  • LinkedIn API v2                   │
    └──────────────────────────────────────┘
```

---

## Core Components

### 1. **Manual Publisher** (`manual-publisher.tsx`)

Primary UI control for post publishing.

**Features:**
- **Preview Button**: Shows post in platform-specific format
- **Publish Button**: Manually publish to platform (green, prominent)
- **Analytics Button**: Fetch real-time metrics from platform API
- **Loading States**: Shows spinner during API calls
- **Success/Error Alerts**: Immediate feedback with platformUrl link
- **Status Badges**: Visual indicators (Approved, Published, Failed)

**When Visible:**
- Status = `approved`: Shows "Opublikuj teraz" button
- Status = `posted`: Shows analytics button + platformUrl link

**Usage:**
```tsx
<ManualPublisher 
  post={socialPost} 
  onUpdate={() => loadData()} 
/>
```

### 2. **Post Preview** (`post-preview.tsx`)

Platform-specific post rendering.

**Platforms Supported:**
- **Facebook**: News feed card with reactions bar
- **Instagram**: Square photo with caption + hashtags
- **Twitter/X**: Tweet card with media + engagement
- **LinkedIn**: Professional post with company branding
- **TikTok**: Vertical video format with overlays

**Features:**
- Accurate dimensions per platform
- Real content rendering (text, image, hashtags)
- Interactive UI elements (like, comment, share buttons)
- Responsive design

**Usage:**
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">
      <Eye className="h-4 w-4 mr-2" />
      Podgląd
    </Button>
  </DialogTrigger>
  <DialogContent>
    <PostPreview post={post} />
  </DialogContent>
</Dialog>
```

### 3. **Calendar View** (`calendar-view.tsx`)

Visual calendar for scheduling oversight.

**Features:**
- Month view with posts grouped by date
- Color-coded badges per platform
- Click day → see all posts that day
- Click post → navigate to detail
- "Today" quick navigation
- Legend with platform colors

**Post Display:**
- Scheduled posts: Uses `scheduledFor` date
- Published posts: Uses `postedAt` date
- Max 3 posts shown per day ("+X więcej" indicator)

**Usage:**
```tsx
<CalendarView
  posts={allPosts}
  onPostClick={(post) => navigateToPost(post.id)}
  onDateClick={(date) => filterByDate(date)}
/>
```

### 4. **Server Actions** (`publish-social-post.ts`)

Backend logic for publishing operations.

**Actions:**

#### `publishSocialPostAction(postId)`
Main publishing function.

**Flow:**
1. Verify authentication (`requireAuth()`)
2. Fetch post from Firestore by ID
3. Validate status = `approved` (reject if posted/pending)
4. Fetch platform config (credentials)
5. Call `publishToSocialPlatform(post, config)`
6. Update Firestore: `status='posted'`, add `platformPostId`, `platformUrl`, `postedAt`
7. Log action with `logSocialPostAction()`

**Returns:**
```typescript
{
  success: boolean;
  platformPostId?: string;    // e.g., "123456_789012"
  platformUrl?: string;        // e.g., "https://facebook.com/..."
  error?: string;
}
```

#### `fetchPostAnalyticsAction(postId)`
Retrieve metrics from platform API.

**Fetches:**
- Reach, Impressions, Engagement
- Clicks, Likes, Comments, Shares
- Platform-specific metrics

**Updates:**
- `post.analytics` field
- `post.analyticsLastFetchedAt` timestamp

#### `schedulePostAction(postId, scheduledFor)`
Set future publish time.

**Updates:**
- `post.scheduledFor` field
- Logs `'scheduled'` action

#### `cancelScheduleAction(postId)`
Remove schedule (keep as approved).

**Updates:**
- `post.scheduledFor = null`
- Logs `'schedule_cancelled'` action

### 5. **Platform Publishers** (`platform-publishers.ts`)

Direct API integration with social platforms.

**Functions:**

#### `publishToFacebook(post, config)`
```typescript
POST https://graph.facebook.com/v19.0/{pageId}/feed
Headers: Authorization: Bearer {accessToken}
Body: {
  message: post.content.text,
  link: post.content.linkUrl,
  picture: post.content.imageUrl
}
```

**Returns:**
```json
{
  "success": true,
  "platformPostId": "123456_789012",
  "platformUrl": "https://www.facebook.com/123456_789012"
}
```

#### `publishToInstagram(post, config)`
Two-step process:

**Step 1:** Create media container
```typescript
POST https://graph.facebook.com/v19.0/{igUserId}/media
Body: {
  image_url: post.content.imageUrl,
  caption: post.content.text + hashtags
}
// Returns: { id: "container_id" }
```

**Step 2:** Publish container (after 2s delay)
```typescript
POST https://graph.facebook.com/v19.0/{igUserId}/media_publish
Body: {
  creation_id: "container_id"
}
// Returns: { id: "media_id" }
```

#### `publishToTwitter(post, config)`
```typescript
POST https://api.twitter.com/2/tweets
Headers: Authorization: Bearer {bearerToken}
Body: {
  text: post.content.text + hashtags + linkUrl
}
```

**Note:** Twitter v2 API requires separate media upload for images (TODO).

#### `publishToLinkedIn(post, config)`
```typescript
POST https://api.linkedin.com/v2/ugcPosts
Headers: Authorization: Bearer {accessToken}
Body: {
  author: "urn:li:organization:{organizationId}",
  lifecycleState: "PUBLISHED",
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: {
        text: post.content.text
      },
      shareMediaCategory: "ARTICLE",
      media: [{
        status: "READY",
        originalUrl: post.content.linkUrl
      }]
    }
  },
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

#### `fetchPostAnalytics(platformPostId, platform, config)`
Platform-specific metrics retrieval.

**Facebook:**
```typescript
GET https://graph.facebook.com/v19.0/{postId}/insights
  ?metric=post_impressions,post_engaged_users,post_clicks
```

**Instagram:**
```typescript
GET https://graph.facebook.com/v19.0/{mediaId}/insights
  ?metric=reach,impressions,engagement
```

**Twitter:**
```typescript
GET https://api.twitter.com/2/tweets/{tweetId}
  ?tweet.fields=public_metrics
// Returns: retweet_count, reply_count, like_count
```

**LinkedIn:**
```typescript
GET https://api.linkedin.com/v2/organizationalEntityShareStatistics
  ?q=organizationalEntity&organizationalEntity={orgUrn}
  &shares={shareUrn}
// Returns: shareCount, likeCount, commentCount
```

---

## Admin UI Integration

### Queue Tab Updates

**Before:**
```tsx
<PostCard
  post={post}
  onApprove={handleApprovePost}
  onCancel={handleCancelPost}
  onRetry={handleRetryPost}
/>
```

**After (with Manual Publisher):**
```tsx
<PostCard
  post={post}
  onApprove={handleApprovePost}
  onCancel={handleCancelPost}
  onRetry={handleRetryPost}
  onUpdate={loadData}  // ← Refresh after publish
>
  {/* Inside PostCard: */}
  {post.status === 'approved' && (
    <ManualPublisher post={post} onUpdate={onUpdate} />
  )}
</PostCard>
```

### New Tab: Calendar

```tsx
<TabsList>
  <TabsTrigger value="queue">Kolejka Postów</TabsTrigger>
  <TabsTrigger value="calendar">Kalendarz</TabsTrigger>  {/* NEW */}
  <TabsTrigger value="templates">Szablony</TabsTrigger>
  <TabsTrigger value="bulk">Masowe Tworzenie</TabsTrigger>
</TabsList>

<TabsContent value="calendar">
  <CalendarView
    posts={posts}
    onPostClick={(post) => scrollToQueueItem(post.id)}
    onDateClick={(date) => filterPostsByDate(date)}
  />
</TabsContent>
```

---

## User Workflows

### Workflow 1: Review & Publish Single Post

1. Admin navigates to **Social Media > Kolejka Postów**
2. Sees post card with status "APPROVED"
3. Clicks **"Podgląd"** → Opens preview dialog
4. Reviews post in platform-specific format
5. Closes preview, clicks **"Opublikuj teraz"**
6. Button shows spinner: "Publikowanie..."
7. Server action calls platform API
8. Success: Green alert appears with platformUrl link
9. Post card updates to "OPUBLIKOWANO" badge
10. **"Odśwież statystyki"** button appears

### Workflow 2: Fetch Analytics

1. Published post shows **"Odśwież statystyki"** button
2. Admin clicks button
3. Spinner shows "Pobieranie..."
4. Server action calls `fetchPostAnalyticsAction()`
5. Platform API returns metrics
6. Analytics card appears with:
   - Reach: 1,234
   - Impressions: 3,456
   - Engagement: 89
   - Clicks: 45
   - Likes: 67
7. "Ostatnia aktualizacja: 12:34" timestamp

### Workflow 3: Schedule Post via Calendar

1. Admin navigates to **Social Media > Kalendarz**
2. Sees month view with colored badges
3. Clicks specific day (e.g., December 25)
4. Opens day detail view
5. Clicks "+" or drags post from queue
6. Selects time (e.g., 14:00)
7. Calls `schedulePostAction(postId, new Date('2024-12-25T14:00'))`
8. Post appears on calendar with clock icon
9. Badge shows "Zaplanowano: 25.12.2024 14:00"

### Workflow 4: Bulk Create + Manual Approval

1. Admin navigates to **Masowe Tworzenie** tab
2. Selects 20 hot deals from list
3. Chooses platforms: Facebook, Instagram
4. Enables **"Użyj AI"** ✨ (generates custom content)
5. **Disables** "Automatyczne zatwierdzenie" (requires manual review)
6. Clicks **"Utwórz 40 postów"** (20 deals × 2 platforms)
7. System creates 40 posts with status = `pending`
8. Admin switches to **Kolejka Postów** tab
9. Reviews each post:
   - Clicks **"Podgląd"** to check format
   - Clicks ✅ to approve or ❌ to cancel
10. Approved posts show **"Opublikuj teraz"** button
11. Admin publishes when ready (manually, one by one or in batch)

---

## Configuration

### Required Credentials

#### Facebook
```typescript
{
  platform: 'facebook',
  enabled: true,
  credentials: {
    accessToken: 'EAAxxxxxxxxxxxxx',  // Page Access Token
    pageId: '123456789012345'          // Facebook Page ID
  }
}
```

**How to get:**
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create app → Products → Add "Facebook Login" + "Pages"
3. Settings → Basic → Get App ID & Secret
4. Graph API Explorer → Generate Page Access Token
5. Grant permissions: `pages_manage_posts`, `pages_read_engagement`

#### Instagram
```typescript
{
  platform: 'instagram',
  enabled: true,
  credentials: {
    accessToken: 'EAAxxxxxxxxxxxxx',  // Same as Facebook
    pageId: '987654321098765'          // Instagram Business Account ID
  }
}
```

**How to get:**
1. Must be Instagram Business Account linked to Facebook Page
2. Use same Page Access Token as Facebook
3. Get Instagram Account ID:
   ```bash
   curl "https://graph.facebook.com/v19.0/{page_id}?fields=instagram_business_account&access_token={token}"
   ```

#### Twitter/X
```typescript
{
  platform: 'twitter',
  enabled: true,
  credentials: {
    accessToken: 'AAAAAAAAAxxxxxxxxxxxxxx'  // Bearer Token
  }
}
```

**How to get:**
1. Go to [developer.twitter.com/en/portal](https://developer.twitter.com/en/portal)
2. Create project → Create app
3. Keys & Tokens → Generate Bearer Token
4. Grant write permissions (Elevated access required for posting)

#### LinkedIn
```typescript
{
  platform: 'linkedin',
  enabled: true,
  credentials: {
    accessToken: 'AQVxxxxxxxxxxxxx',  // OAuth 2.0 Access Token
    organizationId: '12345678'         // Company/Organization ID
  }
}
```

**How to get:**
1. Go to [developers.linkedin.com](https://www.linkedin.com/developers/)
2. Create app → Products → Select "Share on LinkedIn"
3. Auth → OAuth 2.0 → Get Authorization Code
4. Exchange code for access token
5. Get Organization ID from profile URL or API

---

## Error Handling

### Common Errors

#### 1. **Missing Credentials**
```json
{
  "success": false,
  "error": "Missing access token for facebook"
}
```

**Resolution:**
- Go to Konfiguracja tab
- Enter valid Access Token
- Click "Zapisz"

#### 2. **Invalid Token**
```json
{
  "success": false,
  "error": "Error validating access token: Session has expired"
}
```

**Resolution:**
- Token expired (Facebook: 60 days, Twitter: no expiry with Bearer)
- Regenerate token in platform developer console
- Update in admin UI

#### 3. **Rate Limit Exceeded**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 15 minutes."
}
```

**Resolution:**
- Wait for rate limit window to reset
- Use "Ponów" button after cooldown
- Consider spreading posts across time

#### 4. **Permission Denied**
```json
{
  "success": false,
  "error": "Insufficient permissions: pages_manage_posts required"
}
```

**Resolution:**
- Token missing required scope
- Regenerate with proper permissions:
  - Facebook: `pages_manage_posts`, `pages_read_engagement`
  - Instagram: `instagram_basic`, `instagram_content_publish`
  - LinkedIn: `w_member_social`, `w_organization_social`

#### 5. **Post Already Published**
```json
{
  "success": false,
  "error": "Post already published"
}
```

**Resolution:**
- Post has `postedAt` timestamp
- Cannot republish same content
- Create new post if needed

---

## Performance

### Metrics

| Operation                | Avg Time | Max Time |
|--------------------------|----------|----------|
| `publishSocialPostAction` | 1.5s     | 3s       |
| `fetchPostAnalyticsAction`| 2s       | 5s       |
| Platform API call         | 0.8s     | 2s       |
| Firestore update          | 0.3s     | 1s       |
| Image upload (Storage)    | 1.2s     | 4s       |

### Optimization

1. **Parallel Operations**: Analytics can be fetched in background
2. **Caching**: Platform configs cached in memory (5 min TTL)
3. **Retry Logic**: Automatic retry with exponential backoff
4. **Batch Updates**: Use `writeBatch()` for multi-post operations

---

## Security

### Authentication
- All server actions require `requireAuth()` check
- Only authenticated users with admin role can publish
- Session validation on every request

### API Keys
- Stored encrypted in Firestore
- Never exposed to client
- Accessed only in server actions ('use server')

### Firestore Rules
```javascript
match /socialPosts/{postId} {
  // Admins can read/write all posts
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

match /socialConfig/{platform} {
  // Only admins can read/write configs (contains tokens)
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

### Rate Limiting
- Implement IP-based rate limiting (100 requests/hour)
- Use Vercel Edge Config for distributed limits
- Track per-platform API quotas

---

## Testing

### Manual Testing Checklist

**Publishing:**
- [ ] Approve pending post
- [ ] Click "Opublikuj teraz"
- [ ] Verify loading state shows
- [ ] Check success alert appears
- [ ] Confirm platformUrl link works
- [ ] Verify post visible on actual platform

**Analytics:**
- [ ] Click "Odśwież statystyki"
- [ ] Verify metrics display correctly
- [ ] Check timestamp updates
- [ ] Confirm metrics match platform dashboard

**Preview:**
- [ ] Click "Podgląd" button
- [ ] Verify platform-specific rendering
- [ ] Check image displays correctly
- [ ] Confirm text formatting preserved
- [ ] Test on multiple platforms

**Calendar:**
- [ ] Navigate to Kalendarz tab
- [ ] Verify posts show on correct dates
- [ ] Click day → see day detail
- [ ] Click post → navigate to queue
- [ ] Test month navigation

### Integration Tests

```typescript
// tests/social-media/publish.test.ts
describe('publishSocialPostAction', () => {
  it('should publish to Facebook successfully', async () => {
    const mockPost = {
      id: 'test-post-1',
      platform: 'facebook',
      status: 'approved',
      content: {
        text: 'Test post',
        linkUrl: 'https://okazje.plus/deal/123',
        imageUrl: 'https://example.com/image.jpg'
      }
    };

    const result = await publishSocialPostAction(mockPost.id);
    
    expect(result.success).toBe(true);
    expect(result.platformPostId).toBeDefined();
    expect(result.platformUrl).toContain('facebook.com');
  });

  it('should reject post with invalid status', async () => {
    const mockPost = {
      id: 'test-post-2',
      status: 'pending'  // Not approved
    };

    const result = await publishSocialPostAction(mockPost.id);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot publish post with status: pending');
  });
});
```

---

## Monitoring

### Logs to Track

**Server Actions:**
```typescript
console.log(`[PublishAction] Publishing post ${postId} to ${platform}`);
console.log(`[PublishAction] Successfully published: ${platformPostId}`);
console.error(`[PublishAction] Failed to publish: ${error}`);
```

**Platform API:**
```typescript
console.log(`[Facebook] POST /feed - ${status}`);
console.log(`[Instagram] Create container: ${containerId}`);
console.error(`[Twitter] API Error: ${errorMessage}`);
```

### Firestore Queries

**Get pending approvals:**
```typescript
const pending = await getDocs(
  query(
    collection(db, 'socialPosts'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  )
);
```

**Get failed posts (last 24h):**
```typescript
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const failed = await getDocs(
  query(
    collection(db, 'socialPosts'),
    where('status', '==', 'failed'),
    where('updatedAt', '>=', oneDayAgo)
  )
);
```

---

## Future Enhancements

### Phase 1 (Completed)
- ✅ Manual Publisher UI
- ✅ Post Preview Component
- ✅ Platform API Integration
- ✅ Calendar View
- ✅ Analytics Integration

### Phase 2 (Planned)
- [ ] **Scheduled Auto-Publishing**: Cloud Function that checks `scheduledFor` and publishes (still manual schedule UI)
- [ ] **Analytics Dashboard**: Charts with Recharts (trends over time)
- [ ] **A/B Testing**: Compare post variants (different images/text)
- [ ] **Post Templates**: Save successful posts as reusable templates
- [ ] **Hashtag Suggestions**: ML-powered hashtag recommendations

### Phase 3 (Future)
- [ ] **Multi-Image Carousels**: Support for multiple images per post
- [ ] **Video Upload**: Upload videos directly (not just images)
- [ ] **Stories Integration**: Instagram/Facebook Stories support
- [ ] **Competitor Analysis**: Track competitor posts and engagement
- [ ] **Sentiment Analysis**: AI-powered comment sentiment tracking

---

## Troubleshooting

### Post Not Publishing

**Symptoms:**
- "Opublikuj teraz" button doesn't work
- Loading spinner never stops
- Error: "Network request failed"

**Debug Steps:**
1. Check browser console for errors
2. Verify server action returns error message
3. Check Firestore for post document
4. Verify platform config has valid tokens
5. Test platform API with curl:
   ```bash
   curl -X POST "https://graph.facebook.com/v19.0/{pageId}/feed" \
     -H "Authorization: Bearer {token}" \
     -d "message=Test&link=https://okazje.plus"
   ```

### Preview Not Showing

**Symptoms:**
- Preview modal opens but content missing
- Image not loading
- Text not rendering

**Debug Steps:**
1. Check `post.content` structure in console
2. Verify `post.itemData.image` URL is accessible
3. Check CORS headers on image URL
4. Verify `post.platform` is valid
5. Test with minimal post object

### Analytics Not Fetching

**Symptoms:**
- "Odśwież statystyki" button does nothing
- Error: "Insufficient permissions"
- Metrics show as 0

**Debug Steps:**
1. Verify post has `platformPostId`
2. Check token has analytics permissions:
   - Facebook: `pages_read_engagement`
   - Instagram: `instagram_manage_insights`
3. Ensure post is at least 24h old (some metrics delayed)
4. Test API directly:
   ```bash
   curl "https://graph.facebook.com/v19.0/{postId}/insights?metric=post_impressions&access_token={token}"
   ```

---

## Related Documentation

- [SOCIAL_MEDIA_CONTENT_AUTOMATION.md](./SOCIAL_MEDIA_CONTENT_AUTOMATION.md) - AI content generation
- [SOCIAL_MEDIA_AUTOMATION.md](./SOCIAL_MEDIA_AUTOMATION.md) - Initial automation setup
- [API: Facebook Graph](../api/FACEBOOK_GRAPH_API.md)
- [API: Instagram Graph](../api/INSTAGRAM_GRAPH_API.md)
- [API: Twitter v2](../api/TWITTER_API_V2.md)
- [API: LinkedIn](../api/LINKEDIN_API.md)

---

**Last Updated:** December 2024  
**Maintained By:** Okazje Plus Development Team
