# 🧪 Quick Start: System Testów

## Jak uruchomić testy?

### Metoda 1: Panel Admina (Najłatwiejsza)

1. Uruchom dev server:
   ```bash
   npm run dev
   ```

2. Otwórz http://localhost:9002/admin

3. Kliknij zakładkę **"Testy"** (piąta zakładka)

4. Kliknij przycisk **"Uruchom Testy"**

5. Poczekaj ~3-5 sekund na wyniki

6. Przejrzyj wyniki:
   - 🟢 Zielone = Pass (wszystko OK)
   - 🔴 Czerwone = Fail (problem do naprawy)
   - 🟡 Żółte = Warning (sprawdź, ale nie krytyczne)
   - ⚪ Szare = Skip (brak danych do testu)

7. Kliknij na kartę testu aby zobaczyć szczegóły JSON

### Metoda 2: API Endpoint

```bash
curl -X POST http://localhost:9002/api/admin/tests/run \
  -H "Authorization: Bearer admin" \
  -H "Content-Type: application/json"
```

### Metoda 3: Programowo

```typescript
import { runAllTests } from '@/lib/test-service';

const results = await runAllTests();
console.log(results);
```

## Co jest testowane?

### 🔧 Testy Techniczne (3)
- Połączenie z Firestore
- Istnienie kolekcji (deals, products, users, categories, notifications)
- Indeksy Firestore

### ⚙️ Testy Funkcjonalne (5)
- CRUD operations dla deals i products
- Dokładność licznika komentarzy
- Logika systemu głosowania
- Struktura kategorii

### 💼 Testy Biznesowe (6)
- Dostępność zatwierdzonej treści
- Status kolejki moderacji
- Metryki aktywności użytkowników
- Obecność gorących deals
- Jakość danych (obrazki, opisy)

**Razem: 14 testów**

## Interpretacja wyników

### Scenariusz 1: Wszystko działa ✅
```
Total: 14 | Passed: 14 | Failed: 0 | Warnings: 0
```
**Znaczenie**: Aplikacja w pełni sprawna, można deployować.

### Scenariusz 2: Brak danych testowych ⚠️
```
Total: 14 | Passed: 8 | Failed: 0 | Warnings: 4 | Skipped: 2
```
**Znaczenie**: Kod działa, ale brak deals/products. Normalne w dev.

### Scenariusz 3: Problemy techniczne ❌
```
Total: 14 | Passed: 10 | Failed: 3 | Warnings: 1
```
**Znaczenie**: Sprawdź failed tests - mogą być problemy z:
- Indeksami Firestore
- Połączeniem
- Logiką biznesową

### Scenariusz 4: Problemy jakościowe ⚠️
```
Total: 14 | Passed: 12 | Failed: 0 | Warnings: 2
```
**Znaczenie**: Kod działa, ale content quality issues:
- Deals bez obrazków
- Duża kolejka moderacji
- Brak gorących okazji

## Kiedy uruchamiać testy?

- ✅ Przed każdym `git push`
- ✅ Po dodaniu nowych features
- ✅ Przed deploymentem do produkcji
- ✅ Po zmianie struktury danych
- ✅ Gdy coś "nie działa" (debugging)

## Troubleshooting

### Testy się nie uruchamiają
1. Sprawdź czy dev server działa (`npm run dev`)
2. Sprawdź console w przeglądarce (F12)
3. Sprawdź terminal - czy są błędy?

### Wszystkie testy failują
1. Sprawdź połączenie z Firebase
2. Sprawdź czy `.env.local` jest poprawnie skonfigurowany
3. Sprawdź Firestore rules

### Test trwa zbyt długo (> 30s)
1. Sprawdź network (może być slow connection)
2. Sprawdź czy Firestore emulator nie jest przeciążony
3. Zobacz terminal logs - może być deadlock

## Następne kroki

Zobacz pełną dokumentację: [`docs/automated-tests.md`](./automated-tests.md)

Tam znajdziesz:
- Architekturę systemu
- Szczegóły każdego testu
- Jak dodawać nowe testy
- Best practices
- Planowane rozszerzenia

---

**Pro tip**: Uruchom testy TERAZ! Zobaczysz aktualny stan swojej aplikacji w 5 sekund. 🚀
