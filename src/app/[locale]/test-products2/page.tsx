'use client';

import React, { useEffect, useState } from 'react';
import { getProductCoresByFilters } from '@/lib/data';

export default function TestPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        console.log('[TEST] Starting getProductCoresByFilters call...');
        const result = await getProductCoresByFilters({}, 'relevance', 100);
        console.log('[TEST] Got result:', result);
        setData(result);
      } catch (err: any) {
        console.error('[TEST] ERROR:', err);
        setError({
          message: err.message || String(err),
          code: err.code || 'UNKNOWN',
          stack: err.stack || '',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) {
    return (
      <pre style={{ color: 'red', padding: '20px', whiteSpace: 'pre-wrap' }}>
        ERROR: {JSON.stringify(error, null, 2)}
      </pre>
    );
  }
  return (
    <pre style={{ padding: '20px' }}>
      Data: {JSON.stringify(data, null, 2)}
    </pre>
  );
}
