import { adminDb } from './firebase-admin';
import type admin from 'firebase-admin';

export function getAdminFirestore(): admin.firestore.Firestore {
  return adminDb;
}

