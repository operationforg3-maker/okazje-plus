import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification } from '@/lib/types';

export async function createNotificationData(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
  const notificationsRef = collection(db, 'notifications');
  const docRef = await addDoc(notificationsRef, {
    ...notification,
    createdAt: serverTimestamp(),
    read: false,
  });
  return docRef.id;
}

export async function getNotificationsData(userId: string, limitCount: number = 50): Promise<Notification[]> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(limitCount));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    } as Notification;
  });
}

export async function getUnreadNotificationsData(userId: string): Promise<Notification[]> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    } as Notification;
  });
}

export async function markNotificationAsReadData(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
  });
}

export async function markAllNotificationsAsReadData(userId: string): Promise<void> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));

  const snapshot = await getDocs(q);
  const updatePromises = snapshot.docs.map(docSnap => updateDoc(docSnap.ref, { read: true }));

  await Promise.all(updatePromises);
}

export async function deleteNotificationData(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'notifications', notificationId);
  await deleteDoc(notificationRef);
}

export async function getUnreadNotificationsCountData(userId: string): Promise<number> {
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));

  const countSnapshot = await getCountFromServer(q);
  return countSnapshot.data().count;
}
