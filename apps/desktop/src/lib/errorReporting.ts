/**
 * Frontend error reporting (FE-CRIT-1).
 *
 * Before this module the UI had no error path at all: a failed reader load was
 * a `console.error` and an uncaught render error unmounted the tree into a
 * blank window with no signal. This installs one sink for render errors,
 * `window.onerror`, and unhandled promise rejections, and forwards them to the
 * existing in-app telemetry collector so they are inspectable in one place.
 *
 * Privacy: only a message and stack are captured. Nothing here reads DOM
 * content, user documents, tokens, or paths, so an error report cannot leak
 * library data.
 */

import { perfTelemetry } from "./perfTelemetry";

export type ErrorKind = "render" | "window-error" | "unhandled-rejection";

export interface ErrorReport {
  kind: ErrorKind;
  /** Human-readable message. */
  message: string;
  /** Stack when the runtime provided one. */
  stack?: string;
  /** React component stack (render errors only). */
  componentStack?: string;
  /** Telemetry event name, e.g. `LUMA_ERR_RENDER`. */
  event: string;
}

export type ErrorSink = (report: ErrorReport) => void;

const EVENT_BY_KIND: Record<ErrorKind, string> = {
  render: "LUMA_ERR_RENDER",
  "window-error": "LUMA_ERR_WINDOW",
  "unhandled-rejection": "LUMA_ERR_UNHANDLED_REJECTION",
};

/** Turn any thrown value into a readable message without losing information. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  // Note: `JSON.stringify(undefined)` returns `undefined` at runtime even
  // though it is typed as `string`, so the result is checked rather than
  // trusted — this function must always return a string.
  if (error === undefined) return "Unknown error";
  if (error === null) return "null";
  try {
    const json: unknown = JSON.stringify(error);
    return typeof json === "string" ? json : String(error);
  } catch {
    return String(error);
  }
}

export function stackOf(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export function createErrorSink(
  logger: Pick<Console, "error"> = console,
  telemetry: typeof perfTelemetry = perfTelemetry
): ErrorSink {
  return (report) => {
    logger.error(`[${report.event}] ${report.message}`);
    telemetry.mark(report.event, {
      message: report.message,
      stack: report.stack,
      componentStack: report.componentStack,
    });
  };
}

/** Default sink used by the error boundary and the global handlers. */
export const reportError: ErrorSink = createErrorSink();

export function buildReport(
  kind: ErrorKind,
  error: unknown,
  componentStack?: string
): ErrorReport {
  return {
    kind,
    event: EVENT_BY_KIND[kind],
    message: describeError(error),
    stack: stackOf(error),
    componentStack,
  };
}

/**
 * Capture failures that never reach React's error boundary: asynchronous work
 * (IPC promises, event handlers) and module-level throws.
 *
 * Returns a disposer so tests can install/uninstall without leaking listeners.
 */
export function installGlobalErrorHandlers(sink: ErrorSink = reportError): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    sink(buildReport("window-error", event.error ?? event.message));
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    sink(buildReport("unhandled-rejection", event.reason));
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
