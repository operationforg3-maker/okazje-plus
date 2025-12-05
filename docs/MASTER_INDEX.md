# 📚 Okazje Plus — MASTER INDEX & Documentation Guide

> Centralny hub dokumentacji projektu. Uaktualniono: **5 grudnia 2025**

## 📊 Status Projektu

| Element | Status | Dokumentacja |
|---------|--------|--------------|
| **Produkcja** | ✅ Live | [DEPLOY_STATUS.md](./DEPLOY_STATUS.md) |
| **Backend** | ✅ 93% API używane | [FRONTEND_BACKEND_AUDIT.md](./FRONTEND_BACKEND_AUDIT.md) |
| **Frontend** | ✅ 100% bez mockupów | [FRONTEND_BACKEND_AUDIT.md](./FRONTEND_BACKEND_AUDIT.md) |
| **AI/Genkit** | ✅ Działające | [M3_COMPLETION_SUMMARY.md](./M3_COMPLETION_SUMMARY.md) |
| **Import System** | ⚠️ Wymaga napraw | [CRITICAL_ISSUES_2025-12-04.md](./CRITICAL_ISSUES_2025-12-04.md) |
| **Mobile Ready** | 🚧 W przygotowaniu | Ten dokument |

---

## 🗂️ Struktura Dokumentacji

### 📌 GŁÓWNE DOKUMENTY (Start tutaj)

| Dokument | Opis | Ostatnia aktualizacja |
|----------|------|----------------------|
| [blueprint.md](./blueprint.md) | Główny blueprint projektu - architektura, tech stack, konwencje | Aktualny |
| [DEPLOY_STATUS.md](./DEPLOY_STATUS.md) | Status produkcyjny, działające funkcje, URL-e | 14.11.2025 |
| [FRONTEND_BACKEND_AUDIT.md](./FRONTEND_BACKEND_AUDIT.md) | Audyt integracji - co działa, co ma mockupy | 14.11.2025 |
| [CRITICAL_ISSUES_2025-12-04.md](./CRITICAL_ISSUES_2025-12-04.md) | **KRYTYCZNE BUGI** do naprawy przed importem | 04.12.2025 |

---

## 🏗️ ARCHITEKTURA

### Core Architecture
| Dokument | Opis | Status |
|----------|------|--------|
| [arch/](./arch/) | Folder z diagramami architektonicznymi | ✅ Aktualny |
| [PERFORMANCE_SECURITY_AUDIT.md](./PERFORMANCE_SECURITY_AUDIT.md) | Audyt wydajności i bezpieczeństwa | ✅ Aktualny |
| [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) | Podsumowanie optymalizacji (N+1, cache) | ✅ Aktualny |
| [CACHE_INTEGRATION_GUIDE.md](./CACHE_INTEGRATION_GUIDE.md) | Przewodnik cache i unieważniania | ✅ Aktualny |

### Database & Types
- **SSOT Types**: `src/lib/types.ts` (2000+ linii - wszystkie interfejsy)
- **Data Layer**: `src/lib/data.ts` (centralizacja Firestore)
- **Indexes**: `firestore.indexes.json`
- **Rules**: `firestore.rules`

---

## 📈 MILESTONE DOKUMENTY

### ✅ Ukończone Milestones

| Milestone | Opis | Dokumentacja |
|-----------|------|--------------|
| **M1** | AliExpress Integration | [M1_COMPLETION_SUMMARY.md](./M1_COMPLETION_SUMMARY.md) |
| **M2** | OAuth, Deduplication, Moderation | [M2_COMPLETION_SUMMARY.md](./M2_COMPLETION_SUMMARY.md) |
| **M3** | Price Monitoring, Gamification, Personalization | [M3_COMPLETION_SUMMARY.md](./M3_COMPLETION_SUMMARY.md), [M3_QUICK_START.md](./M3_QUICK_START.md) |
| **M4** | Multi-language, Smart Pricing, Redesign | [MILESTONE_4_README.md](./MILESTONE_4_README.md), [M4_MIGRATION_GUIDE.md](./M4_MIGRATION_GUIDE.md), [M4_UI_REDESIGN.md](./M4_UI_REDESIGN.md) |
| **M5** | Notifications, Price Alerts, Comments v2 | [M5_COMPLETION_SUMMARY.md](./M5_COMPLETION_SUMMARY.md) |

### 🚧 W trakcie / Planowane

| Funkcja | Status | Dokumentacja |
|---------|--------|--------------|
| Import Pipeline v2 | 🔴 5 krytycznych bugów | [CRITICAL_ISSUES_2025-12-04.md](./CRITICAL_ISSUES_2025-12-04.md) |
| AI Translation | ⚠️ Dictionary-only | [IMPORT_SYSTEM_AUDIT_2025-12-04.md](./IMPORT_SYSTEM_AUDIT_2025-12-04.md) |
| Mobile App | 📋 Planowane | [Ten dokument](#mobile-readiness) |

---

## 🛠️ PRZEWODNIKI

### Admin Panel
| Dokument | Opis |
|----------|------|
| [PANEL_ADMINA_QUICKSTART.md](./PANEL_ADMINA_QUICKSTART.md) | Szybki start panelu admina |
| [PANEL_ADMINA_STRUKTURA.md](./PANEL_ADMINA_STRUKTURA.md) | Struktura i nawigacja |
| [PRZEWODNIK_ADMINA.md](./PRZEWODNIK_ADMINA.md) | Pełny przewodnik dla adminów |
| [ADMIN_PANEL_COMPLETE.md](./ADMIN_PANEL_COMPLETE.md) | Kompletna dokumentacja panelu |
| [admin-panel-audit.md](./admin-panel-audit.md) | Audyt funkcji panelu admin |

### Import & Integracje
| Dokument | Opis |
|----------|------|
| [aliexpress-import-specification.md](./aliexpress-import-specification.md) | Specyfikacja importu AliExpress |
| [SMART_IMPORT_GUIDE.md](./SMART_IMPORT_GUIDE.md) | Przewodnik Smart Import |
| [SMART_IMPORT_INTEGRATION_COMPLETE.md](./SMART_IMPORT_INTEGRATION_COMPLETE.md) | Podsumowanie integracji |
| [M4_SMART_IMPORTING.md](./M4_SMART_IMPORTING.md) | M4 Smart Import features |
| [BATCH_IMPORT_SYSTEM.md](./BATCH_IMPORT_SYSTEM.md) | System batch import |
| [deals-import-system.md](./deals-import-system.md) | System importu okazji |
| [ALLEGRO_API_SETUP.md](./ALLEGRO_API_SETUP.md) | Setup Allegro API |

### AI & Flows
| Dokument | Opis |
|----------|------|
| [KROK_3_DEAL_ENRICHER.md](./KROK_3_DEAL_ENRICHER.md) | AI Deal Enricher pipeline |
| [TASK_2_AI_AUTO_UZUPELNIACZ.md](./TASK_2_AI_AUTO_UZUPELNIACZ.md) | AI auto-uzupełniacz |
| [kategorie-automatyczne.md](./kategorie-automatyczne.md) | Automatyczne mapowanie kategorii |

### SEO & Indexing
| Dokument | Opis |
|----------|------|
| [TASK_1_GOOGLE_INDEXING_API.md](./TASK_1_GOOGLE_INDEXING_API.md) | Google Indexing API |
| [TASK_4_SEO_ZOMBIE_CLEANER.md](./TASK_4_SEO_ZOMBIE_CLEANER.md) | SEO Zombie Cleaner |
| [KROK_4_EXPIRED_DEALS_HANDLER.md](./KROK_4_EXPIRED_DEALS_HANDLER.md) | Handler wygasłych okazji |

### Internacjonalizacja (i18n)
| Dokument | Opis |
|----------|------|
| [i18n-content-translation.md](./i18n-content-translation.md) | Tłumaczenie contentu |
| [i18n-phase2-routing.md](./i18n-phase2-routing.md) | Routing dla i18n |
| [MULTILANG_TESTING_GUIDE.md](./MULTILANG_TESTING_GUIDE.md) | Testowanie wielojęzyczności |

---

## 🧪 TESTY & JAKOŚĆ

| Dokument | Opis |
|----------|------|
| [automated-tests.md](./automated-tests.md) | Strategia testów automatycznych |
| [functional-tests.md](./functional-tests.md) | Testy funkcjonalne |
| [tests-quickstart.md](./tests-quickstart.md) | Szybki start z testami |
| [manual-testing-checklist.md](./manual-testing-checklist.md) | Lista kontrolna testów manualnych |
| [test-report.md](./test-report.md) | Raport z testów |

---

## 🚀 DEPLOYMENT & PRODUKCJA

| Dokument | Opis |
|----------|------|
| [production-deployment.md](./production-deployment.md) | Szczegóły wdrożenia |
| [PRODUCTION_DEPLOYMENT_23-11-2025.md](./PRODUCTION_DEPLOYMENT_23-11-2025.md) | Deploy 23.11.2025 |
| [DEPLOYMENT_GUIDE_ALL_5_TASKS.md](./DEPLOYMENT_GUIDE_ALL_5_TASKS.md) | Przewodnik 5 zadań deployu |
| [PRODUCTION_READY.md](./PRODUCTION_READY.md) | Checklist produkcyjny |
| [LAUNCH_PREPARATION.md](./LAUNCH_PREPARATION.md) | Przygotowanie do launchu |
| [LAUNCH_READINESS_COMPLETION_SUMMARY.md](./LAUNCH_READINESS_COMPLETION_SUMMARY.md) | Podsumowanie gotowości |

---

## 📊 AUDYTY & RAPORTY

| Dokument | Data | Status |
|----------|------|--------|
| [AUDIT_REPORT_2025-11-23.md](./AUDIT_REPORT_2025-11-23.md) | 23.11.2025 | ⚠️ Częściowo naprawione |
| [ICON_AUDIT_2025.md](./ICON_AUDIT_2025.md) | 2025 | ✅ Aktualny |
| [IMPORT_SYSTEM_AUDIT_2025-12-04.md](./IMPORT_SYSTEM_AUDIT_2025-12-04.md) | 04.12.2025 | 🔴 Wymaga działania |
| [CRITICAL_ISSUES_2025-12-04.md](./CRITICAL_ISSUES_2025-12-04.md) | 04.12.2025 | 🔴 KRYTYCZNE |

---

## 👤 UŻYTKOWNICY

| Dokument | Opis |
|----------|------|
| [PRZEWODNIK_UZYTKOWNIKA.md](./PRZEWODNIK_UZYTKOWNIKA.md) | Przewodnik dla użytkowników |
| [USER_ENGAGEMENT_FEATURES.md](./USER_ENGAGEMENT_FEATURES.md) | Funkcje zaangażowania |
| [premium-features.md](./premium-features.md) | Funkcje premium |
| [beta-invitations-system.md](./beta-invitations-system.md) | System zaproszeń beta |

---

## 🔄 UPDATES (Chronologiczne)

Folder: `docs/updates/`

| Data | Dokument | Opis |
|------|----------|------|
| 2025-01-10 | [2025-01-10-icon-responsiveness-audit.md](./updates/2025-01-10-icon-responsiveness-audit.md) | Audyt responsywności ikon |
| 2025-11-10 | [2025-11-10-comments-and-pagination.md](./updates/2025-11-10-comments-and-pagination.md) | Komentarze i paginacja |
| 2025-11-16 | [2025-11-16-rating-sources-and-gallery.md](./updates/2025-11-16-rating-sources-and-gallery.md) | Źródła ocen i galeria |
| 2025-11-17 | [2025-11-17-admin-panel-refactor.md](./updates/2025-11-17-admin-panel-refactor.md) | Refactor panelu admin |

---

## 📱 MOBILE READINESS {#mobile-readiness}

### Aktualny Stan PWA

| Element | Status | Uwagi |
|---------|--------|-------|
| **Responsive Design** | ✅ | Mobile-first Tailwind CSS |
| **Service Worker** | ❌ | Nie zaimplementowany |
| **Web App Manifest** | ❌ | Brak `manifest.json` |
| **Offline Support** | ❌ | Brak |
| **Push Notifications** | 🚧 | SendGrid email, brak Web Push |

### Gotowość do Native Apps

| Element | Status | Uwagi |
|---------|--------|-------|
| **API REST** | ✅ | 27 endpoints gotowych |
| **Firebase Auth** | ✅ | Kompatybilne z native SDK |
| **Firestore** | ✅ | Kompatybilne z native SDK |
| **TypeScript Types** | ✅ | Można wygenerować natywne modele |
| **Image Optimization** | ✅ | next/image, można dostosować |

### Rekomendowane ścieżki Mobile

1. **PWA (najszybsze)** - dodać Service Worker + Manifest
2. **React Native + Expo** - reużycie logiki biznesowej
3. **Capacitor** - wrap Next.js jako native app

---

## 🔴 KRYTYCZNE DO NAPRAWY

### Import System (CRITICAL_ISSUES_2025-12-04.md)

| Bug # | Opis | Priorytet |
|-------|------|-----------|
| #1 | Brak funkcji `aiNormalizeTitlePL` | 🔴 CRITICAL |
| #2 | Brak pakietu `@genkit-ai/openai` | 🔴 CRITICAL |
| #3 | Polskie keywordy do AliExpress API | 🔴 CRITICAL |
| #4 | Hardcoded localhost:9002 | 🔴 CRITICAL |
| #5 | FieldValue.arrayUnion() błędne użycie | 🔴 CRITICAL |

### Pozostałe Issues

| Issue | Źródło | Status |
|-------|--------|--------|
| TypeScript test errors | tsconfig exclude | ⚠️ Do naprawy |
| Voting API auth | AUDIT_REPORT | 🔴 Nie naprawione |
| Rate limiting | AUDIT_REPORT | ⚠️ Brak |

---

## 📂 DOKUMENTY INNE / ARCHIWALNE

| Dokument | Status | Uwagi |
|----------|--------|-------|
| [test.md](./test.md) | 📦 Sandbox | Przykłady/testy |
| [portal-pracownicy-spec.md](./portal-pracownicy-spec.md) | 📋 Specyfikacja | Portal pracowniczy |
| [google-analytics.md](./google-analytics.md) | ✅ Aktualny | GA4 integracja |
| [TASK_3_TELEGRAM_BROADCASTER.md](./TASK_3_TELEGRAM_BROADCASTER.md) | 📋 Planowane | Telegram broadcaster |
| [TASK_5_SMART_IMAGE_OPTIMIZER.md](./TASK_5_SMART_IMAGE_OPTIMIZER.md) | 📋 Planowane | Image optimizer |

---

## 🔗 Quick Links

### Kody źródłowe
- **Types**: `src/lib/types.ts`
- **Data Layer**: `src/lib/data.ts`
- **Firebase Config**: `src/lib/firebase.ts`
- **Auth**: `src/lib/auth.tsx`
- **AI Flows**: `src/ai/flows/`
- **Cloud Functions**: `okazje-plus/src/index.ts`

### Konfiguracja
- **Next.js**: `next.config.ts`
- **TypeScript**: `tsconfig.json`
- **Firebase**: `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- **App Hosting**: `apphosting.yaml`

### Testy
- **Unit Tests**: `npm run test` (Jest)
- **E2E Tests**: `npm run test:e2e` (Playwright)
- **Type Check**: `npm run typecheck`
- **Lint**: `npm run lint`

---

## 📝 Konwencje Dokumentacji

1. **Nazewnictwo plików**: SCREAMING_SNAKE_CASE dla głównych docs, kebab-case dla innych
2. **Daty w nazwach**: YYYY-MM-DD dla audytów i updates
3. **Język**: Polski dla UI/user-facing, angielski dozwolony w technical docs
4. **Updates**: Dodawać do `docs/updates/` z datą w nazwie
5. **Nie modyfikować**: Starych audytów - tworzyć nowe zamiast edycji

---

## 🔄 Utrzymanie tego dokumentu

Aktualizuj ten indeks przy:
- Dodaniu nowego dokumentu
- Zmianie statusu milestone'a
- Naprawieniu krytycznych bugów
- Istotnych zmianach architektury

---

**Ostatnia aktualizacja**: 5 grudnia 2025  
**Wersja dokumentacji**: 2.0  
**Liczba dokumentów**: 76 plików (~24,000 linii)
