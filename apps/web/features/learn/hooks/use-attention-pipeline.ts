"use client";

/**
 * Core Attention Pipeline — one WebSocket owner via useRealtimeWebsocket.
 * Does NOT invent client session UUIDs for the realtime channel.
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

export function isDifficultSection(progressPercent: number): boolean {
  return progressPercent >= 40 && progressPercent <= 80;
}

export interface UseAttentionPipelineOptions {
  sessionId?: string | null;
  videoId?: string;
  telemetryIntervalMs?: number;
  autoConnect?: boolean;
}

export function useAttentionPipeline(options: UseAttentionPipelineOptions = {}) {
  const storeSessionId = useSessionStore((s) => s.sessionId);
  const storeWritable = useSessionStore((s) => s.isWritable);
  const setLastVideoTimestamp = useSessionStore((s) => s.setLastVideoTimestamp);

  // Prefer explicit session from lifecycle / page. Never invent a UUID for WS.
  const sessionId = options.sessionId || storeSessionId || null;

  const videoId =
    options.videoId ?? useSessionStore.getState().videoId ?? "";

  const telemetryIntervalMs = options.telemetryIntervalMs ?? 1000;

  const [localAttention, setLocalAttention] = useState(0.75);
  const faceRef = useRef<FaceLandmarkResult | null>(null);
  const lastTelemetryAt = useRef(0);
  const lastDuration = useRef(0);

  useEffect(() => {
    if (sessionId && videoId) {
      getEventService().setContext({
        sessionId,
        videoId,
      });
    }
  }, [sessionId, videoId]);

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
    // Only connect once we have a real backend session UUID
    autoConnect: (options.autoConnect ?? true) && Boolean(sessionId),
  });

  const onFaceResult = useCallback((result: FaceLandmarkResult) => {
    faceRef.current = result;
    setLocalAttention(attentionScoreFromFace(result));
  }, []);

  const emitTelemetry = useCallback(
    (args: {
      eventType: string;
      progressSeconds: number;
      progressPercent: number;
      seekDeltaSeconds?: number;
    }) => {
      const store = useSessionStore.getState();
      if (!store.canWrite()) return;
      if (!sessionId || !videoId) return;

      const face = faceRef.current;
      const attention = face ? attentionScoreFromFace(face) : localAttention;
      setLocalAttention(attention);
      setLastVideoTimestamp(args.progressSeconds);

      const difficultSection = isDifficultSection(args.progressPercent);

      sendTelemetry({
        progressSeconds: args.progressSeconds,
        progressPercent: args.progressPercent,
        attentionScore: attention,
        currentEmotion: "neutral",
        gazeX: face?.gaze.x ?? null,
        gazeY: face?.gaze.y ?? null,
        eventType: args.eventType,
        wallClockMs: Date.now(),
        seekDeltaSeconds: args.seekDeltaSeconds ?? null,
        isDifficultSection: difficultSection,
      });

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
          seekDeltaSeconds: args.seekDeltaSeconds ?? null,
          isDifficultSection: difficultSection,
        },
      });
    },
    [localAttention, sendTelemetry, setLastVideoTimestamp, sessionId, videoId]
  );

  const onPlayerEvent = useCallback(
    (
      type: VideoPlayerEventType,
      payload: VideoPlayerEventPayload[VideoPlayerEventType],
      meta: VideoPlayerEventMeta
    ) => {
      const videoTime = meta.currentTime;
      setLastVideoTimestamp(videoTime);

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
        emitTelemetry({
          eventType: "SEEK_FORWARD",
          progressSeconds: p.to,
          progressPercent: Math.min(100, (p.to / duration) * 100),
          seekDeltaSeconds: p.delta,
        });
        return;
      }

      if (type === "SEEK_BACKWARD") {
        const p = payload as VideoPlayerEventPayload["SEEK_BACKWARD"];
        const duration = lastDuration.current || 1;
        emitTelemetry({
          eventType: "SEEK_BACKWARD",
          progressSeconds: p.to,
          progressPercent: Math.min(100, (p.to / duration) * 100),
          seekDeltaSeconds: -p.delta,
        });
        return;
      }

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
    [emitTelemetry, telemetryIntervalMs, setLastVideoTimestamp]
  );

  return {
    sessionId: sessionId ?? "",
    videoId,
    isWritable: storeWritable,
    attentionScore: localAttention,
    storeAttention,
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
