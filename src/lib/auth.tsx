'use client';

import { createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut, getIdToken, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import { User } from '@/lib/types';

const normalizeRole = (val?: string | null): User['role'] => {
  if (!val) return 'user';
  const v = val.toLowerCase();
  if (v === 'admin' || v === 'administrator') return 'admin';
  if (v === 'moderator') return 'moderator';
  if (v === 'specjalista' || v === 'specialist') return 'specjalista';
  return 'user';
};

interface AuthContextType {
  user: User | null; 
  loading: boolean;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  logout: async () => {},
  getIdToken: async () => null
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const tokenLogOnceRef = useRef(false);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  useEffect(() => {
    console.log('[AuthProvider] Setting up auth listener...');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUserObj: FirebaseUser | null) => {
      console.log('[AuthProvider] Auth state changed:', { 
        hasUser: !!firebaseUserObj, 
        uid: firebaseUserObj?.uid,
        email: firebaseUserObj?.email 
      });
      
      try {
        if (firebaseUserObj) {
          const userRef = doc(db, 'users', firebaseUserObj.uid);
          console.log('[AuthProvider] Fetching user document...');

          // Fetch custom claims (e.g., admin role) to avoid missing admin menu
          let claimRole: string | undefined;
          try {
            const tokenResult = await getIdTokenResult(firebaseUserObj);
            // Check for both 'role' and 'admin' custom claims
            if (tokenResult.claims?.admin === true) {
              claimRole = 'admin';
              console.log('[AuthProvider] role from custom claims (admin=true):', claimRole);
            } else if (typeof tokenResult.claims?.role === 'string') {
              claimRole = tokenResult.claims.role as string;
              console.log('[AuthProvider] role from custom claims (role field):', claimRole);
            }
          } catch (err) {
            console.warn('[AuthProvider] Unable to read custom claims:', err);
          }

          // Add timeout to prevent infinite hang
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore timeout after 10s')), 10000)
          );
          
          const docSnap = await Promise.race([
            getDoc(userRef),
            timeoutPromise
          ]).catch((error) => {
            console.error('[AuthProvider] Firestore getDoc error or timeout:', error);
            return null;
          }) as any; // Type assertion needed for Promise.race with timeout

          if (docSnap && docSnap.exists && typeof docSnap.exists === 'function' && docSnap.exists()) {
            console.log('[AuthProvider] User document found');
            const existingData = docSnap.data() as Partial<User>;
            const normalizedUser: User = {
              uid: firebaseUserObj.uid,
              email: existingData.email ?? firebaseUserObj.email ?? null,
              displayName: existingData.displayName ?? firebaseUserObj.displayName ?? null,
              photoURL: existingData.photoURL ?? firebaseUserObj.photoURL ?? null,
              role: normalizeRole(claimRole) ?? normalizeRole(existingData.role ?? undefined),
            };

            console.log('[AuthProvider] User loaded - role:', normalizedUser.role);
            // Batch all setState calls into single update
            setFirebaseUser(firebaseUserObj);
            setUser(normalizedUser);
          } else {
            console.log('[AuthProvider] Creating new user document or doc not found');
            const newUser: User = {
              uid: firebaseUserObj.uid,
              email: firebaseUserObj.email,
              displayName: firebaseUserObj.displayName,
              photoURL: firebaseUserObj.photoURL,
              role: normalizeRole(claimRole), 
            };
            await Promise.race([
              setDoc(userRef, newUser),
              new Promise((_, reject) => setTimeout(() => reject(new Error('setDoc timeout')), 5000))
            ]).catch(err => console.error('[AuthProvider] setDoc error on new user:', err));
            
            // Batch all setState calls into single update
            setFirebaseUser(firebaseUserObj);
            setUser(newUser);
          }
        } else {
          console.log('[AuthProvider] No user, clearing state');
          // Batch all setState calls into single update
          setFirebaseUser(null);
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthProvider] Error in auth handler:', error);
        // Even on error, we should complete loading
        setFirebaseUser(null);
        setUser(null);
      } finally {
        // ALWAYS set loading to false in finally block
        console.log('[AuthProvider] Setting loading to false');
        setLoading(false);
      }
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const contextValue = useMemo(() => {
    const getTokenForUser = async (): Promise<string | null> => {
      try {
        if (!firebaseUser) {
          console.warn('[AuthProvider] getIdToken called but firebaseUser is null');
          return null;
        }
        const token = await getIdToken(firebaseUser);
        if (!tokenLogOnceRef.current) {
          console.debug('[AuthProvider] ID token fetched');
          tokenLogOnceRef.current = true;
        }
        return token;
      } catch (error) {
        console.error('[AuthProvider] Error getting ID token:', error);
        return null;
      }
    };

    return { user, loading, logout, getIdToken: getTokenForUser };
  }, [user, loading, firebaseUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Helper do sprawdzania czy użytkownik jest adminem
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};
