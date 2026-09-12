import { BrowserIntegrationTransport } from "./browserIntegrationTransport";
import { createLumaApi, resetLumaApi, LumaApi, type LumaApiClient } from "./tauri";

export interface ApplicationBootstrap {
  api: LumaApiClient;
  transport: "TAURI" | "BROWSER-INTEGRATION" | "MOCK";
}

export function bootstrapApplication(): ApplicationBootstrap {
  const integrationBaseUrl = import.meta.env.VITE_LUMA_BROWSER_INTEGRATION_URL as string | undefined;
  if (import.meta.env.VITE_LUMA_BROWSER_INTEGRATION_TEST === "true" && integrationBaseUrl) {
    resetLumaApi();
    return {
      api: createLumaApi({
        useMock: false,
        transport: new BrowserIntegrationTransport(integrationBaseUrl),
      }),
      transport: "BROWSER-INTEGRATION",
    };
  }

  return {
    api: LumaApi,
    transport: typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) ? "TAURI" : "MOCK",
  };
}
