import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getFunctions, Functions } from "firebase/functions";

const isServer = typeof window === 'undefined';
const isTestEnv = process.env.NODE_ENV === 'test';
const isBuildTime = isServer && !process.env.FIREBASE_WEBAPP_CONFIG && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Client-side Firebase config from NEXT_PUBLIC_ env vars (inline during build)
const defaultClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (isTestEnv ? 'test-api-key' : 'placeholder-key'),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (isTestEnv ? 'test-app.firebaseapp.com' : 'placeholder.firebaseapp.com'),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (isTestEnv ? 'test-project' : 'placeholder-project'),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (isTestEnv ? 'test-app.appspot.com' : 'placeholder.appspot.com'),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (isTestEnv ? '123456789012' : '000000000000'),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || (isTestEnv ? '1:123456789012:web:testapp' : '1:000000000000:web:placeholder'),
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
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

// W czasie budowania bez konfiguracji Firebase, nie inicjalizuj prawdziwego połączenia
if (isBuildTime) {
  // Tworzymy mockowy obiekt Firebase dla czasu budowania
  console.log('[firebase] Build-time mode: using placeholder config');
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app, 'europe-west1');
} else {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app, 'europe-west1'); // Region zgodny z App Hosting
}

export { app, auth, db, functions };
