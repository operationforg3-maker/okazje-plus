# 📚 Dokumentacja Okazje Plus — Indeks

Centralne miejsce dla wszystkich plików dokumentacji. Każdy plik został przeniesiony z katalogu głównego do `docs/`. Używaj wyszukiwarki w edytorze lub tej listy kategorii.

## Spis według kategorii

### 🏁 Start / Onboarding
- `QUICK_START.md` – skrócone wprowadzenie do optymalizacji wydajności
- `M3_QUICK_START.md` – szybki start dla modułów Milestone 3
- `MILESTONE_4_README.md` – opis integracji multi-marketplace (Milestone 4)

### 🧱 Architektura / Audyty
- `FRONTEND_BACKEND_AUDIT.md` – audyt integracji frontend ↔ backend
- `PERFORMANCE_SECURITY_AUDIT.md` – pełny audyt wydajności i bezpieczeństwa
- `OPTIMIZATION_SUMMARY.md` – podsumowanie wdrożonych optymalizacji
- `ADMIN_PANEL_COMPLETE.md` – kompletna struktura panelu administratora
- `production-deployment.md` – szczegóły wdrożenia produkcyjnego

### 🚀 Deploy / Status
- `DEPLOY_STATUS.md` – ostatni status wdrożenia (produkcyjny)
- `M1_COMPLETION_SUMMARY.md`, `M2_COMPLETION_SUMMARY.md`, `M3_COMPLETION_SUMMARY.md` – podsumowania kamieni milowych

### 🛠️ Integracje / Marketplace / Import
- `aliexpress-import-specification.md` – specyfikacja importu z AliExpress
- `portal-pracownicy-spec.md` – specyfikacja portalu pracowniczego
- `integration/aliexpress.md` – szczegóły integracji AliExpress
- `kategorie-automatyczne.md` – automatyka kategorii

### ⚙️ Wydajność / Cache
- `CACHE_INTEGRATION_GUIDE.md` – przewodnik integracji unieważniania cache
- `PERFORMANCE_SECURITY_AUDIT.md` – audyt bezpieczeństwa (sekcja cache)
- `OPTIMIZATION_SUMMARY.md` – co zostało zoptymalizowane

### 🔍 Testy / Jakość
- `automated-tests.md` – strategia testów automatycznych
- `functional-tests.md` – testy funkcjonalne
- `manual-testing-checklist.md` – lista kontrolna testów manualnych
- `tests-quickstart.md` – szybki start z testami
- `test-report.md` – raport z testów
- `test.md` – sandbox / przykłady

### 📊 Analityka / Monitoring
- `google-analytics.md` – integracja GA4

### 🧪 Aktualizacje / Zmiany inkrementalne
- `updates/2025-11-10-comments-and-pagination.md` – zmiany w komentarzach i paginacji

### 🤖 AI / Flows
- (Flow’y w kodzie: `src/ai/flows/`; dokumentacja w README + plikach milestone)

## Konwencje
1. Pliki w `docs/updates/` — datowane kroniki zmian (YYYY-MM-DD-nazwa-zmiany.md)
2. Pliki audytowe nie są modyfikowane retroaktywnie — dodaj nowy audyt zamiast edycji starego.
3. README w głównym katalogu pozostaje ultra‑lekki i kieruje tutaj.

## Dodawanie nowego dokumentu
1. Utwórz plik w odpowiedniej kategorii (lub dodaj nową sekcję w tym indeksie).
2. Nazwy po polsku; wyjątki: nazwy technologii / API.
3. Jeśli dokument opisuje zmianę → użyj folderu `updates/`.

## Szybkie skróty
- Architektura główna: `FRONTEND_BACKEND_AUDIT.md`
- Ostatni deploy: `DEPLOY_STATUS.md`
- Optymalizacje: `OPTIMIZATION_SUMMARY.md`
- Cache: `CACHE_INTEGRATION_GUIDE.md`
- Multi-marketplace: `MILESTONE_4_README.md`

## Status Migracji
Migracja ukończona: wszystkie root-level pliki `.md` (poza `README.md`) zostały przeniesione do `docs/`.

---
Aktualizuj ten indeks przy każdym dodaniu większego dokumentu. Jeśli sekcja zaczyna być przeładowana — rozważ podfolder.
