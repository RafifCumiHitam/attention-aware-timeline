"use client";

import { useFaceLandmarker } from "../hooks/use-face-landmarker";
import type { FaceLandmarkResult } from "../types";
import { cn } from "@/lib/utils";

interface FaceTrackerOverlayProps {
  className?: string;
  onResult?: (result: FaceLandmarkResult) => void;
  autoStart?: boolean;
  showVideo?: boolean;
  showDebug?: boolean;
}

export function FaceTrackerOverlay({
  className,
  onResult,
  autoStart = false,
  showVideo = true,
  showDebug = true,
}: FaceTrackerOverlayProps) {
  const { result, ready, streaming, error, videoRef, start, stop } =
    useFaceLandmarker({ targetFps: 30, maxWidth: 640, autoStart, onResult });

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
            {!ready ? "Loading model…" : streaming ? "Tracking" : "Ready"}
          </span>
          {result?.face_detected && (
            <span className="text-white/80">
              gaze ({result.gaze.x.toFixed(2)}, {result.gaze.y.toFixed(2)}) · yaw{" "}
              {result.yaw.toFixed(0)}° · blink{" "}
              {result.blink_detected ? "yes" : "no"}
            </span>
          )}
          {result?.fps != null && (
            <span className="ml-auto tabular-nums text-white/60">
              {result.fps} FPS
            </span>
          )}
        </div>
        {showDebug && result && (
          <pre className="mt-2 max-h-24 overflow-auto rounded bg-black/50 p-2 font-mono text-[10px] text-emerald-300/90">
            {JSON.stringify(
              {
                gaze: result.gaze,
                eye_open: result.eye_open,
                yaw: result.yaw,
                pitch: result.pitch,
                roll: result.roll,
                timestamp: result.timestamp,
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
