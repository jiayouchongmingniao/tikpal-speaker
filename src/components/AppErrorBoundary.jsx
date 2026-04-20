import React from "react";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App render failed", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-boundary" role="alert">
          <span className="app-error-boundary__label">Runtime Error</span>
          <h1>{this.state.error.name || "Render failed"}</h1>
          <pre>{this.state.error.message || String(this.state.error)}</pre>
        </main>
      );
    }

    return this.props.children;
  }
}
