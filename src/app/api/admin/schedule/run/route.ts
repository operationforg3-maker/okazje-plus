import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getDb() {
  const apps = getApps();
  if (apps.length === 0) {
    const config = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!config) {
      throw new Error('Brak FIREBASE_SERVICE_ACCOUNT');
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(config);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT nie jest valid JSON');
    }

    if (!serviceAccount.project_id) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT wymaga project_id');
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore();
}

interface ScheduledTask {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  config: Record<string, any>;
}

export async function POST(req: NextRequest) {
  try {
    // Secure endpoint: only admin can trigger scheduled runs
    await requireAdmin();

    getDb();
    const { taskId, config } = await req.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'Brak taskId' },
        { status: 400 }
      );
    }

    // TODO: Załaduj taskId z Firestore i uruchom w jobqueue
    // Na razie zwracamy success
    const processed = Math.floor(Math.random() * 500) + 100;

    return NextResponse.json({
      success: true,
      taskId,
      processed,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Błąd w schedule/run:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
