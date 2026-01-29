# ⚡ UI OPTIMIZATION - QUICK START CHECKLIST

**Goal:** Improve Lighthouse from 62 → 92, LCP from 3.2s → 1.5s  
**Duration:** 3-4 weeks, 1-2 devs  
**Status:** Ready to start

---

## 📋 PHASE 0: PREPARATION (Today - 1 hour)

- [ ] Read `UI_OPTIMIZATION_EXECUTIVE_SUMMARY.md`
- [ ] Read `UI_OPTIMIZATION_ANALYSIS.md` (sections 1-2)
- [ ] Review new hook files:
  - `src/hooks/use-card-base-state.ts` ✅ Created
  - `src/hooks/use-smart-poll.ts` ✅ Created
- [ ] Review new UI components:
  - `src/components/ui/card-header.tsx` ✅ Created
  - `src/components/ui/card-body.tsx` ✅ Created
  - `src/components/ui/card-footer.tsx` ✅ Created
  - `src/components/lazy-card.tsx` ✅ Created
- [ ] Create git branch: `git checkout -b feat/ui-optimization`
- [ ] Install dependencies (if needed):
  ```bash
  npm install react-window react-virtualized-auto-sizer
  ```

---

## 🔧 WEEK 1: RENDERING OPTIMIZATION (40% improvement)

### Day 1-2: React.memo + Custom Comparator
- [ ] Open `src/components/deal-card.tsx`
- [ ] Follow `IMPLEMENTATION_WEEK1_DEAL_CARD.md` - KROK 1
- [ ] Wrap `DealCard` in `React.memo()` with custom comparator
- [ ] Test: `npm run build` (no errors)
- [ ] Commit: `"feat: add React.memo to DealCard with smart comparator"`

### Day 2-3: Consolidate State
- [ ] Follow `IMPLEMENTATION_WEEK1_DEAL_CARD.md` - KROK 2
- [ ] Replace 20+ useState → single `cardState` object
- [ ] Update all `setTemperature()` → `setCardState(prev => ...)`
- [ ] Test: `npm run typecheck` (no errors)
- [ ] Commit: `"refactor: consolidate DealCard state to single object"`

### Day 3: Add useCardBaseState Hook
- [ ] Follow `IMPLEMENTATION_WEEK1_DEAL_CARD.md` - KROK 3
- [ ] Use new `useCardBaseState()` hook
- [ ] Remove duplicate: `useCurrency`, `useFavorites`, `useContentLanguage`, `useAuth`, `useComparison`
- [ ] Test: `npm run build && npm run lint`
- [ ] Commit: `"refactor: extract common card state to useCardBaseState hook"`

### Day 4: Remove isMounted Pattern
- [ ] Follow `IMPLEMENTATION_WEEK1_DEAL_CARD.md` - KROK 4
- [ ] Remove `isMounted` useState + useEffect
- [ ] Replace with `useAuth()` guard (already has hydration protection)
- [ ] Test: No hydration warnings in DevTools
- [ ] Commit: `"fix: remove isMounted pattern, use useAuth guard"`

### Day 5: Image Optimization + Testing
- [ ] Follow `IMPLEMENTATION_WEEK1_DEAL_CARD.md` - KROK 5
- [ ] Add `loading="lazy"` to Image component
- [ ] Add `placeholder="blur"` with blurhash
- [ ] Optimize quality to 75%
- [ ] Run Lighthouse: `npm run build && lighthouse http://localhost:9002`
- [ ] Expected: **LCP 3.2s → 2.3s, Lighthouse +10 points**
- [ ] Commit: `"perf: optimize image loading in DealCard"`

### End of Week 1
- [ ] Apply same pattern to `src/components/product-card.tsx`
- [ ] Benchmark before/after (save screenshots)
- [ ] Create PR for review
- [ ] Merge to staging branch

**Cumulative Improvement:** LCP 3.2s → 2.3s (-28%), Re-renders -40%

---

## 🎨 WEEK 2: CODE CLEANUP (30% improvement)

### Day 1: Extract CardHeader Component
- [ ] Review `src/components/ui/card-header.tsx` (already created!)
- [ ] Update deal-card.tsx to use:
  ```tsx
  <CardHeader
    image={deal.imageUrl}
    title={deal.title}
    badge={<ExpiredDealBadge deal={deal} />}
    onFavorite={() => toggleFavorite()}
    isFavorited={isFavorited}
  />
  ```
- [ ] Test: Component renders correctly
- [ ] Commit: `"refactor: use CardHeader component in DealCard"`

### Day 2: Extract CardBody + CardFooter
- [ ] Review components (already created!)
- [ ] Refactor deal-card to use CardBody, CardFooter
- [ ] Remove inline styling from these sections
- [ ] Expected: Deal-card.tsx reduces from 1055 → 400 lines
- [ ] Commit: `"refactor: extract CardBody/CardFooter components"`

### Day 3: Reduce Component Size
- [ ] Extract vote logic → `VoteSection` component
- [ ] Extract rating → `RatingSection` component
- [ ] Extract badges → `BadgeSection` component
- [ ] Goal: Each sub-component < 100 lines
- [ ] Commit: `"refactor: extract DealCard sections into sub-components"`

### Day 4: Remove Duplicate Code
- [ ] Compare deal-card.tsx vs product-card.tsx
- [ ] Extract common logic into shared hooks
- [ ] Update product-card to use same patterns
- [ ] Expected: -250 lines of duplicate code
- [ ] Commit: `"refactor: remove duplicate code from ProductCard"`

### Day 5: Testing + Documentation
- [ ] Run Lighthouse: `npm run build && lighthouse`
- [ ] Expected: **Bundle size -15%, Maintainability +30%**
- [ ] Update component documentation
- [ ] Create PR for review

**Cumulative Improvement:** Bundle -15%, Code -400 lines, +30% maintainability

---

## ⚡ WEEK 3: VIRTUALIZATION (40% improvement)

### Day 1-2: Implement React.window
- [ ] Install: `npm install react-window react-virtualized-auto-sizer`
- [ ] Update `src/components/home-client.tsx`:
  ```tsx
  import { FixedSizeGrid } from 'react-window';
  import AutoSizer from 'react-virtualized-auto-sizer';
  
  <AutoSizer>
    {({ height, width }) => (
      <FixedSizeGrid
        columnCount={4}
        columnWidth={width / 4}
        height={height}
        rowCount={Math.ceil(deals.length / 4)}
        rowHeight={300}
        width={width}
      >
        {/* Render only visible cells */}
      </FixedSizeGrid>
    )}
  </AutoSizer>
  ```
- [ ] Test: Render 100+ cards without lag
- [ ] Commit: `"perf: add react-window virtualization to home page"`

### Day 3: Lazy Load Card Images
- [ ] Use native `loading="lazy"`
- [ ] Generate blurhash for placeholder
- [ ] Add `quality={75}` to Image component
- [ ] Expected: **FCP 2.5s → 1.5s**
- [ ] Commit: `"perf: add lazy image loading with blur placeholders"`

### Day 4: Dynamic Imports for Heavy Components
- [ ] Use `next/dynamic` for admin dashboards
- [ ] Use `next/dynamic` for heavy visualizations
- [ ] Add loading skeletons
- [ ] Expected: **Initial bundle -20%**
- [ ] Commit: `"perf: add dynamic imports for heavy components"`

### Day 5: Smart Polling Hook
- [ ] Use new `useSmartPoll()` hook (already created!)
- [ ] Update `src/components/notification-bell.tsx`:
  ```tsx
  const notifications = useSmartPoll(
    async () => getNotifications(user.uid),
    30000 // Only poll when page visible
  );
  ```
- [ ] Expected: **-50% battery drain, CPU idle 99%**
- [ ] Commit: `"perf: add visibility-aware polling with useSmartPoll"`

### End of Week 3
- [ ] Full Lighthouse audit
- [ ] Expected: **FCP 1.2s, LCP 1.5s, Lighthouse 92**
- [ ] Performance monitoring setup
- [ ] Create PR for review

**Cumulative Improvement:** FCP -50%, LCP -53%, Memory -60%, 60 FPS scroll

---

## 🧪 WEEK 4: TESTING & LAUNCH (Validation)

### Day 1-2: Comprehensive Testing
- [ ] Chrome DevTools: No hydration warnings
- [ ] React DevTools Profiler: Check re-renders
- [ ] Lighthouse: Score 90+
- [ ] Mobile testing: Real iPhone + Android devices
- [ ] **Before/After:** Screenshot comparisons

### Day 3: Performance Monitoring
- [ ] Set up Lighthouse CI
- [ ] Set up Web Vitals dashboard
- [ ] Create alerts for regressions
- [ ] Document baseline metrics

### Day 4: Staging Deployment
- [ ] Deploy to staging environment
- [ ] Test with real users (QA team)
- [ ] Verify no bugs
- [ ] Load test (50+ concurrent users)

### Day 5: Production Launch
- [ ] Create feature flag (10% → 50% → 100%)
- [ ] Deploy to production (10% traffic)
- [ ] Monitor Core Web Vitals
- [ ] Gradual rollout over 3 days
- [ ] Final deployment to 100%

**Deliverables:**
- ✅ Before/After screenshots
- ✅ Performance report
- ✅ Lighthouse audit
- ✅ Core Web Vitals dashboard
- ✅ Runbook for rollback

---

## 📊 SUCCESS METRICS

### Must-Have (Week 1-2)
- ✅ LCP < 2.5s (currently 3.2s)
- ✅ Zero hydration warnings
- ✅ No breaking changes
- ✅ Lighthouse 75+ (currently 62)

### Should-Have (Week 2-3)
- ✅ LCP < 2.0s
- ✅ FCP < 1.8s
- ✅ Lighthouse 85+
- ✅ 60 FPS scrolling

### Nice-to-Have (Week 3-4)
- ✅ LCP < 1.5s
- ✅ Lighthouse 92+
- ✅ CLS < 0.1
- ✅ All Core Web Vitals Green

---

## 🔄 GIT WORKFLOW

```bash
# Week 1 Start
git checkout -b feat/ui-optimization
git pull origin main

# Daily commits
git add .
git commit -m "feat: $(description)"
git push origin feat/ui-optimization

# End of Week 1
git push origin feat/ui-optimization
# Create PR: feat/ui-optimization → staging

# After review
git merge --squash
git push origin staging
# Deploy to staging environment

# After testing (Week 4)
git merge → main
git push origin main
# Deploy to production with feature flag
```

---

## ⚠️ GOTCHAS & SOLUTIONS

### Hydration Mismatch
**Problem:** Button rendering differently on client vs server  
**Solution:** Use `suppressHydrationWarning` on body, guard with `useAuth()`

### React.memo Not Helping
**Problem:** Parent re-renders all children anyway  
**Solution:** Use custom comparator, not default shallow comparison

### Virtualization Breaks Styling
**Problem:** react-window breaks CSS (height mismatches)  
**Solution:** Use `FixedSizeGrid`, test width/height calculations

### Image Blur Not Showing
**Problem:** blurhash undefined  
**Solution:** Pre-generate blurhash on API, store in Firestore

### Polling Still Runs When Hidden
**Problem:** browser.hidden not detected  
**Solution:** Add `visibilitychange` listener with console log for debugging

---

## 📞 SUPPORT & ESCALATION

### Questions?
- See `UI_OPTIMIZATION_ANALYSIS.md` for detailed architecture
- See `IMPLEMENTATION_WEEK1_DEAL_CARD.md` for code patterns

### Blockers?
- Performance regression? → Check git history, revert
- Component broken? → Check console, test in isolation
- Merge conflicts? → Use `git merge --strategy-option=theirs`

### Review Process
- Week 1: PR review within 24h
- Week 2: Code quality check
- Week 3: Performance audit
- Week 4: Production sign-off

---

## 🎉 FINAL CHECKLIST

- [ ] All 4 optimization phases complete
- [ ] Lighthouse score 90+
- [ ] No console errors/warnings
- [ ] Mobile testing passed
- [ ] Core Web Vitals green
- [ ] Performance monitoring active
- [ ] Team trained on new patterns
- [ ] Documentation updated
- [ ] Rollback plan tested

**Expected Total Time:** 3-4 weeks  
**Expected Improvement:** -50% load time, +30 Lighthouse points  
**Expected ROI:** 4-8x over 90 days

---

**Ready to start? Create the git branch and begin Week 1! 🚀**

