import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { isTauri } from "./lib/tauri";
import { perfTelemetry } from "./lib/perfTelemetry";
import "./styles/index.css";

if (isTauri()) {
  perfTelemetry.mark("LUMA_PERF_TAURI_READY");
}
perfTelemetry.mark("LUMA_PERF_REACT_MOUNT");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


