import { NextRequest } from 'next/server';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

async function deleteAllFromCollection(collName: string) {
  const ref = collection(db, collName);
  const snap = await getDocs(ref);
  const batchSize = 500;
  let deleted = 0;
  let docs = snap.docs;
  while (docs.length > 0) {
    const batch = docs.slice(0, batchSize);
    await Promise.all(batch.map(d => deleteDoc(doc(db, collName, d.id))));
    deleted += batch.length;
    docs = docs.slice(batchSize);
  }
  return deleted;
}

export async function POST(req: NextRequest) {
  // UWAGA: endpoint nie wymaga autoryzacji! Zabezpiecz na produkcji!
  const deletedProducts = await deleteAllFromCollection('products');
  const deletedDeals = await deleteAllFromCollection('deals');
  return Response.json({ ok: true, deletedProducts, deletedDeals });
}
