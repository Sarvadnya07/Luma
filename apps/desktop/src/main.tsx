import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { bootstrapApplication } from "./lib/applicationBootstrap";
import { installGlobalErrorHandlers } from "./lib/errorReporting";
import { isTauri } from "./lib/tauri";
import { perfTelemetry } from "./lib/perfTelemetry";
import "./styles/index.css";

if (isTauri()) {
  perfTelemetry.mark("LUMA_PERF_TAURI_READY");
}
perfTelemetry.mark("LUMA_PERF_REACT_MOUNT");

// Capture async failures that never reach the React error boundary.
installGlobalErrorHandlers();

const bootstrap = bootstrapApplication();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Luma could not start: #root mount point is missing from index.html.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary label="app-root" title="Luma hit an unexpected problem">
      <App api={bootstrap.api} />
    </ErrorBoundary>
  </React.StrictMode>
);
