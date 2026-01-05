'use client';

import { createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut, getIdToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import { User } from '@/lib/types';

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
          const docSnap = await getDoc(userRef);

          if (docSnap.exists()) {
            console.log('[AuthProvider] User document found');
            const existingData = docSnap.data() as Partial<User>;
            const normalizedUser: User = {
              uid: firebaseUserObj.uid,
              email: existingData.email ?? firebaseUserObj.email ?? null,
              displayName: existingData.displayName ?? firebaseUserObj.displayName ?? null,
              photoURL: existingData.photoURL ?? firebaseUserObj.photoURL ?? null,
              role: existingData.role ?? 'user',
            };

            console.log('[AuthProvider] Updating user document and state:', normalizedUser);
            // Upewnij się, że w dokumencie użytkownika przechowywane jest pole uid oraz aktualne metadane
            await setDoc(userRef, normalizedUser, { merge: true });
            // Batch all setState calls into single update
            setFirebaseUser(firebaseUserObj);
            setUser(normalizedUser);
          } else {
            console.log('[AuthProvider] Creating new user document');
            const newUser: User = {
              uid: firebaseUserObj.uid,
              email: firebaseUserObj.email,
              displayName: firebaseUserObj.displayName,
              photoURL: firebaseUserObj.photoURL,
              role: 'user', 
            };
            await setDoc(userRef, newUser);
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
