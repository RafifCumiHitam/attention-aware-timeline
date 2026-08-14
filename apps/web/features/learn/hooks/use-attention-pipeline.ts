"use client";

/**
 * Core Attention Pipeline
 *
 * Responsibilities:
 * - Uses the same session_id as the learning session store.
 * - Receives face landmark results from FaceTracker.
 * - Calculates the current attention score.
 * - Sends realtime telemetry through WebSocket.
 * - Persists attention samples through EventService -> FastAPI.
 * - Keeps video timestamp synchronized with the session store.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeWebsocket } from "@/hooks/use-realtime-websocket";
import { useSessionStore } from "@/stores/session-store";
import {
  attentionScoreFromFace,
  type FaceLandmarkResult,
} from "@/features/attention";
import { getEventService } from "../services/event-service";
import type {
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "../types/video-player";

/**
 * Returns whether the current video section is considered difficult.
 *
 * Current MVP rule:
 * - 0-39%   -> normal
 * - 40-80%  -> difficult
 * - 81-100% -> normal
 */
export function isDifficultSection(progressPercent: number): boolean {
  return progressPercent >= 40 && progressPercent <= 80;
}

export interface UseAttentionPipelineOptions {
  /** Prefer session from useSessionLifecycle / store */
  sessionId?: string | null;

  /** Current video UUID */
  videoId?: string;

  /** Minimum interval between telemetry samples */
  telemetryIntervalMs?: number;

  /** Automatically connect realtime WebSocket */
  autoConnect?: boolean;
}

export function useAttentionPipeline(
  options: UseAttentionPipelineOptions = {}
) {
  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  const storeSessionId = useSessionStore((s) => s.sessionId);
  const storeWritable = useSessionStore((s) => s.isWritable);
  const setLastVideoTimestamp = useSessionStore(
    (s) => s.setLastVideoTimestamp
  );

  /**
   * Prefer the session supplied by useSessionLifecycle.
   *
   * Fallback to the Zustand session store.
   *
   * The UUID fallback is only for local/offline operation.
   */
  const sessionId =
    options.sessionId ||
    storeSessionId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}`);

  /**
   * Prefer explicitly supplied video ID.
   * Otherwise use the current video ID from the session store.
   */
  const videoId =
    options.videoId ??
    useSessionStore.getState().videoId ??
    "vid-building-focus-metrics";

  const telemetryIntervalMs = options.telemetryIntervalMs ?? 1000;

  // ---------------------------------------------------------------------------
  // Local attention state
  // ---------------------------------------------------------------------------

  const [localAttention, setLocalAttention] = useState(0.75);

  /**
   * Latest face result.
   *
   * This is intentionally stored in a ref because face tracking can run
   * much faster than React state updates.
   */
  const faceRef = useRef<FaceLandmarkResult | null>(null);

  /**
   * Last time telemetry was emitted.
   *
   * Prevents TIME_UPDATE events from generating excessive samples.
   */
  const lastTelemetryAt = useRef(0);

  /**
   * Latest known video duration.
   */
  const lastDuration = useRef(0);

  // ---------------------------------------------------------------------------
  // Event service context
  // ---------------------------------------------------------------------------

  /**
   * Keep EventService synchronized with the active learning session.
   *
   * This guarantees that ATTENTION_SAMPLE events contain the same:
   *
   * session_id
   * video_id
   */
  useEffect(() => {
    getEventService().setContext({
      sessionId,
      videoId,
    });
  }, [sessionId, videoId]);

  // ---------------------------------------------------------------------------
  // Realtime WebSocket
  // ---------------------------------------------------------------------------

  const {
    connectionStatus,
    lastPingMs,
    playbackRate,
    adaptiveAction,
    adaptiveReason,
    sendTelemetry,
    connect,
    disconnect,
    attentionScore: storeAttention,
  } = useRealtimeWebsocket({
    sessionId,
    videoId,
    autoConnect: options.autoConnect ?? true,
  });

  // ---------------------------------------------------------------------------
  // Face result
  // ---------------------------------------------------------------------------

  /**
   * Called by FaceTrackerLazy whenever a new face landmark result is available.
   *
   * IMPORTANT:
   *
   * This function does NOT directly write to the database.
   *
   * It only stores the latest face result and updates the local attention UI.
   *
   * Persistence happens inside emitTelemetry(), which is throttled by
   * telemetryIntervalMs.
   */
  const onFaceResult = useCallback((result: FaceLandmarkResult) => {
    faceRef.current = result;

    const attention = attentionScoreFromFace(result);

    setLocalAttention(attention);
  }, []);

  // ---------------------------------------------------------------------------
  // Telemetry
  // ---------------------------------------------------------------------------

  /**
   * Emit one attention telemetry sample.
   *
   * There are TWO destinations:
   *
   * 1. WebSocket
   *    -> realtime attention/adaptive learning
   *
   * 2. EventService
   *    -> REST /events
   *    -> interaction_events
   *    -> event_type = attention_sample
   *
   * This dual-write is intentional.
   */
  const emitTelemetry = useCallback(
    (args: {
      eventType: string;
      progressSeconds: number;
      progressPercent: number;
      seekDeltaSeconds?: number;
    }) => {
      const store = useSessionStore.getState();

      // -----------------------------------------------------------------------
      // Session guard
      // -----------------------------------------------------------------------
      //
      // Do not write telemetry if the learning session is closed.
      //
      if (!store.canWrite()) {
        return;
      }

      // -----------------------------------------------------------------------
      // Calculate attention
      // -----------------------------------------------------------------------

      const face = faceRef.current;

      const attention = face
        ? attentionScoreFromFace(face)
        : localAttention;

      setLocalAttention(attention);

      // Keep session's last video timestamp synchronized.
      setLastVideoTimestamp(args.progressSeconds);

      const difficultSection = isDifficultSection(
        args.progressPercent
      );

      // -----------------------------------------------------------------------
      // 1. REALTIME WEBSOCKET TELEMETRY
      // -----------------------------------------------------------------------

      sendTelemetry({
        progressSeconds: args.progressSeconds,
        progressPercent: args.progressPercent,

        attentionScore: attention,

        currentEmotion: "neutral",

        gazeX: face?.gaze.x ?? null,
        gazeY: face?.gaze.y ?? null,

        eventType: args.eventType,

        wallClockMs: Date.now(),

        seekDeltaSeconds:
          args.seekDeltaSeconds ?? null,

        isDifficultSection: difficultSection,
      });

      // -----------------------------------------------------------------------
      // 2. PERSIST ATTENTION SAMPLE
      // -----------------------------------------------------------------------
      //
      // EventService maps:
      //
      // ATTENTION_SAMPLE
      //       ↓
      // attention_sample
      //
      // and sends it to:
      //
      // POST /events
      //
      // which is stored in:
      //
      // interaction_events
      //

      getEventService().log("ATTENTION_SAMPLE", {
        currentTime: args.progressSeconds,

        playbackSpeed: 1,

        buffer: 0,

        fullscreen: false,

        attentionScore: attention,

        sessionId,

        videoId,

        meta: {
          source: "attention_pipeline",

          eventType: args.eventType,

          progressPercent: args.progressPercent,

          gazeX: face?.gaze.x ?? null,

          gazeY: face?.gaze.y ?? null,

          currentEmotion: "neutral",

          seekDeltaSeconds:
            args.seekDeltaSeconds ?? null,

          isDifficultSection: difficultSection,
        },
      });

      /**
       * IMPORTANT:
       *
       * We intentionally do NOT call:
       *
       * getEventService().flush()
       *
       * here.
       *
       * EventService already handles:
       * - debounce
       * - batching
       * - retry
       * - offline queue
       * - periodic flush
       *
       * This prevents one HTTP request every second.
       */
    },
    [
      localAttention,
      sendTelemetry,
      setLastVideoTimestamp,
      sessionId,
      videoId,
    ]
  );

  // ---------------------------------------------------------------------------
  // Player events
  // ---------------------------------------------------------------------------

  const onPlayerEvent = useCallback(
    (
      type: VideoPlayerEventType,
      payload: VideoPlayerEventPayload[VideoPlayerEventType],
      meta: VideoPlayerEventMeta
    ) => {
      const videoTime = meta.currentTime;

      // Keep session timestamp synchronized.
      setLastVideoTimestamp(videoTime);

      // -----------------------------------------------------------------------
      // TIME_UPDATE
      // -----------------------------------------------------------------------

      if (type === "TIME_UPDATE") {
        const p = payload as VideoPlayerEventPayload["TIME_UPDATE"];

        lastDuration.current = p.duration;

        const now = Date.now();

        /**
         * Throttle telemetry.
         *
         * Example:
         *
         * VideoPlayer:
         *   TIME_UPDATE ~ several times per second
         *
         * Pipeline:
         *   ATTENTION_SAMPLE ~ once per second
         */
        if (now - lastTelemetryAt.current < telemetryIntervalMs) {
          return;
        }

        lastTelemetryAt.current = now;

        emitTelemetry({
          eventType: "TIME_UPDATE",

          progressSeconds: p.currentTime,

          progressPercent: p.progress,
        });

        return;
      }

      // -----------------------------------------------------------------------
      // SEEK_FORWARD
      // -----------------------------------------------------------------------

      if (type === "SEEK_FORWARD") {
        const p =
          payload as VideoPlayerEventPayload["SEEK_FORWARD"];

        const duration = lastDuration.current || 1;

        emitTelemetry({
          eventType: "SEEK_FORWARD",

          progressSeconds: p.to,

          progressPercent: Math.min(
            100,
            (p.to / duration) * 100
          ),

          seekDeltaSeconds: p.delta,
        });

        return;
      }

      // -----------------------------------------------------------------------
      // SEEK_BACKWARD
      // -----------------------------------------------------------------------

      if (type === "SEEK_BACKWARD") {
        const p =
          payload as VideoPlayerEventPayload["SEEK_BACKWARD"];

        const duration = lastDuration.current || 1;

        emitTelemetry({
          eventType: "SEEK_BACKWARD",

          progressSeconds: p.to,

          progressPercent: Math.min(
            100,
            (p.to / duration) * 100
          ),

          seekDeltaSeconds: -p.delta,
        });

        return;
      }

      // -----------------------------------------------------------------------
      // PLAY / PAUSE / SPEED_CHANGE / VIDEO_END
      // -----------------------------------------------------------------------

      if (
        type === "PLAY" ||
        type === "PAUSE" ||
        type === "SPEED_CHANGE" ||
        type === "VIDEO_END"
      ) {
        const duration = lastDuration.current || 1;

        emitTelemetry({
          eventType: type,

          progressSeconds: videoTime,

          progressPercent: Math.min(
            100,
            (videoTime / duration) * 100
          ),
        });
      }
    },
    [
      emitTelemetry,
      telemetryIntervalMs,
      setLastVideoTimestamp,
    ]
  );

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    /**
     * Current learning session UUID.
     */
    sessionId,

    /**
     * Current video UUID.
     */
    videoId,

    /**
     * Whether the current session can accept writes.
     */
    isWritable: storeWritable,

    /**
     * Current locally calculated attention score.
     */
    attentionScore: localAttention,

    /**
     * Attention score received from realtime WebSocket.
     */
    storeAttention,

    /**
     * Adaptive playback rate determined by realtime service.
     */
    adaptivePlaybackRate: playbackRate,

    /**
     * Current adaptive action.
     */
    adaptiveAction,

    /**
     * Explanation for the adaptive decision.
     */
    adaptiveReason,

    /**
     * WebSocket connection state.
     */
    connectionStatus,

    /**
     * WebSocket latency.
     */
    lastPingMs,

    /**
     * Face tracker callback.
     */
    onFaceResult,

    /**
     * Video player event callback.
     */
    onPlayerEvent,

    /**
     * Manually connect WebSocket.
     */
    connect,

    /**
     * Disconnect WebSocket.
     */
    disconnect,

    /**
     * Manually send realtime telemetry.
     */
    sendTelemetry,
  };
}