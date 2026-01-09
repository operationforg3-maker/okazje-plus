'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface WithAuthOptions {
  requiredRole?: 'admin' | 'moderator' | 'user';
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: WithAuthOptions
) {
  return function WithAuth(props: P) {
    // Defensywnie: jeśli context nie jest dostępny (edge case przed inicjalizacją Provider), traktuj jak loading
    let { user, loading } = useAuth() as any;
    if (typeof loading !== 'boolean') {
      loading = true;
      user = null;
    }
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push('/login');
      } else if (!loading && user && options?.requiredRole) {
        // TODO: Sprawdź role użytkownika z Firebase custom claims
        // na razie pozwalamy wszystkim zalogowanym
      }
    }, [user, loading, router, options?.requiredRole]);

    if (loading || !user) {
      return <div>Loading...</div>; // Or a proper loading component
    }

    return <Component {...props} />;
  };
}