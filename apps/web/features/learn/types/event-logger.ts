/**
 * Event Logger types — learning interaction telemetry
 */

/** Frontend player / interaction event names */
export type LoggerEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK_FORWARD"
  | "SEEK_BACKWARD"
  | "SPEED_CHANGE"
  | "VIDEO_END"
  | "VOLUME_CHANGE"
  | "FULLSCREEN_CHANGE"
  | "SUBTITLE_CHANGE"
  | "TIME_UPDATE"
  | "ATTENTION_SAMPLE"
  | "FOCUS_LOST"
  | "FOCUS_REGAINED"
  | "CUSTOM";

/** Backend EventType values (FastAPI) */
export type BackendEventType =
  | "play"
  | "pause"
  | "seek"
  | "complete"
  | "attention_sample"
  | "gaze_sample"
  | "focus_lost"
  | "focus_regained"
  | "quiz_answer"
  | "note"
  | "rate"
  | "custom";

/**
 * Full captured snapshot for every logged event.
 */
export interface EventSnapshot {
  /** Client-side UUID for dedup / offline queue */
  id: string;
  /** ISO-8601 client timestamp */
  timestamp: string;
  /** Player event name */
  eventType: LoggerEventType;
  /** Video currentTime (seconds) */
  currentTime: number;
  /** Playback rate e.g. 1, 1.5 */
  playbackSpeed: number;
  /** Buffered percentage 0–100 */
  buffer: number;
  /** Whether player is fullscreen */
  fullscreen: boolean;
  /** Optional volume 0–1 */
  volume?: number;
  /** Optional muted flag */
  muted?: boolean;
  /** Optional attention score 0–100 */
  attentionScore?: number | null;
  /** Session / video context */
  sessionId?: string | null;
  videoId?: string | null;
  videoSrc?: string;
  /** Extra payload */
  meta?: Record<string, unknown>;
  /** Retry bookkeeping */
  attempts?: number;
  lastError?: string;
}

/** Payload accepted by FastAPI POST /events and /events/batch */
export interface BackendEventPayload {
  event_type: BackendEventType;
  session_id?: string | null;
  video_id?: string | null;
  video_timestamp?: number | null;
  attention_score?: number | null;
  gaze_x?: number | null;
  gaze_y?: number | null;
  payload?: Record<string, unknown> | null;
}

export interface EventLoggerConfig {
  /** Debounce window for batching (ms). Default 800 */
  debounceMs?: number;
  /** Max events per batch request. Default 50 */
  maxBatchSize?: number;
  /** Max retry attempts. Default 5 */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms). Default 1000 */
  retryBaseDelayMs?: number;
  /** localStorage key for offline queue */
  storageKey?: string;
  /** Flush interval while online (ms). Default 5000 */
  flushIntervalMs?: number;
  /** Whether to log TIME_UPDATE (high frequency). Default false */
  captureTimeUpdate?: boolean;
  /** Default session / video context */
  sessionId?: string | null;
  videoId?: string | null;
}

export interface EventLoggerStatus {
  queueLength: number;
  isOnline: boolean;
  isFlushing: boolean;
  lastFlushAt: number | null;
  lastError: string | null;
}

export type EventLoggerListener = (status: EventLoggerStatus) => void;
