"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Zap,
  Wifi,
  WifiOff,
  Gauge,
  Smile,
  Frown,
  AlertCircle,
  Play,
  Pause,
} from "lucide-react";
import { useRealtimeWebsocket } from "@/hooks/use-realtime-websocket";

export interface RealtimeLearningPanelProps {
  sessionId?: string;
  videoId?: string;
  /** When false, only displays store state (pipeline owns the socket) */
  autoConnect?: boolean;
}

export function RealtimeLearningPanel({
  sessionId = "learning-session-prod-1",
  videoId = "vid-intro-ai-101",
  autoConnect = true,
}: RealtimeLearningPanelProps) {
  const {
    connectionStatus,
    lastPingMs,
    progressSeconds,
    progressPercent,
    attentionScore,
    currentEmotion,
    playbackRate,
    adaptiveAction,
    adaptiveReason,
    sendTelemetry,
    connect,
    disconnect,
  } = useRealtimeWebsocket({
    sessionId,
    videoId,
    autoConnect,
  });

  const [simulating, setSimulating] = useState(false);
  const [simAttention, setSimAttention] = useState(0.85);
  const [simEmotion, setSimEmotion] = useState("focused");
  const [simProgress, setSimProgress] = useState(15.0);

  // Refs so the interval never closes over stale values / never calls setState-in-updater side effects
  const simAttentionRef = useRef(simAttention);
  const simEmotionRef = useRef(simEmotion);
  const playbackRateRef = useRef(playbackRate);
  simAttentionRef.current = simAttention;
  simEmotionRef.current = simEmotion;
  playbackRateRef.current = playbackRate;

  useEffect(() => {
    if (!simulating || !autoConnect) return;

    const interval = setInterval(() => {
      setSimProgress((prevProgress) => {
        const nextProgress = prevProgress + 1.0 * playbackRateRef.current;
        const normalizedPercent = Math.min(100, (nextProgress / 120) * 100);

        // Side effects OUTSIDE the pure updater — schedule after commit
        queueMicrotask(() => {
          sendTelemetry({
            progressSeconds: Math.round(nextProgress * 10) / 10,
            progressPercent: Math.round(normalizedPercent * 10) / 10,
            attentionScore: simAttentionRef.current,
            currentEmotion: simEmotionRef.current,
            eventType: "SIM_TICK",
            wallClockMs: Date.now(),
            isDifficultSection: normalizedPercent >= 40 && normalizedPercent <= 80,
          });
        });

        return nextProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simulating, autoConnect, sendTelemetry]);

  const handleEmotionChange = (newEmotion: string) => {
    setSimEmotion(newEmotion);
    let defaultAttention = simAttention;
    if (newEmotion === "focused") defaultAttention = 0.9;
    if (newEmotion === "confused") defaultAttention = 0.35;
    if (newEmotion === "distracted") defaultAttention = 0.25;
    if (newEmotion === "bored") defaultAttention = 0.5;
    setSimAttention(defaultAttention);

    if (!autoConnect) return;
    sendTelemetry({
      progressSeconds: simProgress,
      progressPercent: Math.min(100, (simProgress / 120) * 100),
      attentionScore: defaultAttention,
      currentEmotion: newEmotion,
      eventType: "SIM_EMOTION",
      wallClockMs: Date.now(),
    });
  };

  const handleAttentionChange = (val: number) => {
    setSimAttention(val);
    if (!autoConnect) return;
    sendTelemetry({
      progressSeconds: simProgress,
      progressPercent: Math.min(100, (simProgress / 120) * 100),
      attentionScore: val,
      currentEmotion: simEmotion,
      eventType: "SIM_ATTENTION",
      wallClockMs: Date.now(),
    });
  };

  const getAttentionBadgeColor = (score: number) => {
    if (score >= 0.75) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (score >= 0.45) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  const getEmotionIcon = (emotion: string) => {
    switch (emotion.toLowerCase()) {
      case "focused":
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case "confused":
        return <Frown className="w-4 h-4 text-amber-400" />;
      case "distracted":
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Smile className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between p-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="relative">
            {connectionStatus === "connected" ? (
              <Wifi className="w-5 h-5 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-100">FastAPI WebSocket Status</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-mono capitalize ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : connectionStatus === "reconnecting"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}
              >
                {connectionStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              session: {sessionId.slice(0, 12)}… · Heartbeat:{" "}
              {lastPingMs !== null ? `${lastPingMs}ms` : "Waiting…"}
              {!autoConnect && " · (pipeline owns socket)"}
            </p>
          </div>
        </div>

        {autoConnect && (
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            {connectionStatus === "connected" ? (
              <button
                onClick={() => disconnect()}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => connect()}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
              >
                Connect WebSocket
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Video Progress</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {Math.floor(progressSeconds / 60)}:
            {Math.floor(progressSeconds % 60)
              .toString()
              .padStart(2, "0")}
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Attention Score</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {Math.round(attentionScore * 100)}%
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded border ${getAttentionBadgeColor(
                attentionScore
              )}`}
            >
              {(attentionScore * 10).toFixed(1)} / 10
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Current Emotion</span>
            {getEmotionIcon(currentEmotion)}
          </div>
          <div className="text-xl font-bold capitalize text-slate-100 flex items-center space-x-2">
            <span>{currentEmotion}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Adaptive Playback Rate</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-amber-400">{playbackRate}x</span>
            <span className="text-xs text-slate-400 capitalize">({adaptiveAction})</span>
          </div>
        </div>
      </div>

      {adaptiveReason && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-3">
          <Zap className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-300">Adaptive Engine Directive</h4>
            <p className="text-xs text-amber-200/80">{adaptiveReason}</p>
          </div>
        </div>
      )}

      {autoConnect && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Realtime Telemetry Simulator</h3>
              <p className="text-xs text-slate-400">
                Optional manual stream. On Learn page the face+player pipeline owns telemetry.
              </p>
            </div>
            <button
              onClick={() => setSimulating(!simulating)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                simulating
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                  : "bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-500/20"
              }`}
            >
              {simulating ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Simulator</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Telemetry Stream</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="text-slate-300 font-medium">Simulated Attention Score</label>
                <span className="font-mono text-emerald-400">{(simAttention * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.05"
                value={simAttention}
                onChange={(e) => handleAttentionChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <p className="text-[11px] text-slate-400">
                Seek-forward into 40–80% progress with attention &lt; 0.55 → 0.8x slowdown.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium block">Simulated Emotion State</label>
              <div className="grid grid-cols-4 gap-2">
                {["focused", "neutral", "confused", "distracted"].map((emo) => (
                  <button
                    key={emo}
                    onClick={() => handleEmotionChange(emo)}
                    className={`py-1.5 text-xs rounded-lg border font-medium capitalize transition-all ${
                      simEmotion === emo
                        ? "bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
