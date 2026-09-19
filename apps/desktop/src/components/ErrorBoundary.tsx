import React from "react";
import { buildReport, reportError, type ErrorSink } from "../lib/errorReporting";

/**
 * UI error boundary (FE-CRIT-1).
 *
 * React 18 unmounts the whole tree when a render throws, which in a desktop
 * window means a blank, dead window. Two instances are used:
 *   - a root boundary in `main.tsx` (last line of defence: offers reload), and
 *   - a section boundary in `App` (offers "return to library" and a retry).
 *
 * Deliberately dependency-free: it must render even when the design system,
 * theme tokens, or the failing subtree are themselves broken, so it uses inline
 * styles with CSS-variable fallbacks.
 */

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Identifies the boundary in telemetry, e.g. "app-root" | "reader". */
  label: string;
  /** Short message shown above the technical detail. */
  title?: string;
  /** Optional escape hatch, e.g. return to the library. */
  onReturnHome?: () => void;
  /** Label for the escape hatch button. */
  returnHomeLabel?: string;
  /** Injected for tests; defaults to the app-wide sink. */
  sink?: ErrorSink;
  /**
   * When this value changes, a previously caught error is cleared — used so
   * navigating away from a broken view recovers automatically.
   */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ info });
    (this.props.sink ?? reportError)({
      ...buildReport("render", error, info.componentStack ?? undefined),
      message: `[${this.props.label}] ${error.message}`,
    });
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null, info: null });
  };

  private handleReload = (): void => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          height: "100%",
          minHeight: "12rem",
          padding: "2rem",
          textAlign: "center",
          background: "var(--bg-primary, #FAF7F2)",
          color: "var(--text-primary, #1C1917)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
          {this.props.title ?? "This view stopped responding"}
        </h2>
        <p style={{ margin: 0, maxWidth: "32rem", fontSize: "0.8125rem", opacity: 0.8 }}>
          Your library and annotations are safe — nothing was lost. You can retry
          this view, or go back and continue reading.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: "0.4rem 0.9rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border-medium, #C8BFB0)",
              background: "var(--bg-surface, #FFFFFF)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
          {this.props.onReturnHome && (
            <button
              type="button"
              onClick={this.props.onReturnHome}
              style={{
                padding: "0.4rem 0.9rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                borderRadius: "0.5rem",
                border: "1px solid transparent",
                background: "var(--text-primary, #1C1917)",
                color: "var(--bg-primary, #FAF7F2)",
                cursor: "pointer",
              }}
            >
              {this.props.returnHomeLabel ?? "Return to library"}
            </button>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: "0.4rem 0.9rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border-medium, #C8BFB0)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Reload Luma
          </button>
        </div>
        <details style={{ fontSize: "0.75rem", opacity: 0.7, maxWidth: "36rem" }}>
          <summary style={{ cursor: "pointer" }}>Technical detail</summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              textAlign: "left",
              marginTop: "0.5rem",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
