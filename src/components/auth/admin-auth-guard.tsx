'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminAuthGuardProps {
  children: ReactNode;
}

/**
 * AdminAuthGuard — protects admin routes.
 *
 * Strategy:
 * 1. If loading → show skeleton (never redirect while loading).
 * 2. If no user → redirect to /login.
 * 3. If user.role is resolved immediately from custom claims → fast path.
 * 4. If user has no custom claims, auth.tsx loads role from Firestore in the
 *    background AFTER setting loading=false. We give it a 1200ms grace period
 *    before deciding to redirect, so Firestore has time to update the role.
 * 5. If after grace period role is still not 'admin' → redirect to /.
 */
export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Track whether we've waited long enough for Firestore role sync
  const [roleSettled, setRoleSettled] = useState(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Still authenticating — hold everything
    if (loading) {
      setRoleSettled(false);
      return;
    }

    // No user at all — immediate redirect to login
    if (!user) {
      router.push('/login');
      return;
    }

    // Fast path: custom claims already resolved role as admin
    if (user.role === 'admin') {
      setRoleSettled(true);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      return;
    }

    // Slow path: wait for Firestore background sync (auth.tsx updates user.role
    // asynchronously after loading=false when no custom claims are present).
    // Give it 1200ms before deciding to redirect.
    if (!settleTimerRef.current) {
      settleTimerRef.current = setTimeout(() => {
        setRoleSettled(true);
        settleTimerRef.current = null;
      }, 1200);
    }

    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [user, loading, router]);

  // Redirect once role is settled and user is definitively not an admin
  useEffect(() => {
    if (!roleSettled || loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'admin') {
      router.push('/');
    }
  }, [roleSettled, user, loading, router]);

  // Show skeleton while: still loading, user not yet resolved, or waiting for Firestore sync
  if (loading || !user || !roleSettled || user.role !== 'admin') {
    return (
      <div className="w-full h-screen">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  return <>{children}</>;
}
