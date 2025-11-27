# 🚀 Launch Preparation Guide

## Przygotowanie serwisu do startu

Ten przewodnik opisuje proces przygotowania pełnej struktury kategorii i wypełnienia produktami przed uruchomieniem serwisu.

---

## 📋 Krok 1: Stworzenie struktury kategorii (3 poziomy)

### Automatyczne seedowanie

```bash
npm run seed:categories
```

To stworzy pełną strukturę kategorii:
- **8 głównych kategorii**: Elektronika, Dom i ogród, Moda, Sport, Dziecko, Zdrowie, Motoryzacja, Książki
- **~40 podkategorii** (poziom 2)
- **~150 pod-podkategorii** (poziom 3)

### Struktura danych

```
categories/
  elektronika/
    - name: "Elektronika"
    - icon: "💻"
    - sortOrder: 10
    
    subcategories/
      smartfony-telefony/
        - name: "Smartfony i telefony"
        
        subcategories/
          smartfony/
            - name: "Smartfony"
            - aliexpressKeywords: ["smartphone", "mobile phone"]
          
          akcesoria-gsm/
            - name: "Akcesoria GSM"
            - aliexpressKeywords: ["phone accessories", "phone case"]
```

### Weryfikacja

Sprawdź w Firestore Console:
1. Kolekcja `categories` → powinno być 8 dokumentów
2. Każda kategoria → `subcategories` subkolekcja
3. Każda podkategoria → `subcategories` subkolekcja z `aliexpressKeywords`

---

## 📦 Krok 2: Automatyczny import produktów

### 2.1 Podgląd (dry-run)

Najpierw sprawdź co zostanie zaimportowane:

```bash
npm run auto-import -- --dry-run
```

Wyświetli listę wszystkich kategorii i keyword'ów bez tworzenia profili.

### 2.2 Test na małej próbce

Zacznij od 10 kategorii z 10 produktami każda:

```bash
npm run auto-import -- --limit 10 --max-items 10
```

To stworzy 10 profili importu i wygeneruje komendy API do uruchomienia.

### 2.3 Pełny import (UWAGA: to może zająć czas!)

Gdy test przebiegnie pomyślnie:

```bash
npm run auto-import -- --max-items 30
```

Parametry:
- `--max-items NUM` - liczba produktów na kategorię (domyślnie: 20)
- `--limit NUM` - ogranicz do N pierwszych kategorii
- `--dry-run` - tylko podgląd, bez tworzenia profili

---

## 🎯 Krok 3: Uruchomienie importów

Po utworzeniu profili masz 2 opcje:

### Opcja A: Admin Panel (zalecane dla małych wolumenów)

1. Otwórz `/admin/aliexpress-import`
2. Zobaczysz listę auto-wygenerowanych profili
3. Kliknij "Run Import" dla każdego profilu
4. Monitoruj postęp w Import Runs

### Opcja B: API Batch (zalecane dla dużych wolumenów)

Skrypt generuje komendy curl. Skopiuj i uruchom:

```bash
# Przykładowe komendy wygenerowane przez skrypt
curl -X POST http://localhost:9002/api/admin/products/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profileId":"abc123"}'
```

**Pro tip**: Użyj narzędzia typu GNU Parallel do równoległego importu:

```bash
# Utwórz plik profile-ids.txt z ID profili (jeden na linię)
cat profile-ids.txt | parallel -j 3 \
  "curl -X POST http://localhost:9002/api/admin/products/ingest \
   -H 'Authorization: Bearer YOUR_TOKEN' \
   -H 'Content-Type: application/json' \
   -d '{\"profileId\":\"{}\"}'"
```

---

## 📊 Krok 4: Monitorowanie

### W czasie importu

1. Sprawdź logi w terminalu gdzie uruchomiłeś API
2. Admin Panel → Import Runs - zobacz statystyki
3. Firestore Console → `products` collection - liczba dokumentów rośnie

### Typowe statystyki

Dla każdej kategorii (~20 produktów):
- **Czas importu**: 30-60 sekund
- **AI processing**: ~2-3 sekundy na produkt
- **Accepted**: ~70-80% (score ≥50)
- **Rejected**: ~20-30% (niska jakość)

### Troubleshooting

**Problem**: Import zaczyna się, ale produkty nie pojawiają się

**Rozwiązanie**:
1. Sprawdź logi - szukaj błędów API/AI
2. Upewnij się, że Vertex AI jest skonfigurowane (ADC)
3. Sprawdź rate limiting AliExpress API

**Problem**: Za dużo odrzuconych produktów

**Rozwiązanie**:
1. Obniż `minRating` w profilu (z 4.0 do 3.5)
2. Zwiększ `maxPrice` jeśli kategoria premium
3. Usuń `minDiscount` dla kategorii non-sale

---

## ✅ Krok 5: Weryfikacja

Po zakończeniu importów sprawdź:

### 1. Liczba produktów w bazie

```bash
# W Firestore Console
products: filter by status = "approved"
# Powinno być ~150 kategorii × 20 produktów = ~3000 produktów
```

### 2. Mega Menu

Otwórz stronę główną i sprawdź mega menu:
- ✅ Wszystkie 8 głównych kategorii widoczne
- ✅ Podkategorie rozwijają się
- ✅ Pod-podkategorie w gridzie

### 3. Strony kategorii

Testuj linki z mega menu:
- `/products?mainCategory=elektronika&subCategory=smartfony-telefony`
- Powinny wyświetlać produkty z AI-przetłumaczonymi nazwami po polsku

### 4. Jakość treści

Losowo wybierz 10 produktów i sprawdź:
- ✅ Nazwa po polsku (bez spam, emoji, CAPS)
- ✅ Opis naturalny (2-3 zdania)
- ✅ Słowa kluczowe SEO (5-10 fraz)
- ✅ Kategoria poprawnie przypisana

---

## 🔧 Opcje zaawansowane

### Ponowny import dla konkretnej kategorii

```bash
# Znajdź profileId w Firestore lub Admin Panel
curl -X POST /api/admin/products/ingest \
  -d '{"profileId":"PROFILE_ID", "maxItems": 50}'
```

### Czyszczenie przed ponownym importem

```bash
# UWAGA: To usunie WSZYSTKIE produkty!
# Użyj Firestore Console: products → Delete collection
```

### Import tylko dla wybranych głównych kategorii

```typescript
// Edytuj src/scripts/auto-import-products.ts
// Dodaj filter przed getAllSubSubCategories():
const jobs = await getAllSubSubCategories();
const filtered = jobs.filter(j => 
  j.mainCategorySlug === 'elektronika' || 
  j.mainCategorySlug === 'moda'
);
```

---

## 📈 Metryki sukcesu

Gotowy serwis powinien mieć:

- ✅ **~3000-5000 produktów** z AI-przetworzoną treścią
- ✅ **8 głównych kategorii** w pełni wypełnionych
- ✅ **Średnio 20-30 produktów** na pod-podkategorię
- ✅ **70%+ produktów z score ≥50**
- ✅ **Wszystkie nazwy przetłumaczone na polski**
- ✅ **SEO keywords dla każdego produktu**

---

## 🚨 Ważne uwagi

1. **Rate limiting**: AliExpress API ma limity. Nie importuj wszystkiego naraz.
2. **Koszty AI**: Vertex AI ma koszty za tokeny. Monitoruj usage w GCP Console.
3. **Firestore quota**: Free tier ma 20K writes/day. Płatny plan zalecany dla produkcji.
4. **Czas trwania**: Pełny import ~150 kategorii × 20 produktów = 2-3 godziny.

---

## 📞 Pomoc

Problem? Sprawdź:
1. Logi w terminalu (`npm run dev`)
2. Firestore Console → Import Runs
3. Admin Panel → AI Tools → Command History
4. GCP Console → Vertex AI → Logs

---

**Gotowe!** Twój serwis jest przygotowany do startu z pełną strukturą kategorii i produktami! 🎉
