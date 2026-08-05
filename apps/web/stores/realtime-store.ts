import { create } from "zustand";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type AdaptiveAction =
  | "slowdown"
  | "speedup"
  | "pause_prompt"
  | "recap_suggestion"
  | "maintain";

export interface AttentionPoint {
  timestamp: number;
  score: number;
}

export interface EmotionPoint {
  timestamp: number;
  emotion: string;
}

interface RealtimeState {
  // Connection State
  connectionStatus: ConnectionStatus;
  lastPingMs: number | null;
  reconnectAttempts: number;

  // Realtime Telemetry Data
  progressSeconds: number;
  progressPercent: number;
  attentionScore: number; // 0.0 - 1.0
  currentEmotion: string;
  gazeX: number | null;
  gazeY: number | null;

  // Adaptive Playback State
  playbackRate: number;
  adaptiveAction: AdaptiveAction;
  adaptiveReason: string | null;

  // Realtime Sparkline History (last 30 samples)
  attentionHistory: AttentionPoint[];
  emotionHistory: EmotionPoint[];

  // Store Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setPingLatency: (ms: number) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  updateTelemetry: (data: {
    progressSeconds: number;
    progressPercent: number;
    attentionScore: number;
    currentEmotion: string;
    gazeX?: number | null;
    gazeY?: number | null;
  }) => void;
  setAdaptiveCommand: (command: {
    playbackRate: number;
    action: AdaptiveAction;
    reason: string;
  }) => void;
  resetState: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionStatus: "disconnected",
  lastPingMs: null,
  reconnectAttempts: 0,

  progressSeconds: 0,
  progressPercent: 0,
  attentionScore: 0.85,
  currentEmotion: "neutral",
  gazeX: null,
  gazeY: null,

  playbackRate: 1.0,
  adaptiveAction: "maintain",
  adaptiveReason: null,

  attentionHistory: [],
  emotionHistory: [],

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setPingLatency: (ms) => set({ lastPingMs: ms }),
  incrementReconnectAttempts: () =>
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  updateTelemetry: (data) =>
    set((state) => {
      const now = Date.now();
      const newAttentionHistory = [
        ...state.attentionHistory.slice(-29),
        { timestamp: now, score: data.attentionScore },
      ];
      const newEmotionHistory = [
        ...state.emotionHistory.slice(-29),
        { timestamp: now, emotion: data.currentEmotion },
      ];

      return {
        progressSeconds: data.progressSeconds,
        progressPercent: data.progressPercent,
        attentionScore: data.attentionScore,
        currentEmotion: data.currentEmotion,
        gazeX: data.gazeX ?? state.gazeX,
        gazeY: data.gazeY ?? state.gazeY,
        attentionHistory: newAttentionHistory,
        emotionHistory: newEmotionHistory,
      };
    }),

  setAdaptiveCommand: (command) =>
    set({
      playbackRate: command.playbackRate,
      adaptiveAction: command.action,
      adaptiveReason: command.reason,
    }),

  resetState: () =>
    set({
      connectionStatus: "disconnected",
      lastPingMs: null,
      reconnectAttempts: 0,
      progressSeconds: 0,
      progressPercent: 0,
      attentionScore: 0.85,
      currentEmotion: "neutral",
      gazeX: null,
      gazeY: null,
      playbackRate: 1.0,
      adaptiveAction: "maintain",
      adaptiveReason: null,
      attentionHistory: [],
      emotionHistory: [],
    }),
}));
