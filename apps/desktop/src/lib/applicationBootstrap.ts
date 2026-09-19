import { BrowserIntegrationTransport } from "./browserIntegrationTransport";
import { createLumaApi, resetLumaApi, isTauri, type LumaApiClient } from "./tauri";

/**
 * Which data layer this process will talk to.
 *
 * `UNAVAILABLE` is a real, reportable state: running the UI outside the desktop
 * runtime with no integration bridge means there is no library, no reader and no
 * analytics to show. Commands then fail with `DataServicesUnavailableError`
 * instead of quietly serving invented content.
 */
export type DataTransportKind = "DESKTOP" | "BROWSER-INTEGRATION" | "UNAVAILABLE";

export interface ApplicationBootstrap {
  api: LumaApiClient;
  transport: DataTransportKind;
}

export function bootstrapApplication(): ApplicationBootstrap {
  const integrationBaseUrl = import.meta.env.VITE_LUMA_BROWSER_INTEGRATION_URL as
    | string
    | undefined;
  if (import.meta.env.VITE_LUMA_BROWSER_INTEGRATION_TEST === "true" && integrationBaseUrl) {
    resetLumaApi();
    return {
      api: createLumaApi({
        transport: new BrowserIntegrationTransport(integrationBaseUrl),
      }),
      transport: "BROWSER-INTEGRATION",
    };
  }

  if (isTauri()) {
    resetLumaApi();
    return { api: createLumaApi(), transport: "DESKTOP" };
  }

  resetLumaApi();
  return { api: createLumaApi(), transport: "UNAVAILABLE" };
}
