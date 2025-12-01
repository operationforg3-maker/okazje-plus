/**
 * Server-side authentication helper functions
 * For use in API routes and server components
 */

import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

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
 */
export async function verifyAuthToken(req: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authorized: false,
        error: 'Missing or invalid authorization header'
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return {
        authorized: false,
        error: 'Empty token'
      };
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    return {
      authorized: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user'
    };

  } catch (error: any) {
    console.error('Token verification error:', error);
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
  const authResult = await verifyAuthToken(req);
  
  if (!authResult.authorized) {
    return authResult;
  }

  // Check if user has admin role
  if (authResult.role !== 'admin') {
    return {
      authorized: false,
      error: 'Admin role required'
    };
  }

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
