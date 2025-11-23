# System zaproszeń Beta - Dokumentacja

## Przegląd

System automatycznej wysyłki zaproszeń dla pre-zarejestrowanych użytkowników (pionierów i beta testerów).

## Komponenty

### 1. Cloud Functions (`okazje-plus/src/index.ts`)

#### `sendBetaInvitations`
- **Typ**: Callable Function (HTTPS)
- **Region**: europe-west1
- **Auth**: Wymaga admina
- **Działanie**: 
  - Pobiera wszystkie pre-rejestracje ze statusem `pending`
  - Generuje tokeny JWT (ważność 7 dni)
  - Wysyła emaile przez SendGrid
  - Aktualizuje status na `invited`

#### `activatePreRegistration`
- **Typ**: Callable Function (HTTPS)
- **Region**: europe-west1
- **Auth**: Publiczna (weryfikacja tokenu)
- **Parametry**: `{ token: string, password: string }`
- **Działanie**:
  - Weryfikuje token JWT
  - Tworzy użytkownika Firebase Auth
  - Tworzy dokument w `users`
  - Aktualizuje status na `confirmed`

### 2. Strona aktywacji (`/activate/[token]`)

- Formularz ustawienia hasła
- Automatyczne logowanie po aktywacji
- Przekierowanie do `/deals`

### 3. Panel admina (`/admin/pre-registrations`)

- Lista wszystkich pre-rejestracji
- Przycisk "Wyślij zaproszenia (X)" - wywołuje `sendBetaInvitations`
- Eksport CSV
- Statystyki (pionierzy/beta)

## Konfiguracja

### Zmienne środowiskowe (Firebase Functions)

Dodaj w Firebase Console → Functions → Configuration:

```bash
JWT_SECRET=<silny-losowy-string-min-32-znaki>
SENDGRID_API_KEY=<twoj-klucz-sendgrid>
FROM_EMAIL=noreply@okazje.plus
SITE_URL=https://okazje.plus
```

### SendGrid Setup

1. Załóż konto na https://sendgrid.com
2. Zweryfikuj domenę `okazje.plus` (DNS records)
3. Wygeneruj API Key (Settings → API Keys)
4. Dodaj do Firebase Config

### Deploy Functions

```bash
cd okazje-plus
npm run build
firebase deploy --only functions:sendBetaInvitations,functions:activatePreRegistration
```

## Workflow użycia

### Przed Beta Release (24.11.2025 19:00)

1. Admin wchodzi na `/admin/pre-registrations`
2. Sprawdza listę oczekujących (status: pending)
3. Klika "Wyślij zaproszenia (X)"
4. System wysyła emaile do wszystkich pending
5. Status zmienia się na `invited`

### Public Release (26.11.2025 20:00)

1. Weryfikacja podstawowych ścieżek: `/`, `/deals`, `/products`, `/search`
2. Włączenie rejestracji publicznej (landing + formularz)
3. Odświeżenie cache (strony główne + listy)
4. Monitoring metryk: błędy, czas odpowiedzi, rejestracje, CTR

### Użytkownik otrzymuje email

- Temat: `🏆 Zaproszenie do Okazje+ Beta (Pionier #1)` lub `🚀 Zaproszenie do Okazje+ Beta`
- Link: `https://okazje.plus/activate/<jwt-token>`
- Ważność: 7 dni

### Aktywacja konta

1. Użytkownik klika link w emailu
2. Otwiera się `/activate/[token]`
3. Ustawia hasło (min 6 znaków)
4. System:
   - Weryfikuje token
   - Tworzy konto Firebase Auth
   - Tworzy dokument w Firestore `users`
   - Aktualizuje status na `confirmed`
5. Automatyczne logowanie + redirect do `/deals`

## Struktura tokenu JWT

```json
{
  "preRegId": "doc-id-firestore",
  "email": "user@example.com",
  "registrationNumber": 1,
  "role": "pioneer",
  "exp": 1732012800
}
```

## Status flow w `pre_registrations`

```
pending → invited → confirmed
```

- **pending**: Użytkownik zarejestrował się przez landing page
- **invited**: Admin wysłał zaproszenie (email wysłany)
- **confirmed**: Użytkownik aktywował konto (konto utworzone)

## Pola w dokumencie User

```typescript
{
  uid: string;
  email: string;
  displayName: string;
  role: "user";
  betaRole: "pioneer" | "beta"; // Z pre-rejestracji
  betaNumber: number;            // Numer 1-5000
  createdAt: string;
}
```

## Troubleshooting

### Email nie doszedł
- Sprawdź SendGrid Dashboard → Activity
- Sprawdź spam folder
- Zweryfikuj domenę w SendGrid

### Token wygasł
- Token ważny 7 dni od wysłania
- Admin może ponownie wywołać "Wyślij zaproszenia" (wysyła tylko do pending)

### Błąd przy aktywacji
- Sprawdź logi Functions: `firebase functions:log`
- Zweryfikuj JWT_SECRET w obu miejscach (Functions + Next.js)
- Sprawdź czy email nie istnieje już w Firebase Auth

## Testy

### Test lokalny (Emulator)

```bash
# Terminal 1: Uruchom Functions
cd okazje-plus
npm run serve

# Terminal 2: Wywołaj funkcję
curl -X POST http://localhost:5001/okazje-plus/europe-west1/sendBetaInvitations \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
```

### Test produkcyjny

1. Stwórz testową pre-rejestrację
2. Wywołaj z panelu admina
3. Sprawdź email (możesz użyć mailtrap.io)
4. Otwórz link aktywacyjny
5. Zweryfikuj utworzenie użytkownika

## Bezpieczeństwo

- Tokeny JWT podpisane secret key
- Funkcja `sendBetaInvitations` wymaga roli admin
- Tokeny ważne tylko 7 dni
- Email weryfikowany w tokenie vs Firebase Auth
- HTTPS only (Cloud Functions)

## Monitoring

- SendGrid: Activity Dashboard
- Firebase Functions: Logs & Metrics
- Firestore: `pre_registrations` collection (statusy)
- Firebase Auth: User Management (created accounts)

## Koszty

- SendGrid: Free tier do 100 emaili/dzień
- Firebase Functions: ~$0.000001 per invocation
- Firebase Auth: Free do 50k użytkowników
