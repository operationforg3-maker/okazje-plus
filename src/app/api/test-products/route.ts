import { collection, getDocs, where, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const q = query(
      collection(db, 'product_cores'),
      where('status', '==', 'approved'),
      limit(10)
    );
    const snap = await getDocs(q);
    return NextResponse.json({
      count: snap.size,
      docs: snap.docs.map(d => ({ id: d.id, title: d.data().title })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
