import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtimeStore } from "@/stores/realtime-store";
import {
  acquireWebSocketClient,
  releaseWebSocketClient,
  isValidSessionId,
  type TelemetryPayload,
  type WebSocketClient,
} from "@/lib/websocket-client";
import { DISABLE_LEARNING_WS } from "@/lib/perf-flags";

export interface UseRealtimeWebsocketOptions {
  sessionId?: string | null;
  videoId?: string;
  autoConnect?: boolean;
}

export function useRealtimeWebsocket(options: UseRealtimeWebsocketOptions = {}) {
  const { sessionId = null, videoId = "", autoConnect = true } = options;
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  const clientRef = useRef<WebSocketClient | null>(null);
  const activeSessionRef = useRef<string | null>(null);

  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const lastPingMs = useRealtimeStore((state) => state.lastPingMs);
  const progressSeconds = useRealtimeStore((state) => state.progressSeconds);
  const progressPercent = useRealtimeStore((state) => state.progressPercent);
  const attentionScore = useRealtimeStore((state) => state.attentionScore);
  const currentEmotion = useRealtimeStore((state) => state.currentEmotion);
  const playbackRate = useRealtimeStore((state) => state.playbackRate);
  const adaptiveAction = useRealtimeStore((state) => state.adaptiveAction);
  const adaptiveReason = useRealtimeStore((state) => state.adaptiveReason);
  const attentionHistory = useRealtimeStore((state) => state.attentionHistory);

  useEffect(() => {
    if (!autoConnect || DISABLE_LEARNING_WS) {
      return;
    }

    if (!isValidSessionId(sessionId)) {
      return;
    }

    const sid = sessionId as string;
    const client = acquireWebSocketClient({
      sessionId: sid,
      userId: user?.id || "unknown",
      token,
    });

    clientRef.current = client;
    activeSessionRef.current = sid;

    return () => {
      if (activeSessionRef.current === sid) {
        releaseWebSocketClient(sid);
        activeSessionRef.current = null;
        clientRef.current = null;
      }
    };
  }, [sessionId, token, user?.id, autoConnect]);

  const sendTelemetry = useCallback(
    (telemetry: Omit<TelemetryPayload, "videoId"> & { videoId?: string }) => {
      if (DISABLE_LEARNING_WS) return;
      if (clientRef.current) {
        clientRef.current.sendTelemetry({
          videoId: telemetry.videoId ?? videoId,
          progressSeconds: telemetry.progressSeconds,
          progressPercent: telemetry.progressPercent,
          attentionScore: telemetry.attentionScore,
          currentEmotion: telemetry.currentEmotion,
          gazeX: telemetry.gazeX,
          gazeY: telemetry.gazeY,
          eventType: telemetry.eventType,
          wallClockMs: telemetry.wallClockMs,
          seekDeltaSeconds: telemetry.seekDeltaSeconds,
          isDifficultSection: telemetry.isDifficultSection,
        });
      }
    },
    [videoId]
  );

  const connect = useCallback(() => {
    if (DISABLE_LEARNING_WS) return;
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    if (activeSessionRef.current) {
      releaseWebSocketClient(activeSessionRef.current);
      activeSessionRef.current = null;
      clientRef.current = null;
    }
  }, []);

  return {
    sessionId: sessionId ?? "",
    videoId,
    connectionStatus: DISABLE_LEARNING_WS ? ("disconnected" as const) : connectionStatus,
    lastPingMs,
    progressSeconds,
    progressPercent,
    attentionScore,
    currentEmotion,
    playbackRate: DISABLE_LEARNING_WS ? 1 : playbackRate,
    adaptiveAction,
    adaptiveReason,
    attentionHistory,
    sendTelemetry,
    connect,
    disconnect,
  };
}
