import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/** Error from loading a code file that a newer deploy replaced. */
export function isChunkLoadError(message: string): boolean {
  return /Loading chunk|dynamically imported module|Failed to fetch dynamically|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message,
  );
}

const STALE_RELOAD_STORAGE = 'xtsy_stale_reload_at';

/** Reload once per minute at most, so a stale tab picks up the new deploy without looping. */
export function shouldReloadForStaleDeploy(now: number, lastReloadAt: number | null): boolean {
  return lastReloadAt === null || now - lastReloadAt > 60_000;
}

export function reloadForStaleDeployOnce(): boolean {
  try {
    const raw = sessionStorage.getItem(STALE_RELOAD_STORAGE);
    const last = raw ? Number(raw) : null;
    if (!shouldReloadForStaleDeploy(Date.now(), Number.isFinite(last) ? last : null)) return false;
    sessionStorage.setItem(STALE_RELOAD_STORAGE, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Error Boundary component optimized for mobile - catches JavaScript errors
 * and provides auto-retry functionality for transient network issues.
 */
class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private static MAX_RETRIES = 2;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error.message);
    
    // Detect network/offline errors
    const isNetworkError = !navigator.onLine || 
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Load failed'); // Safari-specific
    
    // A file from an older deploy: re-rendering cannot fix it, a fresh load can.
    const isChunkError = isChunkLoadError(error.message);
    if (isChunkError && reloadForStaleDeployOnce()) return;

    if (
      this.state.retryCount < ErrorBoundary.MAX_RETRIES &&
      (isChunkError || isNetworkError)
    ) {
      // Exponential backoff: 500ms, 1500ms
      const delay = 500 * Math.pow(2, this.state.retryCount);
      this.retryTimeout = setTimeout(() => {
        this.setState(prev => ({ 
          hasError: false, 
          error: null, 
          retryCount: prev.retryCount + 1 
        }));
      }, delay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  // Full reload: picks up a new deploy and clears any half-loaded state.
  handleRetry = () => {
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Mobile-optimized error UI with inline styles (no CSS load required)
      return (
        <div 
          style={{
            minHeight: '100vh',
            backgroundColor: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            touchAction: 'manipulation'
          }}
        >
          <div style={{ maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            {/* Error icon */}
            <div 
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 24px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                style={{ width: '32px', height: '32px', color: '#ef4444' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f9fafb', marginBottom: '8px' }}>
              {!navigator.onLine ? 'You\'re offline' : 'Page couldn\'t load'}
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              {!navigator.onLine 
                ? 'Please check your internet connection and try again.'
                : 'Something on this page failed to load. Please try again.'
              }
            </p>
            {this.state.error?.message && (
              <p
                style={{
                  color: '#6b7280',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, monospace',
                  marginBottom: '24px',
                  wordBreak: 'break-word',
                }}
              >
                Error: {this.state.error.message.slice(0, 200)}
                {typeof window !== 'undefined' ? ` (${window.location.pathname})` : ''}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: '#f97316',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '16px',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                Try Again
              </button>
              
              <a
                href="/"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: '#1f2937',
                  color: '#f9fafb',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '16px',
                  textDecoration: 'none',
                  textAlign: 'center',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
