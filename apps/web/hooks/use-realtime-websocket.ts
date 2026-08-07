import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtimeStore } from "@/stores/realtime-store";
import { WebSocketClient, type TelemetryPayload } from "@/lib/websocket-client";

export interface UseRealtimeWebsocketOptions {
  sessionId?: string;
  videoId?: string;
  autoConnect?: boolean;
}

export function useRealtimeWebsocket(options: UseRealtimeWebsocketOptions = {}) {
  const {
    sessionId = "demo-session-1",
    videoId = "demo-video-1",
    autoConnect = true,
  } = options;
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  const clientRef = useRef<WebSocketClient | null>(null);

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
    if (!autoConnect) return;

    const client = new WebSocketClient({
      sessionId,
      userId: user?.id || "demo-user-1",
      token,
    });
    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [sessionId, token, user?.id, autoConnect]);

  const sendTelemetry = useCallback(
    (telemetry: Omit<TelemetryPayload, "videoId"> & { videoId?: string }) => {
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
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    sessionId,
    videoId,
    connectionStatus,
    lastPingMs,
    progressSeconds,
    progressPercent,
    attentionScore,
    currentEmotion,
    playbackRate,
    adaptiveAction,
    adaptiveReason,
    attentionHistory,
    sendTelemetry,
    connect,
    disconnect,
  };
}
