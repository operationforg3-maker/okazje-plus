
import { adminAuth } from '../lib/firebase-admin';

async function listUsers() {
  try {
    const listUsersResult = await adminAuth.listUsers(10);
    listUsersResult.users.forEach((userRecord) => {
      console.log('user', userRecord.email, userRecord.uid, userRecord.customClaims);
    });
  } catch (error) {
    console.log('Error listing users:', error);
  }
}

listUsers();
