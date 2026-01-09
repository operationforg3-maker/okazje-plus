import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, FieldValue } from '@/lib/firebase-admin';

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
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: dealId } = await params;
  let action: 'up' | 'down' | 'remove' | null = null;
  
  try {
    // Bezpieczne parsowanie body z error handling
    let body: any = {};
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError.message);
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body', error: parseError.message },
        { status: 400 }
      );
    }
    
    action = body.action as 'up' | 'down' | 'remove';

    // Walidacja akcji
    if (!['up', 'down', 'remove'].includes(action || '')) {
      return NextResponse.json(
        { success: false, message: 'Nieprawidłowa akcja. Dozwolone: up, down, remove' },
        { status: 400 }
      );
    }

    // AUTORYZACJA - wymagany zweryfikowany token (tak jak w testach importów)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - missing Bearer token' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const token = authHeader.substring(7);
      const decoded = await adminAuth.verifyIdToken(token);
      userId = decoded.uid;
    } catch (error: any) {
      console.error('Token verification failed:', error?.message || error);
      return NextResponse.json(
        { success: false, message: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }
    
    // Rate limiting
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded - max 10 votes per minute' },
        { status: 429 }
      );
    }

    const dealRef = adminDb.collection('deals').doc(dealId);
    const voteRef = dealRef.collection('votes').doc(userId);

    // Pre-check: Sprawdź czy deal istnieje bez transakcji
    try {
      const dealPreCheck = await dealRef.get();
      if (!dealPreCheck.exists) {
        return NextResponse.json(
          { success: false, message: 'Okazja nie została znaleziona' },
          { status: 404 }
        );
      }
    } catch (preCheckError: any) {
      console.error('Pre-check deal error:', preCheckError.message);
      return NextResponse.json(
        { success: false, message: 'Nie można sprawdzić okazji. Spróbuj później.' },
        { status: 503 }
      );
    }

    // Transakcja zapewniająca spójność
    const result = await adminDb.runTransaction(async (transaction) => {
      // Sprawdź czy deal istnieje
      const dealDoc = await transaction.get(dealRef);
      if (!dealDoc.exists) {
        throw new Error('Deal not found');
      }

      const dealData = dealDoc.data();
      if (!dealData) {
        throw new Error('Deal data missing');
      }

      const currentTemperature = dealData.temperature || 0;
      const currentVoteCount = dealData.voteCount || 0;

      // Pobierz obecny głos użytkownika (jeśli istnieje)
      const voteDoc = await transaction.get(voteRef);
      const existingVote = voteDoc.exists ? (voteDoc.data()?.vote as number) : null;

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
        temperature: FieldValue.increment(temperatureChange),
        voteCount: FieldValue.increment(voteCountChange),
      });

      return {
        temperature: currentTemperature + temperatureChange,
        voteCount: currentVoteCount + voteCountChange,
        userVote: newVote,
      };
    });
    
    // Logging dla audytu (opcjonalnie zapisz do Firestore analytics)
    console.log(`Vote logged: user=${userId}, deal=${dealId}, action=${action}, newVote=${result.userVote}, duration=${Date.now() - startTime}ms`);

    const responseData = {
      success: true,
      ...result,
    };
    
    console.log(`Vote response for ${dealId}:`, JSON.stringify(responseData));
    
    // Wyraźna odpowiedź JSON
    const response = NextResponse.json(responseData, { status: 200 });
    response.headers.set('Content-Type', 'application/json');
    return response;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('Vote error:', {
      dealId,
      duration: `${duration}ms`,
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    });
    
    if (error.message === 'Deal not found') {
      return NextResponse.json(
        { success: false, message: 'Okazja nie została znaleziona' },
        { status: 404 }
      );
    }

    // Zawsze zwróć prawidłowy JSON
    const errorResponse = { 
      success: false, 
      message: 'Wystąpił błąd podczas głosowania',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    
    console.error('Returning error response:', errorResponse);
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
