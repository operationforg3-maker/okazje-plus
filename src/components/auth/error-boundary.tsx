'use client';

import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    const name = error?.name || '';
    const message = error?.message || '';
    const isChunkError =
      name === 'ChunkLoadError' ||
      message.includes('Loading chunk') ||
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading CSS chunk');

    if (isChunkError && typeof window !== 'undefined') {
      console.warn('[ErrorBoundary] Chunk load error detected. Forcing page reload to fetch the latest assets.');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      console.log('[ErrorBoundary] Rendering fallback');
      return (
        this.props.fallback || (
          <div style={{ padding: '8px 12px', backgroundColor: '#fee2e2', borderRadius: '6px', fontSize: '12px' }}>
            ❌ Błąd komponenty
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
