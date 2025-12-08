/**
 * Server-side authentication helper functions
 * For use in API routes and server components
 */

import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from './firebase-admin';

export interface AuthResult {
  authorized: boolean;
  uid?: string;
  email?: string;
  role?: string;
  error?: string;
}

/**
 * Verify Firebase auth token from request headers
 * Checks for Authorization: Bearer <token> header
 * Falls back to Firestore for role if not in JWT claims
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('authorization');
    
    console.log('[verifyAuthToken] Authorization header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[verifyAuthToken] Invalid authorization header format');
      return {
        authorized: false,
        error: 'Missing or invalid authorization header'
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      console.log('[verifyAuthToken] Empty token after Bearer prefix');
      return {
        authorized: false,
        error: 'Empty token'
      };
    }

    console.log('[verifyAuthToken] Verifying token with Firebase Admin...');
    
    // Verify token with Firebase Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    console.log('[verifyAuthToken] Token verified for user:', decodedToken.uid);
    
    let role = decodedToken.role || 'user';
    
    console.log('[verifyAuthToken] Role from JWT claims:', decodedToken.role || 'none');
    
    // Fallback to Firestore if role not in JWT claims
    if (!decodedToken.role) {
      console.log('[verifyAuthToken] No role in JWT, checking Firestore...');
      try {
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          role = userData?.role || 'user';
          console.log('[verifyAuthToken] Role from Firestore:', role);
        } else {
          console.log('[verifyAuthToken] User document not found in Firestore');
        }
      } catch (firestoreError) {
        console.warn('[verifyAuthToken] Firestore lookup failed:', firestoreError);
        // Continue with default 'user' role
      }
    }
    
    console.log('[verifyAuthToken] Final role:', role);
    
    return {
      authorized: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: role
    };

  } catch (error: any) {
    console.error('[verifyAuthToken] Token verification error:', error.message);
    return {
      authorized: false,
      error: error.message || 'Token verification failed'
    };
  }
}

/**
 * Check if authenticated user has admin role
 * Returns authorized=true only for admin users
 */
export async function checkAdminAuth(req: NextRequest): Promise<AuthResult> {
  console.log('[checkAdminAuth] Checking admin authorization...');
  
  const authResult = await verifyAuthToken(req);
  
  if (!authResult.authorized) {
    console.log('[checkAdminAuth] Token verification failed:', authResult.error);
    return authResult;
  }

  console.log('[checkAdminAuth] Token verified, checking role...');
  console.log('[checkAdminAuth] User role:', authResult.role);
  
  // Check if user has admin role
  if (authResult.role !== 'admin') {
    console.log('[checkAdminAuth] Access denied - role is not admin');
    return {
      authorized: false,
      error: 'Admin role required'
    };
  }

  console.log('[checkAdminAuth] Admin access granted');
  return authResult;
}

/**
 * Check if authenticated user has moderator or admin role
 */
export async function checkModeratorAuth(req: NextRequest): Promise<AuthResult> {
  const authResult = await verifyAuthToken(req);
  
  if (!authResult.authorized) {
    return authResult;
  }

  // Check if user has moderator or admin role
  if (!['admin', 'moderator'].includes(authResult.role || '')) {
    return {
      authorized: false,
      error: 'Moderator role required'
    };
  }

  return authResult;
}

/**
 * Alias for checkAdminAuth - verify admin role
 * @deprecated Use checkAdminAuth instead
 */
export const verifyAdmin = checkAdminAuth;
