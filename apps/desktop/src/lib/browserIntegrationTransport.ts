import type { LumaTransport } from "./tauri";

/** Test-only transport selected only by the explicit browser integration flag. */
export class BrowserIntegrationTransport implements LumaTransport {
  constructor(private readonly baseUrl: string) {}

  async invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, args: args ?? {} }),
    });

    const payload = (await response.json()) as { result?: T; error?: string };
    if (!response.ok || payload.error) {
      throw new Error(payload.error ?? `Browser integration command failed: ${command}`);
    }
    return payload.result as T;
  }
}
