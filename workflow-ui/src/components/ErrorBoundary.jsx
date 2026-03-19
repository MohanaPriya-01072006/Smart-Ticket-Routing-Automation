import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: 40, background: '#fee2e2', color: '#991b1b', borderRadius: 16, maxWidth: 800, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{marginTop: 0, fontSize: 24, fontWeight: 'bold'}}>Component Crashed</h2>
            <details style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#fef2f2', padding: 16, border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontFamily: 'monospace' }}>
              <summary style={{fontWeight: 600, cursor: 'pointer', outline: 'none'}}>{this.state.error && this.state.error.toString()}</summary>
              <div style={{marginTop: 12}}>{this.state.errorInfo?.componentStack}</div>
            </details>
            <button style={{marginTop: 24, padding: '12px 24px', background: '#991b1b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600}} onClick={() => this.props.onClose && this.props.onClose()}>Dismiss Error Screen</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
