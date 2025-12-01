/**
 * Admin API: Scheduled indexes verification configuration
 * POST /api/admin/schedule/indexes
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { checkAdminAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  time?: string; // HH:MM format for daily/weekly
  lastRun?: string;
  nextRun?: string;
  autoFix?: boolean; // Auto-generate missing indexes
}

/**
 * Calculate next run time based on frequency and time
 */
function calculateNextRun(frequency: string, time?: string): Date {
  const now = new Date();
  const nextRun = new Date();
  
  if (frequency === 'hourly') {
    nextRun.setHours(now.getHours() + 1, 0, 0, 0);
  } else if (frequency === 'daily' && time) {
    const [hours, minutes] = time.split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (frequency === 'weekly' && time) {
    const [hours, minutes] = time.split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);
    
    // Set to next Monday
    const daysUntilMonday = (8 - nextRun.getDay()) % 7 || 7;
    nextRun.setDate(nextRun.getDate() + daysUntilMonday);
  }
  
  return nextRun;
}

export async function POST(req: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { enabled, frequency, time, autoFix } = body as Partial<ScheduleConfig>;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    if (!['hourly', 'daily', 'weekly'].includes(frequency || '')) {
      return NextResponse.json(
        { error: 'frequency must be hourly, daily, or weekly' },
        { status: 400 }
      );
    }

    // Calculate next run time if enabling
    const nextRun = enabled ? calculateNextRun(frequency!, time) : null;

    const config: ScheduleConfig = {
      enabled,
      frequency: frequency!,
      time,
      autoFix: autoFix || false,
      nextRun: nextRun?.toISOString()
    };

    // Save to Firestore config collection
    await adminDb.collection('config').doc('indexesSchedule').set(config, { merge: true });

    // TODO: In production, this should also:
    // 1. Create/update Cloud Scheduler job
    // 2. Configure Pub/Sub topic trigger
    // 3. Deploy Cloud Function to handle scheduled verifications
    
    // For now, return success with next run time
    return NextResponse.json({
      success: true,
      config,
      nextRun: nextRun?.toISOString(),
      message: enabled 
        ? `Harmonogram włączony: ${frequency} ${time ? `o ${time}` : ''}`
        : 'Harmonogram wyłączony'
    });

  } catch (error: any) {
    console.error('Schedule config error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve current schedule configuration
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const configDoc = await adminDb.collection('config').doc('indexesSchedule').get();
    const config = configDoc.exists ? configDoc.data() as ScheduleConfig : null;

    return NextResponse.json({
      config: config || {
        enabled: false,
        frequency: 'daily',
        time: '03:00',
        autoFix: false
      }
    });

  } catch (error: any) {
    console.error('Schedule config retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
