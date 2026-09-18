import { describe, it, expect, vi } from "vitest";
import {
  buildReport,
  createErrorSink,
  describeError,
  installGlobalErrorHandlers,
  reportError,
  stackOf,
  type ErrorSink,
} from "../errorReporting";

function fakeTelemetry(): { mark: (event: string, metadata?: unknown) => number } {
  return { mark: vi.fn(() => 0) };
}

describe("error reporting (FE-CRIT-1)", () => {
  it("describes any thrown value without losing information", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError({ code: 42 })).toBe('{"code":42}');
    // Must still be a string: `JSON.stringify(undefined)` returns `undefined`.
    expect(describeError(undefined)).toBe("Unknown error");
    expect(describeError(null)).toBe("null");
    expect(describeError(0)).toBe("0");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(typeof describeError(circular)).toBe("string");
  });

  it("captures stacks only when the runtime provided one", () => {
    expect(stackOf(new Error("boom"))).toContain("boom");
    expect(stackOf("not an error")).toBeUndefined();
  });

  it("tags each failure kind with its own telemetry event", () => {
    expect(buildReport("render", new Error("x")).event).toBe("LUMA_ERR_RENDER");
    expect(buildReport("window-error", new Error("x")).event).toBe("LUMA_ERR_WINDOW");
    expect(buildReport("unhandled-rejection", new Error("x")).event).toBe(
      "LUMA_ERR_UNHANDLED_REJECTION"
    );
    expect(buildReport("render", new Error("x"), "at <ReaderView>").componentStack).toBe(
      "at <ReaderView>"
    );
  });

  it("logs and records to telemetry through one sink", () => {
    const telemetry = fakeTelemetry();
    const logger = { error: vi.fn() };
    const sink = createErrorSink(logger, telemetry as never);

    sink(buildReport("render", new Error("kaboom")));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toContain("LUMA_ERR_RENDER");
    expect(telemetry.mark).toHaveBeenCalledWith("LUMA_ERR_RENDER", expect.objectContaining({
      message: "kaboom",
    }));
  });

  it("installs and removes window listeners for async failures", () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const windowStub = {
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners.set(type, handler);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    };
    Object.defineProperty(globalThis, "window", { value: windowStub, configurable: true });

    try {
      const reports: string[] = [];
      const sink: ErrorSink = (report) => reports.push(report.event);

      const dispose = installGlobalErrorHandlers(sink);
      listeners.get("error")?.({ error: new Error("window blew up") });
      listeners.get("unhandledrejection")?.({ reason: new Error("promise rejected") });

      expect(reports).toEqual(["LUMA_ERR_WINDOW", "LUMA_ERR_UNHANDLED_REJECTION"]);

      dispose();
      expect(listeners.size).toBe(0);
    } finally {
      Reflect.deleteProperty(globalThis as object, "window");
    }
  });

  it("is a no-op outside a browser (SSR / test runner safety)", () => {
    expect(() => installGlobalErrorHandlers(() => {})()).not.toThrow();
  });

  it("exports a default sink that never throws on odd payloads", () => {
    expect(() => reportError(buildReport("window-error", { weird: true }))).not.toThrow();
  });
});
