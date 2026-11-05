import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '12px' }}>Something went wrong</h1>
          <p style={{ color: '#666', marginBottom: '24px' }}>An unexpected error occurred. Please try reloading the page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', fontSize: '1rem', border: 'none', borderRadius: '6px',
              background: '#d89b4a', color: '#fff', cursor: 'pointer',
            }}
          >
            Reload page
          </button>
          {this.props.showDetails && (
            <pre style={{ marginTop: '24px', textAlign: 'left', maxWidth: '600px', margin: '24px auto', fontSize: '0.8rem', color: '#999' }}>
              {this.state.error?.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}