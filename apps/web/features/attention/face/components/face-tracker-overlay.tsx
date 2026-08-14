"use client";

/**
 * Face tracker UI — inference ~10 FPS in Web Worker (Phase 12).
 * Camera preview stays on main thread; detectForVideo never runs here.
 */

import { useFaceLandmarker } from "../hooks/use-face-landmarker";
import type { FaceLandmarkResult } from "../types";
import { cn } from "@/lib/utils";
import { DISABLE_FACE_INFERENCE } from "@/lib/perf-flags";

interface FaceTrackerOverlayProps {
  className?: string;
  onResult?: (result: FaceLandmarkResult) => void;
  autoStart?: boolean;
  showVideo?: boolean;
  showDebug?: boolean;
  targetFps?: number;
  maxWidth?: number;
}

export function FaceTrackerOverlay({
  className,
  onResult,
  autoStart = false,
  showVideo = true,
  showDebug = false,
  targetFps = 10,
  maxWidth = 480,
}: FaceTrackerOverlayProps) {
  const { result, ready, streaming, error, videoRef, start, stop } =
    useFaceLandmarker({
      targetFps,
      maxWidth,
      autoStart,
      onResult,
      uiUpdateIntervalMs: 250,
    });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-black",
        className
      )}
    >
      <video
        ref={videoRef}
        className={cn(
          "h-full w-full scale-x-[-1] object-cover",
          !showVideo && "sr-only"
        )}
        playsInline
        muted
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              streaming
                ? "bg-emerald-500/80"
                : ready
                  ? "bg-amber-500/80"
                  : "bg-zinc-600"
            )}
          >
            {!ready
              ? "Loading worker…"
              : streaming
                ? DISABLE_FACE_INFERENCE
                  ? "Preview only (inference OFF)"
                  : `Worker ~${targetFps}fps`
                : "Ready"}
          </span>
          {result?.face_detected && !DISABLE_FACE_INFERENCE && (
            <span className="text-white/80">
              gaze ({result.gaze.x.toFixed(2)}, {result.gaze.y.toFixed(2)}) · yaw{" "}
              {result.yaw.toFixed(0)}°
            </span>
          )}
          {result?.latency_ms != null && (
            <span className="ml-auto tabular-nums text-white/60">
              {result.latency_ms}ms
            </span>
          )}
        </div>
        {showDebug && result && (
          <pre className="mt-2 max-h-24 overflow-auto rounded bg-black/50 p-2 font-mono text-[10px] text-emerald-300/90">
            {JSON.stringify(
              {
                gaze: result.gaze,
                yaw: result.yaw,
                pitch: result.pitch,
                latency_ms: result.latency_ms,
              },
              null,
              0
            )}
          </pre>
        )}
        {error && <p className="mt-1 text-rose-400">{error}</p>}
      </div>
      {!streaming && ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => void start()}
            className="pointer-events-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow"
          >
            Start camera
          </button>
        </div>
      )}
      {streaming && (
        <button
          type="button"
          onClick={stop}
          className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-[10px] text-white hover:bg-black/70"
        >
          Stop
        </button>
      )}
    </div>
  );
}
