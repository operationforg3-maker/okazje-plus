# Vertex AI — Przewodnik dla Okazje Plus (Dec 2025)

> Oficjalna dokumentacja: https://cloud.google.com/vertex-ai/docs (wymaga zalogowania do GCP). Poniżej skrót wdrożeniowy pod nasze środowisko (Next.js 15 + Firebase App Hosting, Cloud Functions, Genkit flows).

## 1. Po co nam Vertex AI
- Generowanie/uzupełnianie opisów i tagów ofert (Gemini 1.5 Flash/Pro).
- Moderacja treści (prompt-level safety, opcjonalnie Content Safety API jeśli włączymy).
- Embeddingi do wyszukiwania/podobieństw (np. `text-embedding-004` dla Typesense/Redis cache).
- Rozszerzenia AI w Genkit (flow: deal enricher, smart match, rekomendacje).

## 2. Wymagania i konfiguracja projektu GCP
- Włącz API: **Vertex AI API** w projekcie (tym samym co Firebase Hosting/App Engine).
- Region rekomendowany: `europe-west1` (spójnie z App Hosting eu-west). Używaj jednego regionu w kodzie i configu.
- Role dla service account używanego przez App Hosting/Functions: `Vertex AI User`, `Service Account Token Creator`; jeśli zapis do GCS/BigQuery → `Storage Object Viewer`/`BigQuery Data Editor`.
- Klucze lokalne: do dev ustaw `GOOGLE_APPLICATION_CREDENTIALS` na JSON SA z powyższymi rolami (nie commitujemy klucza).

## 3. Autoryzacja
- **Prod (App Hosting/Functions)**: domyślne SA projektu; upewnij się, że ma role z pkt 2.
- **Lokalnie**: `export GOOGLE_APPLICATION_CREDENTIALS=/path/key.json` + `GOOGLE_CLOUD_PROJECT=<project-id>` + `VERTEX_LOCATION=europe-west1`.
- Tokeny i podpisy są obsługiwane przez klienta `@google-cloud/vertexai` (brak ręcznego signowania).

## 4. Klient Node/TS (Next.js / Functions / Genkit)
Dodaj zależność (jeśli nie ma):
```bash
npm install @google-cloud/vertexai
```
Przykładowa inicjalizacja (TS):
```ts
import { VertexAI } from "@google-cloud/vertexai";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.VERTEX_LOCATION || "europe-west1";

const vertex = new VertexAI({ project, location });
```

## 5. Generowanie (Gemini 1.5)
```ts
import { VertexAI } from "@google-cloud/vertexai";

const vertex = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT!, location: "europe-west1" });
const model = vertex.preview.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function generateSummary(prompt: string) {
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
  });
  return res.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
```

## 6. Embeddingi (wyszukiwanie/podobieństwa)
```ts
import { VertexAI } from "@google-cloud/vertexai";

const vertex = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT!, location: "europe-west1" });
const embedModel = vertex.preview.getGenerativeModel({ model: "text-embedding-004" });

export async function embedText(text: string) {
  const res = await embedModel.embedContent({
    content: { parts: [{ text }] },
  });
  return res?.embedding?.values || [];
}
```
- Warto trzymać wektor w cache/DB (np. Redis/Typesense). Zwraca wektor długości 768 (sprawdź w doc; może ulec zmianie przy nowych wersjach).

## 7. Moderacja / bezpieczeństwo
- Używaj `safetySettings` w `generateContent` (blokady na harassment, hate, self-harm itp.).
- Nie wysyłaj PII użytkowników w promptach; pseudonimizuj dane transakcyjne.
- Loguj `finishReason` i `safetyRatings` dla audytu.

## 8. Limity, koszty, wydajność
- Limity QPS/RPM zależne od modelu i regionu; przy 429/500 stosuj exponential backoff.
- Pamiętaj o kosztach tokenów (input+output) oraz embeddingów; monitoruj w Cloud Billing → budżety + alerty.
- Buforuj wyniki embeddingów i powtarzalnych promptów (cache) by zmniejszyć koszty.

## 9. Integracja z Genkit (skrót)
- W flows w `src/ai/flows/*` korzystaj z `@google-cloud/vertexai` lub pluginu Genkit (jeśli dodamy). W Genkit runnerze pamiętaj o env `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`.
- Jeśli flow ma pisać do Firestore/Typesense, zachowaj kolejność: embed → zapisz wektor → zapisz dokument.

## 10. Checklist wdrożeniowy
- [ ] Włącz Vertex AI API w projekcie i ustaw region `europe-west1`.
- [ ] Upewnij się, że SA produkcyjne ma role: Vertex AI User (+ ewentualnie Storage/BigQuery).* 
- [ ] Dodaj `@google-cloud/vertexai` do zależności i inicjalizację w shared helperze (np. `src/lib/vertex.ts`).
- [ ] Zaimplementuj generowanie (Gemini 1.5) + testy jednostkowe promptów krytycznych.
- [ ] Zaimplementuj embeddingi (`text-embedding-004`) + cache + testy wektorowej długości.
- [ ] Dodaj safety settings i logowanie `finishReason/safetyRatings`.
- [ ] Włącz budżety/alerty w Cloud Billing.

\* Jeśli używamy Content Safety API lub Image models: dodaj odpowiednie role (Vertex AI Service Agent, Storage Object Viewer dla bucketów modelowych).
