import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PriceAlert {
  id: string;
  userId: string;
  itemId: string;
  itemType: 'deal' | 'product';
  itemTitle: string;
  currentPrice: number;
  targetPrice: number;
  createdAt: string;
  lastChecked?: string;
  triggered?: boolean;
  triggeredAt?: string;
}

/**
 * Tworzy alert spadku ceny
 */
export async function createPriceAlert(
  userId: string,
  itemId: string,
  itemType: 'deal' | 'product',
  itemTitle: string,
  currentPrice: number,
  targetPrice: number
): Promise<string> {
  // Sprawdź czy użytkownik ma już alert dla tego produktu
  const existingAlerts = await getPriceAlerts(userId, itemId, itemType);
  if (existingAlerts.length > 0) {
    throw new Error('Alert już istnieje dla tego produktu');
  }

  const alertsRef = collection(db, 'priceAlerts');
  const docRef = await addDoc(alertsRef, {
    userId,
    itemId,
    itemType,
    itemTitle,
    currentPrice,
    targetPrice,
    createdAt: serverTimestamp(),
    triggered: false,
  });

  return docRef.id;
}

/**
 * Pobiera alerty użytkownika
 */
export async function getUserPriceAlerts(userId: string, limitCount: number = 50): Promise<PriceAlert[]> {
  const alertsRef = collection(db, 'priceAlerts');
  const q = query(
    alertsRef,
    where('userId', '==', userId),
    where('triggered', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      lastChecked: data.lastChecked?.toDate?.() ? data.lastChecked.toDate().toISOString() : undefined,
      triggeredAt: data.triggeredAt?.toDate?.() ? data.triggeredAt.toDate().toISOString() : undefined,
    } as PriceAlert;
  });
}

/**
 * Pobiera alerty dla konkretnego produktu/dealu
 */
export async function getPriceAlerts(
  userId: string,
  itemId: string,
  itemType: 'deal' | 'product'
): Promise<PriceAlert[]> {
  const alertsRef = collection(db, 'priceAlerts');
  const q = query(
    alertsRef,
    where('userId', '==', userId),
    where('itemId', '==', itemId),
    where('itemType', '==', itemType)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    } as PriceAlert;
  });
}

/**
 * Usuwa alert
 */
export async function deletePriceAlert(alertId: string): Promise<void> {
  const alertRef = doc(db, 'priceAlerts', alertId);
  await deleteDoc(alertRef);
}

/**
 * Aktualizuje cenę docelową alertu
 */
export async function updatePriceAlert(alertId: string, newTargetPrice: number): Promise<void> {
  const alertRef = doc(db, 'priceAlerts', alertId);
  await updateDoc(alertRef, {
    targetPrice: newTargetPrice,
  });
}

/**
 * Oznacza alert jako triggered (używane przez Cloud Functions)
 */
export async function triggerPriceAlert(alertId: string): Promise<void> {
  const alertRef = doc(db, 'priceAlerts', alertId);
  await updateDoc(alertRef, {
    triggered: true,
    triggeredAt: serverTimestamp(),
  });
}
