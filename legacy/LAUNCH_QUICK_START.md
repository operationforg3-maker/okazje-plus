# 🚀 Quick Start Commands - Launch Day

## Szybkie komendy do przygotowania serwisu

### 1️⃣ Seedowanie kategorii (3 poziomy)
```bash
npm run seed:categories
```
✅ Tworzy: 8 głównych + ~40 pod + ~150 pod-pod kategorii

---

### 2️⃣ Podgląd importu (DRY RUN)
```bash
npm run auto-import -- --dry-run
```
📋 Pokazuje co zostanie zaimportowane bez tworzenia profili

---

### 3️⃣ Test na małej próbce (10 kategorii × 10 produktów)
```bash
npm run auto-import -- --limit 10 --max-items 10
```
🧪 Testuj na małej próbce przed pełnym importem

---

### 4️⃣ Pełny import (wszystkie kategorie × 30 produktów)
```bash
npm run auto-import -- --max-items 30
```
⚠️ To może zająć 2-3 godziny!

---

## 🎯 Parametry auto-import

| Parametr | Opis | Domyślna wartość |
|----------|------|------------------|
| `--dry-run` lub `-d` | Podgląd bez tworzenia profili | false |
| `--max-items NUM` lub `-m NUM` | Produkty na kategorię | 20 |
| `--limit NUM` lub `-l NUM` | Ogranicz liczbę kategorii | brak |

---

## 📊 Przykłady użycia

### Import tylko dla Elektroniki (pierwszych 5 podkategorii)
```bash
npm run auto-import -- --limit 5 --max-items 25
```

### Duży import dla wszystkich (50 produktów na kategorię)
```bash
npm run auto-import -- --max-items 50
```

### Ultra-szybki test (3 kategorie × 5 produktów)
```bash
npm run auto-import -- --limit 3 --max-items 5
```

---

## ✅ Weryfikacja po imporcie

### Sprawdź liczbę produktów
```bash
# W Firestore Console:
# products collection → filter by status="approved"
```

### Sprawdź mega menu
```bash
# Otwórz http://localhost:9002
# Kliknij w menu → powinna być pełna struktura
```

### Sprawdź konkretną kategorię
```bash
# http://localhost:9002/products?mainCategory=elektronika&subCategory=smartfony-telefony
```

---

## 🔧 Troubleshooting

### "Za dużo odrzuconych produktów"
Edytuj profil w Admin Panel:
- Zmniejsz `minRating` z 4.0 na 3.5
- Zwiększ `maxPrice` dla kategorii premium
- Usuń `minDiscount` dla kategorii bez wyprzedaży

### "Import zawiesza się"
- Sprawdź logi Vertex AI (GCP Console)
- Upewnij się że ADC jest skonfigurowane
- Sprawdź limity AliExpress API

### "Produkty bez tłumaczeń"
- Sprawdź logi AI w terminalu
- Upewnij się że Vertex AI location = europe-west1
- Sprawdź quota Vertex AI w GCP Console

---

## 📈 Oczekiwane rezultaty

Po pełnym imporcie (~150 kategorii × 20-30 produktów):

✅ **3000-4500 produktów** w bazie  
✅ **Wszystkie nazwy przetłumaczone** na polski  
✅ **70%+ produktów z AI score ≥50**  
✅ **SEO keywords** dla każdego produktu  
✅ **Pełna struktura kategorii** w mega menu  

---

## 🚨 WAŻNE przed startem

1. ✅ Upewnij się że Vertex AI jest włączone (GCP Console)
2. ✅ Service account ma uprawnienia Vertex AI User
3. ✅ Firestore jest w europe-west1
4. ✅ Masz wystarczający quota Vertex AI (sprawdź GCP)
5. ✅ Local development: `npm run dev` działa

---

## 📞 Dokumentacja

📖 Pełna instrukcja: `docs/LAUNCH_PREPARATION.md`

---

**Powodzenia! 🎉**
