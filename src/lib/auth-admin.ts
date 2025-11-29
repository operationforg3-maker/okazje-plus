/**
 * Server-side Auth Utilities
 * Helpers for verifying JWT tokens and checking roles in API routes
 */

import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { User } from "@/lib/types";

/**
 * Extract and verify JWT token from Authorization header
 * Returns user UID if valid, null otherwise
 */
export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring("Bearer ".length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Get user document from Firestore by UID
 */
export async function getUserByUid(uid: string): Promise<User | null> {
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return null;
    return userDoc.data() as User;
  } catch {
    return null;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: User | null, allowedRoles: Array<"admin" | "moderator" | "specjalista" | "user">): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Middleware: verify auth and check role
 * Returns { authorized: true, uid, user } or { authorized: false, error }
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: Array<"admin" | "moderator" | "specjalista" | "user">
): Promise<{ authorized: true; uid: string; user: User } | { authorized: false; error: string; status: number }> {
  const uid = await verifyAuthToken(req);
  if (!uid) {
    return { authorized: false, error: "Unauthorized: missing or invalid token", status: 401 };
  }
  const user = await getUserByUid(uid);
  if (!user) {
    return { authorized: false, error: "User not found", status: 404 };
  }
  if (!hasRole(user, allowedRoles)) {
    return { authorized: false, error: "Forbidden: insufficient permissions", status: 403 };
  }
  return { authorized: true, uid, user };
}
