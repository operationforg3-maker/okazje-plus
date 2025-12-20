import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ImportHealthSummary {
  ok: boolean;
  dedupeAiConfigured: boolean;
  firestoreClientConfigured: boolean;
  recommendedBatchInLimit: number;
  notes: string[];
}

export async function GET() {
  try {
    const dedupeAiConfigured = Boolean(process.env.GEMINI_API_KEY);

    // Client-side Firebase config presence (embedded at build time)
    const firebaseClientConfigured = Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    );

    const recommendedBatchInLimit = 30; // Firestore "in" queries practical chunk size

    const notes: string[] = [];
    if (!dedupeAiConfigured) {
      notes.push(
        "Brak GEMINI_API_KEY — AI dedupe (embeddings) będzie wyłączony lub zwróci pusty wynik."
      );
    }
    if (!firebaseClientConfigured) {
      notes.push(
        "Brak części NEXT_PUBLIC_* dla Firebase — klientowe operacje mogą nie działać w przeglądarce."
      );
    }

    const payload: ImportHealthSummary = {
      ok: dedupeAiConfigured || firebaseClientConfigured,
      dedupeAiConfigured,
      firestoreClientConfigured: firebaseClientConfigured,
      recommendedBatchInLimit,
      notes,
    };

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e),
        dedupeAiConfigured: false,
        firestoreClientConfigured: false,
        recommendedBatchInLimit: 30,
        notes: ["Nieznany błąd podczas sprawdzania zdrowia importu"],
      },
      { status: 500 }
    );
  }
}
