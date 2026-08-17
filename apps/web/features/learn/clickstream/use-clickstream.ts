"use client";

/**
 * useClickstream — maps normalized player events → finalized seeks + research meta.
 * Does NOT decide confusion; feeds InterventionEngine separately.
 */

import { useCallback, useEffect, useRef } from "react";
import { SeekFinalizer } from "./seek-finalizer";
import type { ClickstreamConfig } from "./config";
import type { FinalizedSeekEvent, ResearchEventMeta } from "./types";
import type {
  VideoPlayerEventHandler,
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "../types/video-player";

export interface UseClickstreamOptions {
  config?: Partial<ClickstreamConfig>;
  onFinalizedSeek?: (seek: FinalizedSeekEvent) => void;
  /** Adaptive rate currently applied — used to tag SPEED_CHANGE source */
  getAdaptiveRate?: () => number | null | undefined;
}

export function useClickstream(options: UseClickstreamOptions = {}) {
  const onSeekRef = useRef(options.onFinalizedSeek);
  onSeekRef.current = options.onFinalizedSeek;
  const adaptiveRef = useRef(options.getAdaptiveRate);
  adaptiveRef.current = options.getAdaptiveRate;

  const finalizerRef = useRef<SeekFinalizer | null>(null);

  useEffect(() => {
    const f = new SeekFinalizer({
      config: options.config,
      onFinalized: (seek) => onSeekRef.current?.(seek),
    });
    finalizerRef.current = f;
    return () => f.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPlayerEvent: VideoPlayerEventHandler = useCallback(
    (
      type: VideoPlayerEventType,
      payload: VideoPlayerEventPayload[VideoPlayerEventType],
      meta: VideoPlayerEventMeta
    ) => {
      const rate = meta.playbackRate ?? 1;

      if (type === "SEEK_FORWARD" || type === "SEEK_BACKWARD") {
        const p = payload as VideoPlayerEventPayload["SEEK_FORWARD"];
        finalizerRef.current?.noteSeekJump(p.from, p.to, rate);
        return;
      }

      // TIME_UPDATE is not a seek; ignore for finalizer origin unless needed
    },
    []
  );

  /** Enrich meta for event logger from a finalized seek */
  const seekToResearchMeta = useCallback(
    (seek: FinalizedSeekEvent, extra?: Partial<ResearchEventMeta>): ResearchEventMeta => ({
      video_time_from: seek.from,
      video_time_to: seek.to,
      seek_distance: seek.distance,
      seek_direction: seek.direction,
      is_meaningful: seek.isMeaningful,
      target_zone_id: seek.targetZoneId,
      source_zone_id: seek.sourceZoneId,
      raw_vs_derived: "derived",
      ...extra,
    }),
    []
  );

  /** Classify SPEED_CHANGE as user vs adaptive */
  const classifySpeedChange = useCallback((to: number): "user" | "adaptive" | "unknown" => {
    const adaptive = adaptiveRef.current?.();
    if (adaptive != null && Math.abs(adaptive - to) < 0.01) return "adaptive";
    return "user";
  }, []);

  const flush = useCallback(() => finalizerRef.current?.flush(), []);

  return {
    onPlayerEvent,
    seekToResearchMeta,
    classifySpeedChange,
    flush,
  };
}
