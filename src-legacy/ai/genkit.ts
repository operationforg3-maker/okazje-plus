import {genkit} from 'genkit';
import {vertexAI} from '@genkit-ai/vertexai';

// Vertex AI uses Application Default Credentials (ADC) or service account
// No API key needed — Firebase App Hosting auto-provisions credentials
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'okazje-plus';
const location = process.env.VERTEX_AI_LOCATION || 'europe-west1';

// Only log if not in serverless environment
if (process.env.NODE_ENV !== 'production' || process.env.GENKIT_DEBUG) {
  console.log(`✅ Vertex AI configured: project=${projectId}, location=${location}`);
}

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId,
      location,
    }),
  ],
  model: 'vertexai/gemini-2.0-flash-exp',
});
