import { collection, getDocs, where, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('[test-client-sdk] Starting test');
    console.log('[test-client-sdk] db instanceof:', db.constructor.name);
    
    // Spróbuj czytać z collection
    const ref = collection(db, 'product_cores');
    console.log('[test-client-sdk] collection ref created:', !!ref);
    
    const q = query(ref, where('status', '==', 'approved'), limit(5));
    console.log('[test-client-sdk] query created:', !!q);
    
    const snap = await getDocs(q);
    console.log('[test-client-sdk] getDocs completed, size:', snap.size);
    
    return NextResponse.json({
      success: true,
      count: snap.size,
      docs: snap.docs.map(d => d.id),
    });
  } catch (err) {
    console.error('[test-client-sdk] Error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      errorCode: (err as any)?.code,
    }, { status: 500 });
  }
}
