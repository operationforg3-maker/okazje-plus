import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const isServer = typeof window === 'undefined';
const isTestEnv = process.env.NODE_ENV === 'test';

// Client-side Firebase config from NEXT_PUBLIC_ env vars (inline during build)
const defaultClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (isTestEnv ? 'test-api-key' : ''),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (isTestEnv ? 'test-app.firebaseapp.com' : ''),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (isTestEnv ? 'test-project' : ''),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (isTestEnv ? 'test-app.appspot.com' : ''),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (isTestEnv ? '123456789012' : ''),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || (isTestEnv ? '1:123456789012:web:testapp' : ''),
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
