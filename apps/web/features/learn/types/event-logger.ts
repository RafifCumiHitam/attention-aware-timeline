/**
 * Event Logger types — learning interaction telemetry
 */

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

export type BackendEventType =
  | "play"
  | "pause"
  | "seek"
  | "seek_forward"
  | "seek_backward"
  | "speed_change"
  | "complete"
  | "attention_sample"
  | "gaze_sample"
  | "adaptive_decision"
  | "focus_lost"
  | "focus_regained"
  | "tab_hidden"
  | "tab_visible"
  | "camera_denied"
  | "quiz_answer"
  | "note"
  | "rate"
  | "custom";

export interface EventSnapshot {
  id: string;
  /** ISO-8601 client wall-clock timestamp */
  timestamp: string;
  eventType: LoggerEventType;
  /** Video timeline position (seconds) */
  currentTime: number;
  playbackSpeed: number;
  buffer: number;
  fullscreen: boolean;
  volume?: number;
  muted?: boolean;
  attentionScore?: number | null;
  sessionId?: string | null;
  videoId?: string | null;
  videoSrc?: string;
  meta?: Record<string, unknown>;
  attempts?: number;
  lastError?: string;
}

export interface BackendEventPayload {
  event_type: BackendEventType;
  session_id?: string | null;
  video_id?: string | null;
  video_timestamp?: number | null;
  client_timestamp?: string | null;
  attention_score?: number | null;
  gaze_x?: number | null;
  gaze_y?: number | null;
  payload?: Record<string, unknown> | null;
}

export interface EventLoggerConfig {
  debounceMs?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  storageKey?: string;
  flushIntervalMs?: number;
  captureTimeUpdate?: boolean;
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
