/**
 * Event Service — send learning interaction events to FastAPI.
 *
 * Features:
 * - Axios transport
 * - Debounced batching
 * - Offline queue (localStorage)
 * - Exponential backoff retry
 * - Error handling
 */

import apiClient from "@/lib/api-client";
import type {
  BackendEventPayload,
  BackendEventType,
  EventLoggerConfig,
  EventLoggerListener,
  EventLoggerStatus,
  EventSnapshot,
  LoggerEventType,
} from "../types/event-logger";

const DEFAULTS: Required<EventLoggerConfig> = {
  debounceMs: 800,
  maxBatchSize: 50,
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  storageKey: "aat_event_queue",
  flushIntervalMs: 5000,
  captureTimeUpdate: false,
  sessionId: null,
  videoId: null,
};

/** Map frontend event names → FastAPI EventType */
export function mapToBackendType(type: LoggerEventType): BackendEventType {
  switch (type) {
    case "PLAY":
      return "play";
    case "PAUSE":
      return "pause";
    case "SEEK_FORWARD":
    case "SEEK_BACKWARD":
      return "seek";
    case "VIDEO_END":
      return "complete";
    case "ATTENTION_SAMPLE":
      return "attention_sample";
    case "FOCUS_LOST":
      return "focus_lost";
    case "FOCUS_REGAINED":
      return "focus_regained";
    case "SPEED_CHANGE":
    case "VOLUME_CHANGE":
    case "FULLSCREEN_CHANGE":
    case "SUBTITLE_CHANGE":
    case "TIME_UPDATE":
    case "CUSTOM":
    default:
      return "custom";
  }
}

function toBackendPayload(event: EventSnapshot): BackendEventPayload {
  return {
    event_type: mapToBackendType(event.eventType),
    session_id: event.sessionId ?? null,
    video_id: event.videoId ?? null,
    video_timestamp: event.currentTime,
    attention_score: event.attentionScore ?? null,
    payload: {
      client_id: event.id,
      client_timestamp: event.timestamp,
      event_type_raw: event.eventType,
      playback_speed: event.playbackSpeed,
      buffer: event.buffer,
      fullscreen: event.fullscreen,
      volume: event.volume,
      muted: event.muted,
      video_src: event.videoSrc,
      ...(event.meta ?? {}),
    },
  };
}

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export class EventService {
  private config: Required<EventLoggerConfig>;
  private queue: EventSnapshot[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private isOnline = true;
  private lastFlushAt: number | null = null;
  private lastError: string | null = null;
  private listeners = new Set<EventLoggerListener>();

  constructor(config: EventLoggerConfig = {}) {
    this.config = { ...DEFAULTS, ...config };
    if (isBrowser()) {
      this.isOnline = navigator.onLine;
      this.loadQueue();
      this.bindNetwork();
      this.startFlushInterval();
    }
  }

  /** Update session / video context at runtime */
  setContext(ctx: { sessionId?: string | null; videoId?: string | null }) {
    if (ctx.sessionId !== undefined) this.config.sessionId = ctx.sessionId;
    if (ctx.videoId !== undefined) this.config.videoId = ctx.videoId;
  }

  subscribe(listener: EventLoggerListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  getStatus(): EventLoggerStatus {
    return {
      queueLength: this.queue.length,
      isOnline: this.isOnline,
      isFlushing: this.isFlushing,
      lastFlushAt: this.lastFlushAt,
      lastError: this.lastError,
    };
  }

  /**
   * Capture a full event snapshot and enqueue for delivery.
   */
  log(
    eventType: LoggerEventType,
    data: {
      currentTime: number;
      playbackSpeed: number;
      buffer: number;
      fullscreen: boolean;
      volume?: number;
      muted?: boolean;
      attentionScore?: number | null;
      videoSrc?: string;
      meta?: Record<string, unknown>;
      sessionId?: string | null;
      videoId?: string | null;
    }
  ): EventSnapshot {
    if (eventType === "TIME_UPDATE" && !this.config.captureTimeUpdate) {
      // Still return a snapshot for local UI, but don't queue
      return {
        id: uid(),
        timestamp: new Date().toISOString(),
        eventType,
        currentTime: data.currentTime,
        playbackSpeed: data.playbackSpeed,
        buffer: data.buffer,
        fullscreen: data.fullscreen,
        volume: data.volume,
        muted: data.muted,
        attentionScore: data.attentionScore,
        sessionId: data.sessionId ?? this.config.sessionId,
        videoId: data.videoId ?? this.config.videoId,
        videoSrc: data.videoSrc,
        meta: data.meta,
        attempts: 0,
      };
    }

    const snapshot: EventSnapshot = {
      id: uid(),
      timestamp: new Date().toISOString(),
      eventType,
      currentTime: data.currentTime,
      playbackSpeed: data.playbackSpeed,
      buffer: data.buffer,
      fullscreen: data.fullscreen,
      volume: data.volume,
      muted: data.muted,
      attentionScore: data.attentionScore,
      sessionId: data.sessionId ?? this.config.sessionId,
      videoId: data.videoId ?? this.config.videoId,
      videoSrc: data.videoSrc,
      meta: data.meta,
      attempts: 0,
    };

    this.enqueue(snapshot);
    this.scheduleDebouncedFlush();
    return snapshot;
  }

  /** Force flush immediately (e.g. on VIDEO_END or page hide) */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.flushQueue();
  }

  /** Clear offline queue (dev / logout) */
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
    this.notify();
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (isBrowser()) {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    this.listeners.clear();
  }

  // ─── internals ───────────────────────────────────────────────

  private enqueue(event: EventSnapshot) {
    this.queue.push(event);
    this.persistQueue();
    this.notify();
  }

  private scheduleDebouncedFlush() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.flushQueue();
    }, this.config.debounceMs);
  }

  private async flushQueue(): Promise<void> {
    if (this.isFlushing || !this.isOnline || this.queue.length === 0) return;
    this.isFlushing = true;
    this.notify();

    const batch = this.queue.slice(0, this.config.maxBatchSize);
    const payloads = batch.map(toBackendPayload);

    try {
      if (batch.length === 1) {
        await apiClient.post("/events", payloads[0]);
      } else {
        await apiClient.post("/events/batch", { events: payloads });
      }

      // Remove successfully sent events
      const sentIds = new Set(batch.map((e) => e.id));
      this.queue = this.queue.filter((e) => !sentIds.has(e.id));
      this.persistQueue();
      this.lastFlushAt = Date.now();
      this.lastError = null;
    } catch (err) {
      const message = this.extractError(err);
      this.lastError = message;

      // Increment attempts; drop if max retries exceeded
      const surviving: EventSnapshot[] = [];
      for (const e of this.queue) {
        const inBatch = batch.some((b) => b.id === e.id);
        if (!inBatch) {
          surviving.push(e);
          continue;
        }
        const attempts = (e.attempts ?? 0) + 1;
        if (attempts >= this.config.maxRetries) {
          console.warn("[EventService] dropping event after max retries", e.id, message);
          continue;
        }
        surviving.push({ ...e, attempts, lastError: message });
      }
      this.queue = surviving;
      this.persistQueue();

      // Schedule retry with exponential backoff
      const maxAttempts = Math.max(...batch.map((e) => e.attempts ?? 0), 0);
      const delay = this.config.retryBaseDelayMs * Math.pow(2, maxAttempts);
      setTimeout(() => {
        void this.flushQueue();
      }, Math.min(delay, 30_000));
    } finally {
      this.isFlushing = false;
      this.notify();
    }
  }

  private extractError(err: unknown): string {
    if (err && typeof err === "object" && "isAxiosError" in err) {
      const ax = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      const detail = ax.response?.data?.detail;
      if (typeof detail === "string") return detail;
      if (ax.response?.status) return `HTTP ${ax.response.status}`;
      return ax.message ?? "Network error";
    }
    if (err instanceof Error) return err.message;
    return "Unknown error";
  }

  private persistQueue() {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.queue));
    } catch {
      // Quota exceeded — keep in-memory only
    }
  }

  private loadQueue() {
    if (!isBrowser()) return;
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as EventSnapshot[];
      if (Array.isArray(parsed)) {
        this.queue = parsed;
      }
    } catch {
      this.queue = [];
    }
  }

  private startFlushInterval() {
    this.flushTimer = setInterval(() => {
      void this.flushQueue();
    }, this.config.flushIntervalMs);
  }

  private onOnline = () => {
    this.isOnline = true;
    this.notify();
    void this.flushQueue();
  };

  private onOffline = () => {
    this.isOnline = false;
    this.notify();
  };

  private onVisibility = () => {
    if (document.visibilityState === "hidden") {
      void this.flush();
    }
  };

  private bindNetwork() {
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }
}

/** Singleton for the learning app */
let sharedInstance: EventService | null = null;

export function getEventService(config?: EventLoggerConfig): EventService {
  if (!sharedInstance) {
    sharedInstance = new EventService(config);
  } else if (config) {
    if (config.sessionId !== undefined || config.videoId !== undefined) {
      sharedInstance.setContext({
        sessionId: config.sessionId,
        videoId: config.videoId,
      });
    }
  }
  return sharedInstance;
}

export function resetEventService(): void {
  sharedInstance?.destroy();
  sharedInstance = null;
}
