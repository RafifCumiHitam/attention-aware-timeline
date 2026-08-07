"use client";

/**
 * Core Attention Pipeline orchestrator (client).
 *
 * Camera → Face Landmarker → attentionScoreFromFace
 *   → session-bound telemetry → WebSocket
 *   → adaptive playbackRate → VideoPlayer
 *
 * Reuses: useRealtimeWebsocket, attentionScoreFromFace, event types.
 * Does not replace face engine, event logger, or WS client.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRealtimeWebsocket } from "@/hooks/use-realtime-websocket";
import {
  attentionScoreFromFace,
  type FaceLandmarkResult,
} from "@/features/attention";
import type {
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "../types/video-player";

/** Demo heuristic: middle band of the video is treated as "difficult". */
export function isDifficultSection(progressPercent: number): boolean {
  return progressPercent >= 40 && progressPercent <= 80;
}

export interface UseAttentionPipelineOptions {
  sessionId?: string;
  videoId?: string;
  /** Min interval between TIME_UPDATE telemetry (ms) */
  telemetryIntervalMs?: number;
  autoConnect?: boolean;
}

export function useAttentionPipeline(options: UseAttentionPipelineOptions = {}) {
  const sessionId = useMemo(
    () =>
      options.sessionId ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}`),
    [options.sessionId]
  );
  const videoId = options.videoId ?? "vid-building-focus-metrics";
  const telemetryIntervalMs = options.telemetryIntervalMs ?? 1000;

  const [localAttention, setLocalAttention] = useState(0.75);
  const faceRef = useRef<FaceLandmarkResult | null>(null);
  const lastTelemetryAt = useRef(0);
  const lastVideoTime = useRef(0);
  const lastDuration = useRef(0);

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

  const onFaceResult = useCallback((r: FaceLandmarkResult) => {
    faceRef.current = r;
    const score = attentionScoreFromFace(r);
    setLocalAttention(score);
  }, []);

  const emitTelemetry = useCallback(
    (args: {
      eventType: string;
      progressSeconds: number;
      progressPercent: number;
      seekDeltaSeconds?: number;
    }) => {
      const face = faceRef.current;
      const attention = face ? attentionScoreFromFace(face) : localAttention;
      setLocalAttention(attention);

      sendTelemetry({
        progressSeconds: args.progressSeconds,
        progressPercent: args.progressPercent,
        attentionScore: attention,
        currentEmotion: "neutral", // heuristic only — no DL emotion yet
        gazeX: face?.gaze.x ?? null,
        gazeY: face?.gaze.y ?? null,
        eventType: args.eventType,
        wallClockMs: Date.now(),
        seekDeltaSeconds: args.seekDeltaSeconds ?? null,
        isDifficultSection: isDifficultSection(args.progressPercent),
      });
    },
    [localAttention, sendTelemetry]
  );

  const onPlayerEvent = useCallback(
    (
      type: VideoPlayerEventType,
      payload: VideoPlayerEventPayload[VideoPlayerEventType],
      meta: VideoPlayerEventMeta
    ) => {
      const videoTime = meta.currentTime;
      lastVideoTime.current = videoTime;

      if (type === "TIME_UPDATE") {
        const p = payload as VideoPlayerEventPayload["TIME_UPDATE"];
        lastDuration.current = p.duration;
        const now = Date.now();
        if (now - lastTelemetryAt.current < telemetryIntervalMs) return;
        lastTelemetryAt.current = now;
        emitTelemetry({
          eventType: "TIME_UPDATE",
          progressSeconds: p.currentTime,
          progressPercent: p.progress,
        });
        return;
      }

      if (type === "SEEK_FORWARD") {
        const p = payload as VideoPlayerEventPayload["SEEK_FORWARD"];
        const duration = lastDuration.current || 1;
        const progressPercent = Math.min(100, (p.to / duration) * 100);
        emitTelemetry({
          eventType: "SEEK_FORWARD",
          progressSeconds: p.to,
          progressPercent,
          seekDeltaSeconds: p.delta,
        });
        return;
      }

      if (type === "SEEK_BACKWARD") {
        const p = payload as VideoPlayerEventPayload["SEEK_BACKWARD"];
        const duration = lastDuration.current || 1;
        const progressPercent = Math.min(100, (p.to / duration) * 100);
        emitTelemetry({
          eventType: "SEEK_BACKWARD",
          progressSeconds: p.to,
          progressPercent,
          seekDeltaSeconds: -p.delta,
        });
        return;
      }

      // PLAY / PAUSE / SPEED_CHANGE / VIDEO_END — still session-bound samples
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
          progressPercent: Math.min(100, (videoTime / duration) * 100),
        });
      }
    },
    [emitTelemetry, telemetryIntervalMs]
  );

  return {
    sessionId,
    videoId,
    /** Live face-derived score (local) */
    attentionScore: localAttention,
    /** Store score after last telemetry ack path */
    storeAttention,
    /** Adaptive rate from FastAPI engine — bind to VideoPlayer.externalPlaybackRate */
    adaptivePlaybackRate: playbackRate,
    adaptiveAction,
    adaptiveReason,
    connectionStatus,
    lastPingMs,
    onFaceResult,
    onPlayerEvent,
    connect,
    disconnect,
    sendTelemetry,
  };
}
