import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const isServer = typeof window === 'undefined';
const isTestEnv = process.env.NODE_ENV === 'test';

function resolveEnv(key: string, fallback: string): string | undefined {
  const value = process.env[key];
  if (value && value.length > 0) {
    return value;
  }
  return isTestEnv ? fallback : undefined;
}

const defaultClientConfig = {
  apiKey: resolveEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'test-api-key'),
  authDomain: resolveEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'test-app.firebaseapp.com'),
  projectId: resolveEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'test-project'),
  storageBucket: resolveEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'test-app.appspot.com'),
  messagingSenderId: resolveEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '123456789012'),
  appId: resolveEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:123456789012:web:testapp'),
};

// Na serwerze używamy konfiguracji z App Hosting, na kliencie z publicznych zmiennych
// Podczas buildu (bez FIREBASE_WEBAPP_CONFIG) używamy konfiguracji klienta także na serwerze
const firebaseConfig = isServer
  ? (process.env.FIREBASE_WEBAPP_CONFIG 
      ? JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG)
      : {
          ...defaultClientConfig,
        })
  : {
      ...defaultClientConfig,
    };

// Inicjalizuj Firebase tylko raz
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'europe-west1'); // Region zgodny z App Hosting

export { app, auth, db, functions };
