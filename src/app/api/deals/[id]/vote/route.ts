import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * Weryfikacja tokenu Firebase z wykorzystaniem Admin SDK
 * PRODUCTION-READY implementation
 */
async function getUserFromRequest(request: NextRequest): Promise<{ uid: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Weryfikuj token używając Firebase Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    return { uid: decodedToken.uid };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Rate limiting - prosta implementacja w pamięci (dla produkcji użyj Redis)
const voteRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = voteRateLimit.get(userId);
  
  if (!limit || now > limit.resetAt) {
    // Reset counter co minute
    voteRateLimit.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (limit.count >= 10) { // Max 10 votes per minute
    return false;
  }
  
  limit.count++;
  return true;
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

    // AUTORYZACJA - wymagany zweryfikowany token
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - musisz być zalogowany' },
        { status: 401 }
      );
    }
    
    const userId = user.uid;
    
    // Rate limiting
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded - max 10 votes per minute' },
        { status: 429 }
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

        transaction.set(voteRef, {
          vote: voteValue,
          createdAt: new Date().toISOString(),
          userId, // Zabezpieczenie - zapisz userId
        });
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
    
    // Logging dla audytu (opcjonalnie zapisz do Firestore analytics)
    console.log(`Vote logged: user=${userId}, deal=${dealId}, action=${action}, newVote=${result.userVote}`);

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
