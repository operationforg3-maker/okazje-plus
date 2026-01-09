import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    // Get forum threads count (documents in forum collection)
    const threadsSnapshot = await adminDb.collection('forum_threads').count().get();
    const threadsCount = threadsSnapshot.data().count;

    // Get unique users who posted (rough estimate based on replies)
    const repliesSnapshot = await adminDb.collection('forum_replies')
      .select('userId')
      .get();
    
    const uniqueUsers = new Set(repliesSnapshot.docs.map(doc => doc.data().userId)).size;

    // Get replies count
    const repliesCount = repliesSnapshot.size;

    return NextResponse.json({
      success: true,
      threads: threadsCount,
      users: uniqueUsers,
      replies: Math.floor(repliesCount / 30), // Average replies per day (rough estimate)
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Forum Stats API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch forum stats',
      // Fallback values
      threads: 0,
      users: 0,
      replies: 0,
    }, { status: 500 });
  }
}

export const revalidate = 600; // Cache for 10 minutes
