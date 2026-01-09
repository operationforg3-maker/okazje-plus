# UI Audit - Brakujące Krytyczne CTA i Funkcje Użytkownika

**Data:** 18 grudnia 2025  
**Status:** 🔴 KRYTYCZNE BRAKI ZIDENTYFIKOWANE

---

## 1. STRONA GŁÓWNA / HERO (`/src/app/[locale]/home-client.tsx`)

### ✅ Co jest
- Search bar z CTA "Szukaj"
- Hero tagline
- RealTimeStats
- Category grid link
- Hot deals showcase

### ❌ Co brakuje (KRYTYCZNE)
```
BRAK GŁÓWNYCH CTA DLA UŻYTKOWNIKA:
- ❌ "Dołącz do społeczności" / Register CTA
- ❌ "Sprawdź najgorętsze okazje" (górny fold)
- ❌ "Dodaj swoją okazję" (Add Deal button) - KRYTYCZNE
- ❌ "Zobacz produkty" - categoria produktów brakuje
- ❌ Newsletter subscribe CTA
- ❌ "Jak to działa?" / onboarding link
- ❌ Social proof section (liczba osób, okazji znalezionych)
```

### Rekomendacja
```tsx
// Dodać przed/po RealTimeStats:
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
  <Button size="lg" asChild>
    <Link href="/deals">
      <Flame className="mr-2" />
      Gorące Okazje ({hotDealsCount})
    </Link>
  </Button>
  
  <Button size="lg" asChild>
    <Link href="/products">
      <Package className="mr-2" />
      Produkty ({productsCount})
    </Link>
  </Button>
  
  <Button size="lg" variant="outline" asChild>
    <Link href="/add-deal">
      <Plus className="mr-2" />
      Dodaj Okazję
    </Link>
  </Button>
</div>
```

---

## 2. STRONA OKAZJI (`/src/app/[locale]/deals/page.tsx`)

### ✅ Co jest
- Search bar
- Category filters
- Sort options
- View mode toggle (list/grid)
- Card density settings
- Save filters option
- Vote system (temperatura)
- Comment count badge

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ "Dodaj nową okazję" CTA (button w top section)
- ❌ "Zapisz do moich okazji" / Bookmark button (per deal)
- ❌ Share button (social, copy link) - TYLKO dla produktów
- ❌ "Udostępnij ze społecznością" button
- ❌ Alert/notification setup CTA (price drop alert)
- ❌ Export filtered results (CSV/PDF)
- ❌ "Powiadom mnie" CTA dla dostępności
```

### Rekomendacja
Dodać przy Deal Card action buttons:
```tsx
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={handleBookmark}
  >
    <Bookmark className="w-4 h-4" />
  </Button>
  
  <Button
    variant="outline"
    size="sm"
    onClick={handleShare}
  >
    <Share2 className="w-4 h-4" />
  </Button>
  
  <Button
    variant="outline"
    size="sm"
    onClick={handlePriceAlert}
  >
    <Bell className="w-4 h-4" />
    Alert
  </Button>
</div>
```

---

## 3. STRONA PRODUKTÓW (`/src/app/[locale]/products/page.tsx`)

### ✅ Co jest
- Search + filters
- "Dodaj do wspólnego koszyka" button (secondary)
- Compare button
- Price info
- Rating display
- Category filters
- Sort options

### ❌ Co brakuje (KRYTYCZNE) 🔴🔴🔴
```
BRAK GŁÓWNYCH CTA NA PRODUCT CARD:
- ❌ "KUP TERAZ" / Direct affiliate button (PRIMARY - KRYTYCZNE!)
  → Button presente tylko na detail page, brakuje na grid/list view
- ❌ "Dodaj opinię" / Review CTA
- ❌ "Powiadom mnie o znizce" / Price alert button
- ❌ "Podziel się linkiem" - share button brakuje na card
- ❌ "Zapisz produkt" / wishlist button (present in detail, missing on card)
- ❌ "Zapytaj społeczność" - Q&A CTA
```

### Rekomendacja - URGENT
```tsx
// Na Product Card, dodać PRIMARY CTA:
<div className="flex flex-col gap-2 pt-2">
  {/* PRIMARY: Direct Purchase */}
  <Button 
    size="sm" 
    asChild
    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold"
  >
    <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
      🚀 Kup teraz
      <ExternalLink className="w-3 h-3 ml-2" />
    </a>
  </Button>
  
  {/* SECONDARY: Add to shared cart */}
  <Button
    variant="outline"
    size="sm"
    onClick={handleAddToCart}
  >
    🛒 Do koszyka
  </Button>
</div>
```

### Rekomendacja
Dodać na product card:
```tsx
<div className="grid grid-cols-2 gap-2 text-xs">
  <Button variant="ghost" size="sm">
    <Star className="w-3 h-3" /> Opinia
  </Button>
  <Button variant="ghost" size="sm">
    <Bell className="w-3 h-3" /> Alert
  </Button>
  <Button variant="ghost" size="sm">
    <Share2 className="w-3 h-3" /> Udostępnij
  </Button>
  <Button variant="ghost" size="sm">
    <MessageSquare className="w-3 h-3" /> Pytanie
  </Button>
</div>
```

---

## 4. PROFIL UŻYTKOWNIKA (`/src/app/[locale]/profile/page.tsx`)

### ✅ Co jest
- Profile settings link
- Saved searches (conditional)
- General profile page

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ "Moje okazje" tab (user-submitted deals list)
- ❌ "Moje produkty" / collections
- ❌ "Moje opinie" / reviews history
- ❌ "Zapisane" / bookmarks section
- ❌ "Alerty cenowe" / price alerts management
- ❌ "Moja aktywność" timeline
- ❌ "Udostępnione koszyki" list
- ❌ Edit profile CTA
- ❌ Change password/email CTA
- ❌ Manage notifications settings CTA
- ❌ Delete account CTA (GDPR)
```

### Rekomendacja
```tsx
// Dodać tabs:
const tabs = [
  { id: 'submitted', label: 'Moje okazje', icon: Flame },
  { id: 'saved', label: 'Zapisane', icon: Bookmark },
  { id: 'reviews', label: 'Moje opinie', icon: Star },
  { id: 'alerts', label: 'Alerty', icon: Bell },
  { id: 'activity', label: 'Aktywność', icon: TrendingUp },
  { id: 'shared-carts', label: 'Udostępnione koszyki', icon: Share2 },
  { id: 'settings', label: 'Ustawienia', icon: Settings },
];
```

---

## 5. STRONA LOGOWANIA (`/src/app/[locale]/login/page.tsx`)

### ✅ Co jest
- Login form
- Authenticatio UI

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ Visible "Sign up / Register" CTA (might be hidden in form)
- ❌ Social login buttons (Google, Facebook)
- ❌ "Zaloguj się bez hasła" CTA (magic link)
- ❌ "Nie masz konta? Zarejestruj się" link
- ❌ "Zapomniałeś hasła?" recovery link
- ❌ Demo account / Test account access CTA
```

### Rekomendacja
```tsx
// Po login form:
<div className="space-y-3">
  <p className="text-sm text-center text-muted-foreground">
    Nie masz konta?{' '}
    <Link href="/register" className="text-primary font-semibold">
      Zarejestruj się
    </Link>
  </p>
  
  <Link href="/forgot-password" className="text-xs text-center block text-muted-foreground hover:text-primary">
    Zapomniałeś hasła?
  </Link>
</div>
```

---

## 6. KOSZYK (`/src/app/[locale]/cart/page.tsx`)

### ✅ Co jest
- Add to cart button (product card level)
- Share cart feature
- Finalize cart (affiliate links)
- Item removal
- Quantity controls
- Cart summary

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ "Kontynuuj zakupy" CTA (when cart open)
- ❌ "Wyczyść koszyk" - present but confirmation dialog brakuje
- ❌ "Zapisz na później" / save for later option
- ❌ Apply coupon / promo code input
- ❌ Gift message input / personalization
- ❌ Order notes field
- ❌ "Porównaj ceny" CTA between cart items
- ❌ Bulk actions (select multiple items)
```

### Rekomendacja
```tsx
// Add above summary:
<div className="space-y-3">
  <Button variant="outline" className="w-full" asChild>
    <Link href="/products">
      ← Kontynuuj zakupy
    </Link>
  </Button>
  
  <div className="border-t pt-3">
    <Input
      placeholder="Kod rabatowy / Kupon..."
      onKeyDown={handleCoupon}
    />
  </div>
  
  <Textarea
    placeholder="Wiadomość dla sprzedawcy (opcjonalnie)"
    value={orderNotes}
    onChange={(e) => setOrderNotes(e.target.value)}
  />
</div>
```

---

## 7. STRONA FORUM (`/src/app/[locale]/forum/page.tsx`)

### ✅ Co jest
- Forum thread list
- Search

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ "Stwórz nowy wątek" / New discussion button (top visibility)
- ❌ "Odpowiedź" CTA per thread (action buttons)
- ❌ "Oznaczyć jako rozwiązane" button
- ❌ "Przydatne" / upvote button
- ❌ "Raportuj post" / flag button
- ❌ Subscribe to thread / notification CTA
- ❌ Sort options (newest, most answered, trending)
- ❌ Filter by category/tag CTA
```

### Rekomendacja
```tsx
// Top of page:
<div className="flex justify-between items-center">
  <h1>Forum - Pytania & Odpowiedzi</h1>
  <Button asChild>
    <Link href="/forum/new">
      + Nowy wątek
    </Link>
  </Button>
</div>
```

---

## 8. STRONA DODAJ OKAZJĘ (`/src/app/[locale]/add-deal/page.tsx`)

### ✅ Co jest
- Form fields
- Submit button

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ "Podgląd okazji" button (preview before submit)
- ❌ "Zapisz szkic" option
- ❌ "Anuluj" button (go back)
- ❌ Help tooltips / "?" icons per field
- ❌ Category picker visual guide with examples
- ❌ Image upload progress indicator
- ❌ "Dodaj więcej zdjęć" button
- ❌ Template / quick-fill options
- ❌ "Porównaj z podobnymi okazjami" CTA
```

### Rekomendacja
```tsx
// Action buttons:
<div className="flex gap-3">
  <Button variant="outline" onClick={handleSaveDraft}>
    💾 Zapisz szkic
  </Button>
  
  <Button variant="outline" onClick={handlePreview}>
    👁 Podgląd
  </Button>
  
  <Button onClick={handleSubmit} disabled={!isValid}>
    🚀 Opublikuj
  </Button>
</div>
```

---

## 9. NAVBAR / HEADER (ALL PAGES)

### ✅ Co jest
- Logo
- Search (location-dependent)
- User auth menu
- Cart badge

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ "Dodaj okazję" button (top-level, always visible)
- ❌ Notification bell with unread count
- ❌ Messages / inbox access
- ❌ Mobile hamburger menu (correct nav structure)
- ❌ Breadcrumb navigation (current path visibility)
- ❌ Quick links menu (categor1es, hot deals, forum)
- ❌ Language switcher (visible, not buried)
- ❌ Dark mode toggle (visible)
```

### Rekomendacja
```tsx
// Navbar layout:
<nav className="flex items-center gap-4">
  <Button asChild size="sm" className="hidden md:flex">
    <Link href="/add-deal">
      + Dodaj Okazję
    </Link>
  </Button>
  
  <Button variant="ghost" size="icon" onClick={openNotifications}>
    <Bell className="w-5 h-5" />
    {unreadCount > 0 && (
      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
        {unreadCount}
      </span>
    )}
  </Button>
  
  <UserMenu />
</nav>
```

---

## 10. FOOTER

### ✅ Co jest
- Minimal footer (likely)

### ❌ Co brakuje (KRYTYCZNE)
```
- ❌ Newsletter subscribe CTA (prominent)
- ❌ "O nas" / About link
- ❌ "Kontakt" / Contact form link
- ❌ Social media links (Twitter, Facebook, Instagram)
- ❌ "Regulamin" / Terms link
- ❌ "Polityka prywatności" link
- ❌ "FAQ" / Help center link
- ❌ "Report bug" / Feedback CTA
- ❌ Version / last update info
```

---

## PODSUMOWANIE - REKOMENDACJE PRIORYTETOWE

### 🔴 KRYTYCZNE (wdrożyć NATYCHMIAST)
1. **Product Card**: Add "🚀 Kup teraz" button (PRIMARY, direct purchase) - BIGGEST MISSING CTA
2. **Navbar**: Add "Dodaj Okazję" button (top-level visibility)
3. **Home**: Add "Dołącz / Register" prominent CTA + category buttons
4. **Deals**: Add "Bookmark" + "Share" + "Price Alert" buttons per deal
5. **Products**: Add "Save/Wishlist" + "Share" buttons on card view
6. **Login**: Add visible "Sign up" link + forgot password

### 🟡 WYSOKIE (wdrożyć w ciągu 1-2 tygodni)
1. Cart: Add coupon input, gift message, order notes
2. Forum: Add "New thread" top CTA + thread actions
3. Add Deal: Add preview + save draft options
4. Profile: Add settings/security section (change password, 2FA)

### 🟢 ŚREDNIE (wdrożyć w ciągu miesiąca)
1. Footer: Complete with newsletter, links, social
2. Notifications: Implement notification bell + unread count
3. Breadcrumbs: Add navigation context throughout app

---

## IMPLEMENTATION CHECKLIST

```
[ ] Product Card: Add "🚀 Kup teraz" PRIMARY button (BIGGEST PRIORITY)
[ ] Navbar "Dodaj Okazję" button
[ ] Home page category CTA buttons
[ ] Deals: Bookmark + Share + Alert buttons
[ ] Products: Wishlist + Share buttons on card
[ ] Profile: Complete dashboard with tabs
[ ] Login: Sign up + forgot password links
[ ] Cart: Coupon + notes fields
[ ] Forum: New thread + actions
[ ] Footer: Newsletter + links
[ ] Notifications: Bell + unread count
```

---

**Status Obecny:** ~55% ważnych CTA jest widocznych (brakuje głównego "Kup" na card)  
**Target:** >95% CTA accessibility w interface  
**Szacunkowy czas implementacji:** 3-4 godzin dev (głównie product card)
