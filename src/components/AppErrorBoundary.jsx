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
      const debug = this.props.debug;
      return (
        <main className="app-error-boundary" role="alert">
          <span className="app-error-boundary__label">{debug ? "Runtime Error" : "Temporarily Unavailable"}</span>
          <h1>{debug ? this.state.error.name || "Render failed" : "The interface needs a refresh."}</h1>
          <pre>{debug ? this.state.error.message || String(this.state.error) : "Please reload the page."}</pre>
        </main>
      );
    }

    return this.props.children;
  }
}
