# SEO Setup Guide - Google Search Console & Bing Webmaster Tools

## 📋 Przegląd

Ten przewodnik pomoże Ci skonfigurować narzędzia webmasterskie dla maksymalnej widoczności w wyszukiwarkach.

## 🔍 Google Search Console

### Krok 1: Weryfikacja własności

1. Przejdź do https://search.google.com/search-console
2. Kliknij **Add Property**
3. Wybierz **URL prefix**: `https://okazjeplus.pl`
4. Wybierz metodę weryfikacji: **HTML tag**

### Krok 2: Pobierz kod weryfikacyjny

Otrzymasz kod w formacie:
```html
<meta name="google-site-verification" content="ABC123XYZ..." />
```

Skopiuj część `ABC123XYZ...` (bez reszty tagu).

### Krok 3: Dodaj do zmiennych środowiskowych

```bash
# W pliku .env.local
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=ABC123XYZ...
```

### Krok 4: Deploy i weryfikacja

```bash
# Rebuild i deploy
npm run build
git add -A
git commit -m "feat(seo): add Google Search Console verification"
git push origin main
```

Poczekaj 5-10 minut na deployment, potem w Google Search Console kliknij **Verify**.

### Krok 5: Prześlij Sitemap

1. W Google Search Console przejdź do **Sitemaps** (lewa kolumna)
2. Dodaj nowy sitemap: `https://okazjeplus.pl/sitemap.xml`
3. Kliknij **Submit**

Sitemap zawiera:
- ~1000 najgorętszych okazji
- ~1000 najlepszych produktów
- 7 stron statycznych
- **Razem**: ~2000 URL

### Krok 6: Prześlij RSS Feed (opcjonalnie)

1. W **Sitemaps** dodaj również: `https://okazjeplus.pl/rss.xml`
2. RSS zawiera 50 najnowszych okazji + produktów

### Co monitorować w GSC?

| Metryka | Znaczenie | Akcja |
|---------|-----------|-------|
| **Impressions** | Ile razy pojawiliście się w wynikach | Monitoruj trendy |
| **Clicks** | Ile kliknięć dostaliście | Optymalizuj title/description |
| **CTR** | Click-through rate | Cel: >3% |
| **Average Position** | Średnia pozycja w wynikach | Cel: <20 |
| **Coverage** | Zindeksowane strony | Cel: ~2000 |
| **Core Web Vitals** | Szybkość strony | Cel: wszystkie zielone |

### Ważne raporty:

1. **Performance** → Query analysis
   - Jakie słowa kluczowe przynoszą ruch
   - Które strony mają najlepszy CTR
   - Gdzie jesteście słabo pozycjonowani

2. **Coverage** → Indexed pages
   - Czy wszystkie 2000 URL są zindeksowane
   - Czy są błędy crawlingu
   - Czy sitemap został przetworzony

3. **Enhancements** → Structured Data
   - Sprawdź czy Product/Offer schema są rozpoznawane
   - Sprawdź BreadcrumbList
   - Sprawdź WebSite search action

4. **Core Web Vitals**
   - LCP (Largest Contentful Paint): <2.5s
   - FID (First Input Delay): <100ms
   - CLS (Cumulative Layout Shift): <0.1

### Request Indexing

Dla najważniejszych stron możesz przyspieszyć indeksowanie:
1. W GSC wpisz URL w górnym pasku
2. Kliknij **Request Indexing**
3. Limit: ~10 requestów dziennie

## 🟦 Bing Webmaster Tools

### Krok 1: Weryfikacja własności

1. Przejdź do https://www.bing.com/webmasters
2. Zaloguj się (można przez Microsoft/Google/Facebook)
3. Kliknij **Add Site**
4. Wpisz: `https://okazjeplus.pl`
5. Wybierz metodę: **Add HTML tag to your site**

### Krok 2: Pobierz kod weryfikacyjny

Otrzymasz kod w formacie:
```html
<meta name="msvalidate.01" content="XYZ789ABC..." />
```

Skopiuj część `XYZ789ABC...`.

### Krok 3: Dodaj do zmiennych środowiskowych

```bash
# W pliku .env.local
NEXT_PUBLIC_BING_SITE_VERIFICATION=XYZ789ABC...
```

### Krok 4: Deploy i weryfikacja

```bash
npm run build
git add -A
git commit -m "feat(seo): add Bing Webmaster Tools verification"
git push origin main
```

Poczekaj 5-10 minut, potem kliknij **Verify** w Bing.

### Krok 5: Prześlij Sitemap

1. W Bing Webmaster Tools → **Sitemaps**
2. Kliknij **Submit Sitemap**
3. URL: `https://okazjeplus.pl/sitemap.xml`

### Dlaczego Bing?

- **~5-10% ruchu** w Polsce pochodzi z Bing/DuckDuckGo
- Bing powertuje też Yahoo, DuckDuckGo, Ecosia
- Łatwiejsza indeksacja niż Google (szybsze rezultaty)
- Często wyższe pozycje dla nowych stron

### Co monitorować w Bing?

1. **Reports & Data** → Search Performance
   - Impressions, clicks, CTR
   - Top queries
   - Top pages

2. **Crawl Information**
   - Crawl stats
   - Crawl errors
   - Blocked URLs

3. **SEO Reports**
   - Keyword research
   - Competitive analysis

## 📊 Porównanie: Google vs Bing

| Cecha | Google Search Console | Bing Webmaster Tools |
|-------|----------------------|---------------------|
| Udział w Polsce | ~95% | ~5% |
| Szybkość indeksacji | Wolniejsza (dni-tygodnie) | Szybsza (godziny-dni) |
| Dane historyczne | 16 miesięcy | 6 miesięcy |
| API access | Tak (quota limits) | Tak (mniej limits) |
| Keyword suggestions | Ograniczone | Obfite |
| Difficulty | Wysoka konkurencja | Niższa konkurencja |

## 🎯 Strategia SEO

### Tydzień 1-2: Setup
- ✅ Weryfikacja w GSC i Bing
- ✅ Przesłanie sitemap
- ✅ Monitoring coverage errors

### Tydzień 3-4: Optymalizacja
- Analiza top queries
- Optymalizacja title tags dla low CTR pages
- Naprawa błędów crawlingu
- Request indexing dla top pages

### Miesiąc 2-3: Content
- Tworzenie contentu pod top queries
- Internal linking optimization
- Schema markup expansion (FAQ, HowTo)

### Miesiąc 4+: Growth
- Link building
- Content refresh (aktualizacja starych postów)
- Semantic keyword expansion
- International expansion (EN, DE)

## 🚨 Częste problemy

### GSC: "URL is not on Google"
**Przyczyny**:
- Strona jest nowa (poczekaj 1-2 tygodnie)
- robots.txt blokuje crawlera
- noindex tag w meta

**Rozwiązanie**:
1. Sprawdź robots.txt: `https://okazjeplus.pl/robots.txt`
2. Sprawdź w DevTools: czy jest `<meta name="robots" content="noindex">`
3. Request indexing w GSC

### Bing: "Sitemap not processed"
**Przyczyny**:
- Błędy w XML
- Timeout przy fetchowaniu
- Zbyt duży sitemap (>50MB lub >50k URLs)

**Rozwiązanie**:
1. Zwaliduj XML: https://validator.w3.org
2. Sprawdź czy sitemap odpowiada (curl test)
3. Podziel na mniejsze sitemaps jeśli >2000 URLs

### Niski CTR (<1%)
**Przyczyny**:
- Tytuły nie są atrakcyjne
- Meta descriptions są generic
- Konkurencja ma lepsze snippety

**Rozwiązanie**:
1. Dodaj liczby do tytułów ("Top 10...", "2025...")
2. Dodaj emotional words ("Niesamowite", "Ekskluzywne")
3. Użyj power words ("Najlepsze", "Sprawdzone", "Darmowa dostawa")

## 📈 KPIs do śledzenia

| Metryka | Baseline | Target (3 mies) | Target (6 mies) |
|---------|----------|-----------------|-----------------|
| Impressions | 0 | 100k/mies | 500k/mies |
| Clicks | 0 | 3k/mies | 20k/mies |
| Average CTR | - | 3% | 5% |
| Average Position | - | <30 | <15 |
| Indexed Pages | 0 | 1500 | 2000 |
| Core Web Vitals | - | 80% good | 95% good |

## 🔗 Przydatne linki

- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
- [Google Search Central](https://developers.google.com/search)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmasters-guidelines-30fba23a)
- [Schema.org Documentation](https://schema.org)
- [Open Graph Protocol](https://ogp.me)

## 💡 Pro Tips

1. **Submit URL when you publish**: Nie czekaj na crawler - submit ręcznie
2. **Monitor competitors**: Sprawdź co robią topowi gracze (pepper.pl, okazje.info)
3. **Seasonal keywords**: Przygotuj content pod Black Friday, Święta z wyprzedzeniem
4. **Long-tail keywords**: Łatwiej rankowaćna "najlepsze okazje na słuchawki bluetooth" niż "okazje"
5. **User intent**: Optymalizuj pod intent (informational vs transactional)

---

**Następne kroki po setup**: Zobacz [GTM_SETUP_GUIDE.md](./GTM_SETUP_GUIDE.md) dla analytics.
