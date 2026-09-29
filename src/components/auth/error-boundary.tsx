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

  componentDidMount() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const msg = event?.message || '';
        const target = event?.target as HTMLElement | null;
        const isResourceError = target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK');
        if (
          isResourceError ||
          msg.includes('Loading chunk') ||
          msg.includes('ChunkLoadError') ||
          msg.includes('CSS')
        ) {
          const lastReload = sessionStorage.getItem('chunk_error_reload');
          const now = Date.now();
          if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
            sessionStorage.setItem('chunk_error_reload', String(now));
            console.warn('[ErrorBoundary] Stale deployment asset detected. Refreshing for new version...');
            window.location.reload();
          }
        }
      }, true);
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    const name = error?.name || '';
    const message = error?.message || '';
    const isChunkError =
      name === 'ChunkLoadError' ||
      message.includes('Loading chunk') ||
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading CSS chunk') ||
      message.includes('Minified React error #418') ||
      message.includes('Minified React error #423') ||
      message.includes('Hydration failed');

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = sessionStorage.getItem('chunk_error_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('chunk_error_reload', String(now));
        console.warn('[ErrorBoundary] Chunk load or deployment mismatch error detected. Forcing page reload to fetch the latest assets.');
        window.location.reload();
      }
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
