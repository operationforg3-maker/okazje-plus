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
        const userRole = user.role;
        const required = options.requiredRole;
        if (required === 'admin' && userRole !== 'admin') {
          router.push('/');
        } else if (required === 'moderator' && userRole !== 'admin' && userRole !== 'moderator') {
          router.push('/');
        }
      }
    }, [user, loading, router, options?.requiredRole]);

    const isAuthorized = !options?.requiredRole || (
      user && (
        options.requiredRole === 'user' ||
        (options.requiredRole === 'moderator' && (user.role === 'admin' || user.role === 'moderator')) ||
        (options.requiredRole === 'admin' && user.role === 'admin')
      )
    );

    if (loading || !user || !isAuthorized) {
      return <div>Loading...</div>;
    }

    return <Component {...props} />;
  };
}