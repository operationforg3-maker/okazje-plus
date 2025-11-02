// src/lib/typesense.ts
import { SearchClient } from 'typesense';

const typesenseClient = process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_API_KEY
  ? new SearchClient({
      nodes: [
        {
          host: process.env.NEXT_PUBLIC_TYPESENSE_HOST || 'localhost',
          port: parseInt(process.env.NEXT_PUBLIC_TYPESENSE_PORT || '443'),
          protocol: process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || 'https',
        },
      ],
      apiKey: process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_API_KEY,
      connectionTimeoutSeconds: 2,
    })
  : null;

if (!typesenseClient) {
  console.warn('Typesense client not initialized. Search functionality will be disabled. Make sure to set NEXT_PUBLIC_TYPESENSE_* environment variables.');
}

export default typesenseClient;
