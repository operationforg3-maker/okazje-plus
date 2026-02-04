import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/harvester/presets/[id]
 * Pobierz pojedynczy preset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const doc = await adminDb.collection('harvester_presets').doc(params.id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      preset: { id: doc.id, ...doc.data() },
    });
  } catch (error: any) {
    console.error('[Presets API] GET error:', error);
    
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch preset' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/harvester/presets/[id]
 * Aktualizuj preset
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const body = await request.json();
    const updates = {
      ...body,
      updatedAt: new Date().toISOString(),
    };

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.createdAt;
    delete updates.totalRuns;
    delete updates.lastRun;

    await adminDb.collection('harvester_presets').doc(params.id).update(updates);

    const updated = await adminDb.collection('harvester_presets').doc(params.id).get();

    return NextResponse.json({
      success: true,
      preset: { id: updated.id, ...updated.data() },
    });
  } catch (error: any) {
    console.error('[Presets API] PATCH error:', error);
    
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update preset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/harvester/presets/[id]
 * Usuń preset
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    await adminDb.collection('harvester_presets').doc(params.id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Presets API] DELETE error:', error);
    
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete preset' },
      { status: 500 }
    );
  }
}
