import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtimeStore } from "@/stores/realtime-store";
import { WebSocketClient, WebSocketClientOptions } from "@/lib/websocket-client";

export interface UseRealtimeWebsocketOptions {
  sessionId?: string;
  videoId?: string;
  autoConnect?: boolean;
}

export function useRealtimeWebsocket(options: UseRealtimeWebsocketOptions = {}) {
  const { sessionId = "demo-session-1", videoId = "demo-video-1", autoConnect = true } = options;
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  const clientRef = useRef<WebSocketClient | null>(null);

  // Subscribe to Zustand store values for quick component access
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

    const wsOptions: WebSocketClientOptions = {
      sessionId,
      userId: user?.id || "demo-user-1",
      token,
    };

    const client = new WebSocketClient(wsOptions);
    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [sessionId, token, user?.id, autoConnect]);

  const sendTelemetry = useCallback(
    (telemetry: {
      progressSeconds: number;
      progressPercent: number;
      attentionScore: number;
      currentEmotion: string;
      gazeX?: number | null;
      gazeY?: number | null;
    }) => {
      if (clientRef.current) {
        clientRef.current.sendTelemetry({
          videoId,
          ...telemetry,
        });
      }
    },
    [videoId]
  );

  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  return {
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
