/**
 * LUMA Performance Telemetry & Monotonic Metric Collector (PERF-05)
 * Provides precise high-resolution timestamps for live WebView2 / browser user-paths.
 */

// ------------------------------------------------------------------
// Types & Configuration
// ------------------------------------------------------------------

export type PerfMetadata = Record<string, unknown>;

export interface PerfEventRecord<T extends PerfMetadata = PerfMetadata> {
  event: string;
  timestamp: number;
  elapsedSinceStartMs: number;
  metadata?: T;
}

export interface PerfTelemetryConfig {
  /** The event name used for the initial app start mark. */
  appStartEventName?: string;
  /** Maximum number of events to keep (oldest are trimmed). */
  maxEvents?: number;
  /** Minimum log level: 'debug', 'info', 'warn', 'error', 'none'. */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  /** If true, also calls `performance.mark()` for each event. */
  usePerformanceMark?: boolean;
  /** If true, also calls `performance.measure()` for matching start/end events. */
  usePerformanceMeasure?: boolean;
}

// ------------------------------------------------------------------
// Default Configuration
// ------------------------------------------------------------------

const DEFAULT_CONFIG: Required<PerfTelemetryConfig> = {
  appStartEventName: 'LUMA_PERF_APP_START',
  maxEvents: 1000,
  logLevel: 'debug',
  usePerformanceMark: false,
  usePerformanceMeasure: false,
};

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };

// ------------------------------------------------------------------
// Main Collector Class
// ------------------------------------------------------------------

export class PerfTelemetryCollector {
  private static instance: PerfTelemetryCollector | null = null;

  private eventLog: PerfEventRecord[] = [];
  private appStartTime: number;
  private config: Required<PerfTelemetryConfig>;
  private readonly logThreshold: number;

  /**
   * Creates a new collector. Use `PerfTelemetryCollector.getInstance()` for a singleton.
   */
  constructor(config: PerfTelemetryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logThreshold = LOG_LEVELS[this.config.logLevel] ?? 0;
    this.appStartTime = performance.now();

    // Mark the start event
    this.mark(this.config.appStartEventName, { source: 'window.performance.now' });

    // Expose to global for debugging (only in development)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as unknown as { __LUMA_PERF_TELEMETRY__: PerfTelemetryCollector })
        .__LUMA_PERF_TELEMETRY__ = this;
    }
  }

  /**
   * Returns the singleton instance (lazy initialization).
   */
  public static getInstance(config?: PerfTelemetryConfig): PerfTelemetryCollector {
    if (!PerfTelemetryCollector.instance) {
      PerfTelemetryCollector.instance = new PerfTelemetryCollector(config);
    }
    return PerfTelemetryCollector.instance;
  }

  /**
   * Resets the singleton (useful for testing).
   */
  public static resetInstance(): void {
    PerfTelemetryCollector.instance = null;
  }

  /**
   * Records a performance event with a timestamp.
   * @param event - Name of the event.
   * @param metadata - Optional additional data.
   * @returns The current timestamp (DOMHighResTimeStamp).
   */
  public mark<T extends PerfMetadata = PerfMetadata>(
    event: string,
    metadata?: T
  ): number {
    const now = performance.now();
    const elapsed = now - this.appStartTime;

    const record: PerfEventRecord<T> = {
      event,
      timestamp: now,
      elapsedSinceStartMs: elapsed,
      metadata,
    };

    // Append and trim if needed
    this.eventLog.push(record);
    if (this.eventLog.length > this.config.maxEvents) {
      this.eventLog = this.eventLog.slice(-this.config.maxEvents);
    }

    // Log to console if level allows
    if (this.logThreshold <= LOG_LEVELS.debug) {
      console.debug(`[LUMA_PERF] ${event} @ +${elapsed.toFixed(2)}ms`, metadata || '');
    }

    // Optional performance.mark for browser DevTools
    if (this.config.usePerformanceMark && typeof performance.mark === 'function') {
      performance.mark(event);
    }

    return now;
  }

  /**
   * Measures the time between two events.
   * @param startEvent - Name of the start event.
   * @param endEvent - Name of the end event.
   * @returns The duration in milliseconds, or null if either event is not found.
   */
  public measure(startEvent: string, endEvent: string): number | null {
    const startRecord = this.eventLog.slice().reverse().find((r) => r.event === startEvent);
    const endRecord = this.eventLog.slice().reverse().find((r) => r.event === endEvent);
    if (!startRecord || !endRecord) return null;

    const duration = endRecord.timestamp - startRecord.timestamp;

    // Optional performance.measure for browser DevTools
    if (this.config.usePerformanceMeasure && typeof performance.measure === 'function') {
      try {
        performance.measure(`${startEvent} -> ${endEvent}`, startEvent, endEvent);
      } catch {
        // Ignore if performance.mark wasn't called or measure fails
      }
    }

    return duration;
  }

  /**
   * Returns a copy of all recorded events.
   */
  public getEvents(): PerfEventRecord[] {
    return [...this.eventLog];
  }

  /**
   * Returns all events matching the given name.
   */
  public getEventsByName(name: string): PerfEventRecord[] {
    return this.eventLog.filter((r) => r.event === name);
  }

  /**
   * Exports the event log as a JSON string (or object if `raw` is false).
   */
  public export(raw: boolean = true): string | PerfEventRecord[] {
    return raw ? JSON.stringify(this.eventLog) : this.getEvents();
  }

  /**
   * Clears the event log.
   */
  public clear(): void {
    this.eventLog = [];
  }

  /**
   * Flushes the log: calls a callback with the current events, then clears.
   * Useful for periodic sending to a backend.
   */
  public flush(callback?: (events: PerfEventRecord[]) => void): PerfEventRecord[] {
    const snapshot = this.getEvents();
    if (callback) {
      callback(snapshot);
    }
    this.clear();
    return snapshot;
  }

  /**
   * Returns the start time (DOMHighResTimeStamp).
   */
  public getStartTime(): number {
    return this.appStartTime;
  }

  /**
   * Returns the current elapsed time since start.
   */
  public getElapsedMs(): number {
    return performance.now() - this.appStartTime;
  }
}

// ------------------------------------------------------------------
// Default exported singleton instance (backward‑compatible)
// ------------------------------------------------------------------

export const perfTelemetry = PerfTelemetryCollector.getInstance();