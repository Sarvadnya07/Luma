import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Layers, Loader2, Plug } from "lucide-react";
import { LumaApi } from "../../lib/tauri";

export interface IntegrationsPluginsViewProps {
  title?: string;
  description?: string;
}

interface IntegrationRecord {
  id: string;
  label: string;
  enabled: boolean;
}

/**
 * Integrations & Plugins.
 *
 * The desktop core exposes no plugin or third-party integration commands, so
 * this screen reports exactly that: no integrations are installed, nothing can
 * be toggled. It reads whatever integration settings the user's database
 * actually contains (currently none by default) instead of listing a
 * catalogue of tools that do not exist in this build.
 */
export const IntegrationsPluginsView: React.FC<IntegrationsPluginsViewProps> = ({
  title = "Integrations & Plugins",
  description = "External services connected to this Luma installation.",
}) => {
  const [integrations, setIntegrations] = useState<IntegrationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const settings = await LumaApi.getAllSettings();
      const prefix = "integration.";
      setIntegrations(
        Object.entries(settings)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({
            id: key.slice(prefix.length),
            label: key.slice(prefix.length),
            enabled: value === true,
          }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6">
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-12">
        <div className="space-y-1 border-b border-[#E5DFD3] pb-6">
          <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">{title}</h1>
          <p className="text-xs text-[#78716C] leading-relaxed max-w-xl">{description}</p>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <span>{error}</span>
            <button onClick={() => void load()} className="underline font-semibold">
              Retry
            </button>
          </div>
        )}

        {integrations === null && !error && (
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-[#78716C]">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Checking connected services…</span>
          </div>
        )}

        {integrations !== null && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <section className="lg:col-span-2 space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
                CONNECTED SERVICES
              </span>

              {integrations.length === 0 ? (
                <div className="border border-dashed border-[#DDD5C7] rounded-2xl p-8 bg-[#FFFFFF]/60 space-y-2">
                  <Plug className="w-6 h-6 text-[#A8A29E]" aria-hidden="true" />
                  <h2 className="font-serif text-base font-bold text-[#1C1917]">
                    No integrations connected
                  </h2>
                  <p className="text-xs text-[#78716C] leading-relaxed max-w-md">
                    This build has no third-party connectors installed. Nothing is connected, and
                    no data leaves your device. Integrations will be listed here once they exist.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {integrations.map((integration) => (
                    <li
                      key={integration.id}
                      className="flex items-center justify-between p-4 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl"
                    >
                      <span className="text-xs font-semibold text-[#1C1917]">
                        {integration.label}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-[#78716C]">
                        {integration.enabled ? "enabled" : "disabled"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
                PLUGIN DIRECTORY
              </span>
              <div className="border border-dashed border-[#DDD5C7] rounded-2xl p-5 bg-[#FFFFFF]/60 space-y-2">
                <Layers className="w-5 h-5 text-[#A8A29E]" aria-hidden="true" />
                <h3 className="font-serif text-sm font-bold text-[#1C1917]">
                  Plugin directory unavailable
                </h3>
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  There is no plugin runtime in this build, so no catalogue is shown. A placeholder
                  catalogue would misrepresent what the application can do.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
