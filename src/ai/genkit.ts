import {genkit} from 'genkit';
import {vertexAI, gemini20Flash} from '@genkit-ai/vertexai';

// Vertex AI uses Application Default Credentials (ADC) or service account
// No API key needed — Firebase App Hosting auto-provisions credentials
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'okazje-plus';
const location = process.env.VERTEX_AI_LOCATION || 'us-central1';

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
  model: gemini20Flash,
});
