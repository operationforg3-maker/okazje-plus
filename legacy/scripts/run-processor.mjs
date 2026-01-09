import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { register } from 'tsx';

// Register tsx for .ts imports
register();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import of the process-jobs route handler
const { POST } = await import('./src/app/api/cron/process-jobs/route.ts');

// Create a mock request with CRON_SECRET
const mockRequest = {
  nextUrl: {
    searchParams: new URLSearchParams([['secret', 'dev-secret-change-in-production']])
  },
  headers: {
    get: (key) => null
  }
};

console.log('🚀 Running processor...\n');
const response = await POST(mockRequest);
const result = await response.json();
console.log('✅ Processor result:', result);
