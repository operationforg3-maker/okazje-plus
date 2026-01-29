# Forum Category Suggestions - Fix & Testing Guide

## Problem
`FirebaseError: Missing or insufficient permissions` gdy użytkownik próbował zaproponować kategorię.

## Przyczyna
Firestore rules nie zawierały definicji kolekcji `forum_category_suggestions`, więc dostęp był domyślnie zabroniony.

## Rozwiązanie
✅ Dodane reguły do `firestore.rules`:
- `forum_categories` - publiczny odczyt, admin edytuje
- `forum_threads` - publiczny odczyt, zalogowani tworzą/edytują
- `forum_category_suggestions` - zalogowani mogą zaproponować, admin zarządza

## Deployment
Commit: `f3586b4`
- W produkcji: Reguły są automatycznie wdrażane
- Na lokalnym Firebase Emulator: Uruchom `firebase emulators:start`

## Testing na Localu

### Opcja 1: Emulator (Rekomendowane)
```bash
# Terminal 1: Uruchom emulator (reguły będą załadowane z firestore.rules)
firebase emulators:start

# Terminal 2: Uruchom dev server
npm run dev
```

### Opcja 2: Production Firestore
```bash
# Po prostu uruchom dev server
npm run dev
# Reguły będą używane z production
```

## Test Workflow

1. **Zaloguj się jako zwykły użytkownik**
   - URL: http://localhost:9002/pl/forum/new
   - Kliknij "Zaproponuj kategorię"

2. **Uzupełnij dialog**
   - Nazwa: "Elektronika Smart Home"
   - Opis: "Urządzenia inteligentne do domu"
   - Kliknij "Wyślij propozycję"
   - ✅ Powinno się wyświetlić "Sukces - Twoja propozycja..."

3. **Zaloguj się jako admin**
   - URL: http://localhost:9002/admin/forum/categories
   - Powinna być widoczna propozycja

4. **Test zatwierdzenia propozycji**
   - Kliknij "Zatwierdź"
   - ✅ Kategoria powinna zostać stworzona
   - Nowa kategoria pojawia się w liscie: http://localhost:9002/pl/forum/new → Kategoria

5. **Test odrzucenia**
   - Utwórz drugą propozycję
   - Admin kliknie "Odrzuć"
   - Podaj powód np. "Zbyt ogólna kategoria"
   - ✅ Pojawia się w historii jako odrzucona

## Debugging

Jeśli nadal widać błąd permisji:

```bash
# 1. Sprawdź czy jesteś zalogowany
# Otwórz DevTools → Console → Wpisz:
firebase.auth().currentUser

# 2. Jeśli używasz emulatora, restart go:
ctrl+c  # Zabij emulator
firebase emulators:start --clear

# 3. Sprawdź czy reguły są załadowane:
# W DevTools -> Network -> zobacz czy Firestore zwraca 403
```

## Rules Reference

```
match /forum_category_suggestions/{suggestionId} {
  allow read: if isAdmin();                           // Tylko admin
  allow create: if isSignedIn() && 
    request.resource.data.suggestedByUid == request.auth.uid;  // Zalogowany user
  allow update: if isAdmin();                         // Admin zatwierdza/odrzuca
  allow delete: if isAdmin();                         // Admin usuwa
}
```

## Status
- ✅ Firestore rules dodane
- ✅ Commit f3586b4 pushed do main
- ✅ CategorySuggestionDialog component działa
- ✅ Admin panel do zarządzania propozycjami gotowy
- 🚀 Gotowe do testowania na production
