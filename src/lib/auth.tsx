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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUserObj: FirebaseUser | null) => {
      if (firebaseUserObj) {
        const userRef = doc(db, 'users', firebaseUserObj.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const existingData = docSnap.data() as Partial<User>;
          const normalizedUser: User = {
            uid: firebaseUserObj.uid,
            email: existingData.email ?? firebaseUserObj.email ?? null,
            displayName: existingData.displayName ?? firebaseUserObj.displayName ?? null,
            photoURL: existingData.photoURL ?? firebaseUserObj.photoURL ?? null,
            role: existingData.role ?? 'user',
          };

          // Upewnij się, że w dokumencie użytkownika przechowywane jest pole uid oraz aktualne metadane
          await setDoc(userRef, normalizedUser, { merge: true });
          // Batch all setState calls into single update
          setFirebaseUser(firebaseUserObj);
          setUser(normalizedUser);
        } else {
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
        // Batch all setState calls into single update
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
