
import { adminAuth, adminDb } from '../lib/firebase-admin';

const targetEmails = [
  'tomulaz@gmail.com',
  'admin@okazjeplus.pl',
  'admin@example.com',
  'maciejka900528@gmail.com'
];

async function setAdminRoles() {
  console.log('[Script] Starting admin role assignment...');
  
  for (const email of targetEmails) {
    try {
      const user = await adminAuth.getUserByEmail(email);
      console.log(`Processing ${email} (${user.uid})...`);
      
      // 1. Set Auth Custom Claims
      await adminAuth.setCustomUserClaims(user.uid, { 
        role: 'admin',
        admin: true 
      });
      console.log(' - Auth Claims set');
      
      // 2. Set Firestore User Document
      await adminDb.collection('users').doc(user.uid).set({
        role: 'admin',
        email: email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(' - Firestore Doc updated');
      
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`Skipping ${email} - user not found`);
      } else {
        console.error(`Error processing ${email}:`, error);
      }
    }
  }
  
  console.log('[Script] Done. Users must logout and login again.');
}

setAdminRoles();
