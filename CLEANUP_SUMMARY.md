# Podsumowanie Czyszczenia Projektu

## Status: ✅ Zakończone

Data: 21 stycznia 2026

## Cel
Usunięcie zbędnych plików debugowych, testowych i dokumentacji z głównego katalogu projektu, aby zwiększyć czytelność struktury i skupić się na plikach istotnych dla aplikacji.

## Wykonane Zmiany

### 📊 Statystyki
- **Usuniętych plików z głównego katalogu**: 97
- **Pliki przeniesione do `/legacy/`**: 97
- **Główny katalog przed**: 37 plików + 15 katalogów
- **Główny katalog po**: 22 pliki + 15 katalogów

### 🗂️ Struktura Legacy
```
legacy/
├── README.md                          # Dokumentacja struktury legacy
├── debug-scripts/                     # 53 pliki
│   ├── check-*.js, check-*.mjs       # Skrypty sprawdzające bazę danych
│   ├── debug-*.js                    # Narzędzia debugowania
│   ├── migrate-*.mjs                 # Jednorazowe migracje danych
│   └── quick-*.js                    # Szybkie narzędzia diagnostyczne
├── test-scripts/                      # 17 plików
│   ├── test-*.js, test-*.mjs         # Manualne testy
│   └── test-*.sh                     # Skrypty testowe shell
├── docs/                              # 24 pliki
│   ├── M6_*.md                       # Dokumentacja M6
│   ├── PHASE*.md                     # Podsumowania faz
│   └── *_README.md                   # Stare dokumenty readme
└── Pliki backupowe
    ├── firestore.indexes.backup.json
    └── playwright-home.png
```

### ✅ Zachowane w Głównym Katalogu

#### Pliki Konfiguracyjne
- `package.json`, `package-lock.json` - Zarządzanie zależnościami
- `tsconfig.json` - Konfiguracja TypeScript
- `next.config.ts` - Konfiguracja Next.js
- `tailwind.config.ts` - Konfiguracja Tailwind CSS
- `jest.config.js`, `jest.setup.ts` - Testy jednostkowe
- `playwright.config.ts` - Testy E2E
- `eslint.config.cjs`, `.eslintrc.cjs` - Linting
- `postcss.config.mjs` - PostCSS
- `components.json` - Shadcn/ui

#### Firebase i Deployment
- `firebase.json` - Konfiguracja Firebase
- `firestore.rules` - Reguły bezpieczeństwa Firestore
- `firestore.indexes.json` - Indeksy Firestore (aktywne)
- `apphosting.yaml` - Firebase App Hosting
- `.firebaserc` - Projekt Firebase

#### Dokumentacja i Organizacja
- `README.md` - Główna dokumentacja
- `docs/` - Oficjalna dokumentacja projektu
- `.github/` - GitHub workflows i konfiguracja

#### Kod Źródłowy
- `src/` - Kod aplikacji Next.js
- `okazje-plus/` - Cloud Functions
- `scripts/` - Skrypty buildowe (używane przez package.json)
- `public/` - Zasoby statyczne
- `messages/` - Tłumaczenia i18n
- `tests/` - Automatyczne testy

## 🔧 Skrypty w package.json (Niezmienione)

Wszystkie skrypty w `package.json` nadal działają:
- ✅ `npm run dev` - Uruchomienie serwera deweloperskiego
- ✅ `npm run build` - Build produkcyjny
- ✅ `npm run lint` - Linting
- ✅ `npm run test` - Testy jednostkowe
- ✅ `npm run test:e2e` - Testy E2E
- ✅ `npm run seed:categories` - Seed kategorii
- ✅ Wszystkie pozostałe skrypty

## 🚫 .gitignore

Dodano do `.gitignore`:
```
# Legacy files - debug scripts, old docs, test utilities
/legacy/
```

Folder `legacy/` jest ignorowany przez git, więc nie będzie wersjonowany.

## 📝 Jak Używać Plików Legacy

Jeśli potrzebujesz skryptu debugowego:
```bash
# Przykład: Sprawdzenie kolekcji w bazie danych
node legacy/debug-scripts/check-db-collections.mjs

# Przykład: Lista użytkowników
node legacy/debug-scripts/list-users.mjs

# Przykład: Sprawdzenie kategorii
node legacy/debug-scripts/check-categories-m6.mjs
```

## 🎯 Korzyści

### Przed
```
/
├── 72 skrypty (.js, .mjs, .sh)
├── 25 dokumentów markdown
├── Pliki konfiguracyjne
└── Katalogi (src, docs, etc.)
```
**Problem**: Trudno znaleźć istotne pliki, chaos w strukturze

### Po
```
/
├── 22 istotne pliki konfiguracyjne
├── README.md
├── Katalogi aplikacji (src, docs, etc.)
└── legacy/ (ignorowane przez git)
```
**Rezultat**: Czytelna struktura, łatwe zarządzanie projektem

## ✨ Następne Kroki

- [ ] Testowanie workflow deweloperskiego
- [ ] Weryfikacja buildów
- [ ] Sprawdzenie, czy nic nie zostało uszkodzone

## 🔍 W Razie Problemów

Jeśli coś nie działa:
1. Sprawdź, czy potrzebny skrypt nie jest w `legacy/`
2. Zobacz `legacy/README.md` dla dokumentacji
3. Skrypty w `scripts/` (używane przez package.json) NIE zostały przeniesione

## 📚 Dokumentacja

- Główna: `README.md`
- Oficjalna: `docs/`
- Historyczna: `legacy/docs/`
- Legacy tools: `legacy/README.md`
