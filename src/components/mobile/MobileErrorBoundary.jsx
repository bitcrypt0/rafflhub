import React from 'react';

class MobileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('Mobile component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI for mobile errors
      return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="text-lg font-bold text-foreground" style={{ fontFamily: 'Orbitron, monospace' }}>
              Dropr
            </div>
            <div className="text-sm text-muted-foreground">
              Mobile Menu
            </div>
          </div>
        </header>
      );
    }

    return this.props.children;
  }
}

export default MobileErrorBoundary;
