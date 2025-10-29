
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

console.log('Attempting to initialize Firebase Admin SDK...');

try {
  // Check if the required environment variables are loaded
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBEASE_PRIVATE_KEY) {
    throw new Error('Missing required Firebase environment variables. Please check your .env.local file.');
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace the escaped newlines from the .env file with actual newlines
    privateKey: process.env.FIREBEASE_PRIVATE_KEY.replace(/\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('Firebase Admin SDK initialized successfully.');

  // Example seeding function - you can replace this with your actual logic
  async function seedDatabase() {
    const db = admin.firestore();
    const testCol = db.collection('test-seed');
    await testCol.add({
      message: 'Seeding script ran successfully!',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Database seeded with a test document.');
  }

  seedDatabase().then(() => {
    console.log('Seeding complete.');
    process.exit(0);
  }).catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  });

} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  process.exit(1);
}
