import Typesense from 'typesense';

const host = process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST;
const port = parseInt(process.env.TYPESENSE_PORT || process.env.NEXT_PUBLIC_TYPESENSE_PORT || '443', 10);
const protocol = (process.env.TYPESENSE_PROTOCOL || process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || 'https') as 'http' | 'https';
const apiKey = process.env.TYPESENSE_ADMIN_API_KEY;

const typesenseAdminClient =
  host && apiKey
    ? new (Typesense as any).Client({
        nodes: [{ host, port, protocol }],
        apiKey,
        connectionTimeoutSeconds: 5,
      })
    : null;

if (!typesenseAdminClient) {
  console.warn('Typesense admin client not initialized. Set TYPESENSE_HOST and TYPESENSE_ADMIN_API_KEY.');
}

export default typesenseAdminClient;
