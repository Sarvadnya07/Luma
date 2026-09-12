import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { bootstrapApplication } from "./lib/applicationBootstrap";
import { isTauri } from "./lib/tauri";
import { perfTelemetry } from "./lib/perfTelemetry";
import "./styles/index.css";

if (isTauri()) {
  perfTelemetry.mark("LUMA_PERF_TAURI_READY");
}
perfTelemetry.mark("LUMA_PERF_REACT_MOUNT");

const bootstrap = bootstrapApplication();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App api={bootstrap.api} />
  </React.StrictMode>
);


