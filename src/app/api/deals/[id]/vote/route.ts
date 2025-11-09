import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';

// Weryfikacja tokenu Firebase (uproszczona - w produkcji użyj Firebase Admin SDK)
async function getUserFromRequest(request: NextRequest): Promise<{ uid: string } | null> {
  // W Next.js App Router z Firebase Auth po stronie klienta,
  // token zwykle przekazywany jest w headerze Authorization
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  // TODO: Zweryfikować token używając Firebase Admin SDK
  // Na razie zakładamy, że token jest w formacie który możemy zdekodować
  // W produkcji MUSI być właściwa weryfikacja!
  
  // Tymczasowe rozwiązanie - pobieramy uid z ciasteczka lub sesji
  // Dla pełnej implementacji potrzebny jest Firebase Admin SDK
  const uid = request.headers.get('x-user-id'); // Tymczasowe
  
  if (!uid) {
    return null;
  }

  return { uid };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;
    const body = await request.json();
    const { action } = body as { action: 'up' | 'down' | 'remove' };

    // Walidacja akcji
    if (!['up', 'down', 'remove'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Nieprawidłowa akcja. Dozwolone: up, down, remove' },
        { status: 400 }
      );
    }

    // Weryfikacja użytkownika - TYMCZASOWO WYŁĄCZONE dla development
    // W produkcji KONIECZNIE włączyć!
    // const user = await getUserFromRequest(request);
    // if (!user) {
    //   return NextResponse.json(
    //     { success: false, message: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    // TYMCZASOWE: Pobierz uid z body (tylko dla development!)
    const userId = body.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'userId jest wymagane' },
        { status: 400 }
      );
    }

    const dealRef = doc(db, 'deals', dealId);
    const voteRef = doc(db, 'deals', dealId, 'votes', userId);

    // Transakcja zapewniająca spójność
    const result = await runTransaction(db, async (transaction) => {
      // Sprawdź czy deal istnieje
      const dealDoc = await transaction.get(dealRef);
      if (!dealDoc.exists()) {
        throw new Error('Deal not found');
      }

      const dealData = dealDoc.data();
      const currentTemperature = dealData.temperature || 0;
      const currentVoteCount = dealData.voteCount || 0;

      // Pobierz obecny głos użytkownika (jeśli istnieje)
      const voteDoc = await transaction.get(voteRef);
      const existingVote = voteDoc.exists() ? voteDoc.data()?.vote as number : null;

      let temperatureChange = 0;
      let voteCountChange = 0;
      let newVote: number | null = null;

      if (action === 'remove') {
        // Usuwanie głosu
        if (existingVote === null) {
          // Brak głosu do usunięcia - idempotencja
          return {
            temperature: currentTemperature,
            voteCount: currentVoteCount,
            userVote: null,
          };
        }

        // Usuwamy głos i odwracamy jego wpływ
        transaction.delete(voteRef);
        temperatureChange = -existingVote;
        voteCountChange = -existingVote;
        newVote = null;

      } else {
        // Głosowanie up lub down
        const voteValue = action === 'up' ? 1 : -1;

        if (existingVote === voteValue) {
          // Ten sam głos ponownie - idempotencja
          return {
            temperature: currentTemperature,
            voteCount: currentVoteCount,
            userVote: existingVote,
          };
        }

        if (existingVote !== null) {
          // Zmiana głosu (np. down → up)
          // Odwracamy stary głos i dodajemy nowy
          temperatureChange = voteValue - existingVote; // np. 1 - (-1) = 2
          voteCountChange = voteValue - existingVote;
        } else {
          // Nowy głos
          temperatureChange = voteValue;
          voteCountChange = voteValue;
        }

        transaction.set(voteRef, { vote: voteValue, createdAt: new Date().toISOString() });
        newVote = voteValue;
      }

      // Aktualizuj deal
      transaction.update(dealRef, {
        temperature: increment(temperatureChange),
        voteCount: increment(voteCountChange),
      });

      return {
        temperature: currentTemperature + temperatureChange,
        voteCount: currentVoteCount + voteCountChange,
        userVote: newVote,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    console.error('Vote error:', error);
    
    if (error.message === 'Deal not found') {
      return NextResponse.json(
        { success: false, message: 'Okazja nie została znaleziona' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Wystąpił błąd podczas głosowania' },
      { status: 500 }
    );
  }
}
