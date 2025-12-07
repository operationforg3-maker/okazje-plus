/**
 * Server-side Authentication Utilities
 * 
 * Provides auth verification for API routes using Firebase Admin SDK.
 */

import { cookies, headers } from 'next/headers';
import { adminAuth, adminDb } from './firebase-admin';

export interface ServerAuthSession {
  uid: string;
  email: string | undefined;
  role: 'admin' | 'moderator' | 'user';
  emailVerified: boolean;
}

/**
 * Get authenticated user session from request
 * 
 * Verifies Firebase ID token from Authorization header or cookie.
 * Fetches user role from Firestore.
 * 
 * @returns Session object or null if not authenticated
 */
export async function getServerAuthSession(): Promise<ServerAuthSession | null> {
  try {
    // Try Authorization header first
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    let token: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Fallback to cookie
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('firebaseIdToken')?.value;
    }
    
    if (!token) {
      return null;
    }
    
    // Verify token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Fetch user role from Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData?.role || 'user',
      emailVerified: decodedToken.email_verified || false,
    };
  } catch (error) {
    console.error('[Auth] Session verification failed:', error);
    return null;
  }
}

/**
 * Require admin role or throw 403 error
 */
export async function requireAdmin(): Promise<ServerAuthSession> {
  const session = await getServerAuthSession();
  
  if (!session) {
    throw new Error('Unauthorized - authentication required');
  }
  
  if (session.role !== 'admin') {
    throw new Error('Forbidden - admin role required');
  }
  
  return session;
}

/**
 * Require moderator or admin role
 */
export async function requireModerator(): Promise<ServerAuthSession> {
  const session = await getServerAuthSession();
  
  if (!session) {
    throw new Error('Unauthorized - authentication required');
  }
  
  if (session.role !== 'admin' && session.role !== 'moderator') {
    throw new Error('Forbidden - moderator or admin role required');
  }
  
  return session;
}
