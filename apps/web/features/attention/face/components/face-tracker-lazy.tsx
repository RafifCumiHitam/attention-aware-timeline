"use client";

import dynamic from "next/dynamic";
import type { FaceLandmarkResult } from "../types";

/**
 * Client-only lazy wrapper so MediaPipe never enters the SSR / Turbopack
 * critical path for the Learn page graph.
 */
const FaceTrackerOverlay = dynamic(
  () =>
    import("./face-tracker-overlay").then((m) => m.FaceTrackerOverlay),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
        Loading face tracker…
      </div>
    ),
  }
);

interface Props {
  className?: string;
  onResult?: (result: FaceLandmarkResult) => void;
  autoStart?: boolean;
  showVideo?: boolean;
  showDebug?: boolean;
}

export function FaceTrackerLazy(props: Props) {
  return <FaceTrackerOverlay {...props} />;
}
