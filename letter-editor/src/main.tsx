import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "white", fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
          <h2 style={{ color: "#ff6b6b", marginBottom: 12 }}>❌ 에러 발생</h2>
          <div style={{ background: "#1a1a26", padding: 12, borderRadius: 6, border: "1px solid #3a3a4a" }}>
            <strong>{this.state.error.name}:</strong> {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </div>
          <button onClick={() => location.reload()} style={{ marginTop: 12, padding: "6px 14px" }}>다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
