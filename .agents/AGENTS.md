# AGENTS.md — Reguły projektu okazje-plus

## Stack wyszukiwania

**NIE używamy Typesense.** Projekt porzucił Typesense — wszystkie funkcje w `search-server.ts` o nazwie `*Typesense` to legacy nazwy, które **bezpośrednio wywołują Firestore** jako fallback. Typesense nie jest skonfigurowany ani uruchomiony.

- `searchDealsTypesense(...)` → wewnętrznie woła `searchDealsFirestoreFallback` (Firestore Admin SDK)
- `searchProductsTypesense(...)` → wewnętrznie woła `searchProductsFirestoreFallback` (Firestore Admin SDK)  
- `getDealByIdTypesense(dealId)` → wewnętrznie woła `adminDb.collection('deals').doc(dealId).get()` (Firestore Admin SDK)

**Ważne zasady danych:**
- Używaj funkcji z `@/lib/data.ts` lub `@/lib/search-server.ts` do pobierania danych po stronie serwera
- **NIE używaj klienta Firebase (`db` z `@/lib/firebase`) w Server Components** — klient SDK nie działa poprawnie w SSR i zwraca błędne lub puste dane → prowadzi do 404

## Deployment

- Projekt deployowany przez **Firebase App Hosting** (trigger: push do `main` na GitHub)
- Repo: `operationforg3-maker/okazje-plus`
- URL produkcyjny: `https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app`
- Monitorowanie buildu: `npx firebase-tools@latest apphosting:backends:get okazje-plus-backend --project okazje-plus`
- Build trwa ~5-10 minut po pushu

## Baza danych

- **Firestore** (primary) — wszystkie dane dealów, produktów, kategorii, użytkowników
- **Firebase Auth** — uwierzytelnianie
- Admin SDK (`@/lib/firebase-admin`) → używany po stronie serwera
- Klient SDK (`@/lib/firebase`) → używany TYLKO po stronie klienta (w komponentach `'use client'`)
