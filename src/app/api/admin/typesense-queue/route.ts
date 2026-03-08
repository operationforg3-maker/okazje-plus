import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import typesenseAdminClient from '@/lib/typesense-admin';

export const dynamic = 'force-dynamic';

type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';
type QueueEntity = 'products' | 'deals';
type QueueOperation = 'upsert' | 'delete';

interface TypesenseQueueTask {
  id: string;
  entity: QueueEntity;
  operation: QueueOperation;
  itemId: string;
  status: QueueStatus;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  note?: string;
}

const COLLECTION = 'typesense_index_queue';
const MAX_RETRIES = 5;

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const localizeText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const pl = toStringValue((value as any).pl, '');
    const en = toStringValue((value as any).en, '');
    return pl || en || '';
  }
  return '';
};

async function mapQueueDocument(entity: QueueEntity, itemId: string): Promise<any | null> {
  const sourceCollection = entity === 'deals' ? 'deals' : 'products';
  const docSnap = await adminDb.collection(sourceCollection).doc(itemId).get();

  if (!docSnap.exists) return null;

  const data = docSnap.data() as Record<string, any>;
  if (entity === 'deals') {
    return {
      id: itemId,
      title: localizeText(data.title),
      description: localizeText(data.description),
      price: toNumberValue(data.price?.amount ?? data.price, 0),
      originalPrice: data.originalPrice !== undefined ? toNumberValue(data.originalPrice, 0) : undefined,
      mainCategorySlug: toStringValue(data.mainCategorySlug, 'inne'),
      subCategorySlug: toStringValue(data.subCategorySlug, 'inne'),
      subSubCategorySlug: toStringValue(data.subSubCategorySlug, ''),
      status: toStringValue(data.status, 'draft'),
      temperature: toNumberValue(data.temperature, 0),
      voteCount: toNumberValue(data.voteCount, 0),
      postedBy: toStringValue(data.postedBy, 'system'),
    };
  }

  return {
    id: itemId,
    name: toStringValue(data.name, localizeText(data.title)),
    description: toStringValue(data.description, localizeText(data.shortDescription)),
    longDescription: toStringValue(data.longDescription, localizeText(data.fullDescription)),
    image: toStringValue(data.image, data.imageUrl || ''),
    affiliateUrl: toStringValue(data.affiliateUrl, '#'),
    price: toNumberValue(data.price?.amount ?? data.price, 0),
    originalPrice: data.originalPrice !== undefined ? toNumberValue(data.originalPrice, 0) : undefined,
    mainCategorySlug: toStringValue(data.mainCategorySlug, 'inne'),
    subCategorySlug: toStringValue(data.subCategorySlug, 'inne'),
    subSubCategorySlug: toStringValue(data.subSubCategorySlug, ''),
    status: toStringValue(data.status, 'draft'),
    ratingCard_average: toNumberValue(data.ratingCard?.average, 0),
    ratingCard_count: Math.round(toNumberValue(data.ratingCard?.count, 0)),
  };
}

async function processTask(task: TypesenseQueueTask): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(task.id);
  const attempts = task.attempts || 0;

  await ref.set(
    {
      status: 'processing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  try {
    if (!typesenseAdminClient) {
      throw new Error('Brak konfiguracji Typesense Admin (TYPESENSE_ADMIN_API_KEY)');
    }

    if (task.operation === 'delete') {
      try {
        await (typesenseAdminClient as any).collections(task.entity).documents(task.itemId).delete();
      } catch {
        // Delete should be idempotent.
      }
    } else {
      const mapped = await mapQueueDocument(task.entity, task.itemId);
      if (!mapped) {
        await ref.set(
          {
            status: 'completed',
            note: 'Dokument źródłowy nie istnieje - pominięto',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return;
      }

      await (typesenseAdminClient as any)
        .collections(task.entity)
        .documents()
        .import([mapped], { action: 'upsert' });
    }

    await ref.set(
      {
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastError: null,
      },
      { merge: true }
    );
  } catch (error) {
    const nextAttempts = attempts + 1;
    const terminal = nextAttempts >= MAX_RETRIES;
    await ref.set(
      {
        status: terminal ? 'failed' : 'pending',
        attempts: nextAttempts,
        lastError: error instanceof Error ? error.message : String(error),
        failedAt: terminal ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    throw error;
  }
}

async function loadTasks(limit: number): Promise<TypesenseQueueTask[]> {
  const snapshot = await adminDb.collection(COLLECTION).limit(Math.min(1000, Math.max(limit, 1))).get();
  const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })) as TypesenseQueueTask[];

  return tasks.sort((a, b) => {
    const aMs = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const bMs = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return bMs - aMs;
  });
}

async function countByStatus(status: QueueStatus): Promise<number> {
  const snap = await adminDb.collection(COLLECTION).where('status', '==', status).get();
  return snap.size;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = request.nextUrl.searchParams;
    const status = params.get('status') || 'all';
    const entity = params.get('entity') || 'all';
    const operation = params.get('operation') || 'all';
    const search = (params.get('search') || '').toLowerCase().trim();
    const limit = Math.min(1000, Math.max(1, parseInt(params.get('limit') || '300', 10)));

    let tasks = await loadTasks(limit);

    if (status !== 'all') tasks = tasks.filter((task) => task.status === status);
    if (entity !== 'all') tasks = tasks.filter((task) => task.entity === entity);
    if (operation !== 'all') tasks = tasks.filter((task) => task.operation === operation);
    if (search) {
      tasks = tasks.filter((task) =>
        `${task.id} ${task.itemId} ${task.lastError || ''}`.toLowerCase().includes(search)
      );
    }

    const [pending, processing, completed, failed] = await Promise.all([
      countByStatus('pending'),
      countByStatus('processing'),
      countByStatus('completed'),
      countByStatus('failed'),
    ]);

    return NextResponse.json({
      success: true,
      tasks,
      stats: {
        total: pending + processing + completed + failed,
        pending,
        processing,
        completed,
        failed,
      },
      filters: { status, entity, operation, search, limit },
    });
  } catch (error: any) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień admina' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Błąd pobierania kolejki' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const action = String(body?.action || '');
    const taskIds = Array.isArray(body?.taskIds) ? body.taskIds.map((id: unknown) => String(id)) : [];
    const limit = Math.min(500, Math.max(1, Number(body?.limit || 100)));

    if (action === 'process_pending') {
      const pendingSnap = await adminDb
        .collection(COLLECTION)
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

      const pendingTasks = pendingSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })) as TypesenseQueueTask[];
      const results = await Promise.allSettled(pendingTasks.map((task) => processTask(task)));

      const success = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return NextResponse.json({
        success: true,
        action,
        processed: pendingTasks.length,
        successful: success,
        failed,
      });
    }

    if (action === 'retry_failed') {
      const failedSnap = await adminDb
        .collection(COLLECTION)
        .where('status', '==', 'failed')
        .limit(limit)
        .get();

      const batch = adminDb.batch();
      failedSnap.docs.forEach((doc) => {
        batch.set(
          doc.ref,
          {
            status: 'pending',
            updatedAt: new Date().toISOString(),
            failedAt: null,
          },
          { merge: true }
        );
      });
      await batch.commit();

      return NextResponse.json({ success: true, action, updated: failedSnap.size });
    }

    if (action === 'release_processing') {
      const processingSnap = await adminDb
        .collection(COLLECTION)
        .where('status', '==', 'processing')
        .limit(limit)
        .get();

      const batch = adminDb.batch();
      processingSnap.docs.forEach((doc) => {
        batch.set(
          doc.ref,
          {
            status: 'pending',
            updatedAt: new Date().toISOString(),
            startedAt: null,
          },
          { merge: true }
        );
      });
      await batch.commit();

      return NextResponse.json({ success: true, action, updated: processingSnap.size });
    }

    if (action === 'retry_selected' || action === 'requeue_selected') {
      if (taskIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Brak zaznaczonych tasków' }, { status: 400 });
      }

      const batch = adminDb.batch();
      taskIds.forEach((taskId) => {
        batch.set(
          adminDb.collection(COLLECTION).doc(taskId),
          {
            status: 'pending',
            updatedAt: new Date().toISOString(),
            failedAt: null,
          },
          { merge: true }
        );
      });
      await batch.commit();

      return NextResponse.json({ success: true, action, updated: taskIds.length });
    }

    if (action === 'delete_selected') {
      if (taskIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Brak zaznaczonych tasków' }, { status: 400 });
      }

      const batch = adminDb.batch();
      taskIds.forEach((taskId) => {
        batch.delete(adminDb.collection(COLLECTION).doc(taskId));
      });
      await batch.commit();

      return NextResponse.json({ success: true, action, deleted: taskIds.length });
    }

    return NextResponse.json({ success: false, error: 'Nieznana akcja' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień admina' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Błąd operacji na kolejce' }, { status: 500 });
  }
}
