/**
 * LUMA Performance Telemetry & Monotonic Metric Collector (PERF-05)
 * Provides precise high-resolution timestamps for live WebView2 / browser user-paths.
 */

export interface PerfEventRecord {
  event: string;
  timestamp: number;
  elapsedSinceStartMs: number;
  metadata?: Record<string, unknown>;
}

class PerfTelemetryCollector {
  private eventLog: PerfEventRecord[] = [];
  private appStartTime: number = performance.now();

  constructor() {
    this.mark("LUMA_PERF_APP_START", { source: "window.performance.now" });
    if (typeof window !== "undefined") {
      (window as unknown as { __LUMA_PERF_TELEMETRY__: PerfTelemetryCollector }).__LUMA_PERF_TELEMETRY__ = this;
    }
  }

  public mark(event: string, metadata?: Record<string, unknown>): number {
    const now = performance.now();
    const elapsed = now - this.appStartTime;
    const record: PerfEventRecord = {
      event,
      timestamp: now,
      elapsedSinceStartMs: elapsed,
      metadata,
    };
    this.eventLog.push(record);

    if (process.env.NODE_ENV === "development") {
      console.debug(`[LUMA_PERF] ${event} @ +${elapsed.toFixed(2)}ms`, metadata || "");
    }
    return now;
  }

  public measure(startEvent: string, endEvent: string): number | null {
    const startRecord = this.eventLog.slice().reverse().find((r) => r.event === startEvent);
    const endRecord = this.eventLog.slice().reverse().find((r) => r.event === endEvent);
    if (!startRecord || !endRecord) return null;
    return endRecord.timestamp - startRecord.timestamp;
  }

  public getEvents(): PerfEventRecord[] {
    return [...this.eventLog];
  }

  public getEventsByName(name: string): PerfEventRecord[] {
    return this.eventLog.filter((r) => r.event === name);
  }

  public clear(): void {
    this.eventLog = [];
  }
}

export const perfTelemetry = new PerfTelemetryCollector();
