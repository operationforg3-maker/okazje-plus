import { SearchClient } from 'typesense';

const typesenseServerClient = process.env.TYPESENSE_SEARCH_ONLY_API_KEY
  ? new SearchClient({
      nodes: [
        {
          host: process.env.NEXT_PUBLIC_TYPESENSE_HOST || process.env.TYPESENSE_HOST || 'localhost',
          port: parseInt(process.env.NEXT_PUBLIC_TYPESENSE_PORT || process.env.TYPESENSE_PORT || '443'),
          protocol: process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || process.env.TYPESENSE_PROTOCOL || 'https',
        },
      ],
      apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY,
      connectionTimeoutSeconds: 2,
    })
  : null;

if (!typesenseServerClient) {
  console.warn('Server Typesense client not initialized. Set TYPESENSE_SEARCH_ONLY_API_KEY and TYPESENSE_HOST/TYPESENSE_PORT/TYPESENSE_PROTOCOL in server env.');
}

export default typesenseServerClient;
