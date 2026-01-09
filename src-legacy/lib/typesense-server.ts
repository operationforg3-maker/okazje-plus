import { SearchClient } from 'typesense';

const typesenseServerClient =
  process.env.TYPESENSE_HOST && process.env.TYPESENSE_SEARCH_ONLY_API_KEY
    ? new SearchClient({
        nodes: [
          {
            host: process.env.TYPESENSE_HOST,
            port: parseInt(process.env.TYPESENSE_PORT || '443'),
            protocol: (process.env.TYPESENSE_PROTOCOL as 'http' | 'https') || 'https',
          },
        ],
        apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY,
        connectionTimeoutSeconds: 2,
      })
    : null;

if (!typesenseServerClient) {
  console.warn(
    'Server Typesense client not initialized. Set TYPESENSE_HOST and TYPESENSE_SEARCH_ONLY_API_KEY in server env.'
  );
}

export default typesenseServerClient;
