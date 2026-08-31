import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.okazjeplus.app',
  appName: 'Okazje+',
  webDir: 'public',
  server: {
    // Adres serwera produkcyjnego (lub lokalnego dev serwera przez zmienną środowiskową)
    url: process.env.CAPACITOR_SERVER_URL || 'https://okazje-plus-backend--okazje-plus.europe-west4.hosted.app',
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#090d16',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090d16',
      overlaysWebView: false
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
