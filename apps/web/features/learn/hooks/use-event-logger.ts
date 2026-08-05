"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EventService,
  getEventService,
} from "../services/event-service";
import type {
  EventLoggerConfig,
  EventLoggerStatus,
  EventSnapshot,
  LoggerEventType,
} from "../types/event-logger";
import type {
  VideoPlayerEventHandler,
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "../types/video-player";

export interface UseEventLoggerOptions extends EventLoggerConfig {
  /** Optional attention score provider */
  getAttentionScore?: () => number | null | undefined;
}

export interface UseEventLoggerReturn {
  /** Log a raw event with full snapshot fields */
  log: (
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
    }
  ) => EventSnapshot;
  /** Ready-to-pass VideoPlayer onEvent handler */
  onPlayerEvent: VideoPlayerEventHandler;
  /** Force flush queue to API */
  flush: () => Promise<void>;
  /** Queue / network status */
  status: EventLoggerStatus;
  /** Underlying service instance */
  service: EventService;
}

/**
 * React hook wrapping EventService.
 * Provides debounce, offline queue, retry via the service,
 * and a VideoPlayer-compatible onEvent callback.
 */
export function useEventLogger(options: UseEventLoggerOptions = {}): UseEventLoggerReturn {
  const {
    getAttentionScore,
    sessionId,
    videoId,
    debounceMs,
    maxBatchSize,
    maxRetries,
    retryBaseDelayMs,
    storageKey,
    flushIntervalMs,
    captureTimeUpdate,
  } = options;

  const service = useMemo(
    () =>
      getEventService({
        sessionId,
        videoId,
        debounceMs,
        maxBatchSize,
        maxRetries,
        retryBaseDelayMs,
        storageKey,
        flushIntervalMs,
        captureTimeUpdate,
      }),
    // Only recreate when storage key changes; context updates via setContext
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  );

  useEffect(() => {
    service.setContext({ sessionId, videoId });
  }, [service, sessionId, videoId]);

  const [status, setStatus] = useState<EventLoggerStatus>(() => service.getStatus());

  useEffect(() => {
    return service.subscribe(setStatus);
  }, [service]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      void service.flush();
    };
  }, [service]);

  const attentionRef = useRef(getAttentionScore);
  attentionRef.current = getAttentionScore;

  const log = useCallback(
    (
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
      }
    ) => {
      const attention =
        data.attentionScore !== undefined
          ? data.attentionScore
          : attentionRef.current?.() ?? null;

      return service.log(eventType, {
        ...data,
        attentionScore: attention,
      });
    },
    [service]
  );

  /**
   * Maps VideoPlayer events → EventService.log with full snapshot.
   * Player does not always pass buffer/fullscreen; we read from meta + defaults.
   */
  const onPlayerEvent: VideoPlayerEventHandler = useCallback(
    (type: VideoPlayerEventType, payload: VideoPlayerEventPayload[VideoPlayerEventType], meta: VideoPlayerEventMeta) => {
      let currentTime = meta.currentTime ?? 0;
      let buffer = meta.buffer ?? 0;
      let fullscreen = meta.fullscreen ?? false;
      let volume: number | undefined = meta.volume;
      let muted: boolean | undefined = meta.muted;
      const extra: Record<string, unknown> = {};

      switch (type) {
        case "PLAY":
        case "PAUSE":
          currentTime = (payload as VideoPlayerEventPayload["PLAY"]).currentTime;
          break;
        case "SEEK_FORWARD":
        case "SEEK_BACKWARD": {
          const p = payload as VideoPlayerEventPayload["SEEK_FORWARD"];
          currentTime = p.to;
          extra.from = p.from;
          extra.to = p.to;
          extra.delta = p.delta;
          break;
        }
        case "SPEED_CHANGE": {
          const p = payload as VideoPlayerEventPayload["SPEED_CHANGE"];
          extra.from = p.from;
          extra.to = p.to;
          break;
        }
        case "VIDEO_END":
          currentTime = (payload as VideoPlayerEventPayload["VIDEO_END"]).duration;
          break;
        case "VOLUME_CHANGE": {
          const p = payload as VideoPlayerEventPayload["VOLUME_CHANGE"];
          volume = p.volume;
          muted = p.muted;
          break;
        }
        case "FULLSCREEN_CHANGE":
          fullscreen = (payload as VideoPlayerEventPayload["FULLSCREEN_CHANGE"]).isFullscreen;
          extra.isFullscreen = fullscreen;
          break;
        case "TIME_UPDATE": {
          const p = payload as VideoPlayerEventPayload["TIME_UPDATE"];
          currentTime = p.currentTime;
          extra.duration = p.duration;
          extra.progress = p.progress;
          break;
        }
        case "SUBTITLE_CHANGE": {
          const p = payload as VideoPlayerEventPayload["SUBTITLE_CHANGE"];
          extra.trackIndex = p.trackIndex;
          extra.label = p.label;
          break;
        }
      }

      log(type as LoggerEventType, {
        currentTime,
        playbackSpeed: meta.playbackRate,
        buffer,
        fullscreen,
        volume,
        muted,
        videoSrc: meta.videoSrc,
        meta: extra,
      });
    },
    [log]
  );

  const flush = useCallback(() => service.flush(), [service]);

  return {
    log,
    onPlayerEvent,
    flush,
    status,
    service,
  };
}
