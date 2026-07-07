'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminAuthGuardProps {
  children: ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return; // Do nothing while loading
    }

    // If loading is finished and there's no user, redirect to login
    if (!user) {
      router.push('/login');
      return;
    }

    // If the user is not an admin, redirect to the homepage
    if (user.role !== 'admin') {
      router.push('/');
    }
  }, [user, loading, router]);

  // While loading, or if the user is not an authorized admin, show a loading state.
  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="w-full h-screen">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  // If the user is an admin, render the protected content.
  return <>{children}</>;
}
