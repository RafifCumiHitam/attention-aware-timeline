"use client";

/**
 * YouTube IFrame Player — adaptive rate without SPEED_CHANGE feedback loop.
 * Exposes VideoController via onControllerReady (Sprint 20.2).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DISABLE_ADAPTIVE_PLAYBACK } from "@/lib/perf-flags";
import type {
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "../types/video-player";
import {
  YouTubeVideoController,
  type VideoController,
} from "../player";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerProps {
  youtubeVideoId: string;
  /** Internal learning video UUID — required for session-safe resume */
  videoId?: string;
  className?: string;
  title?: string;
  attentionScore?: number;
  externalPlaybackRate?: number;
  onEvent?: (
    type: VideoPlayerEventType,
    payload: VideoPlayerEventPayload[VideoPlayerEventType],
    meta: VideoPlayerEventMeta
  ) => void;
  onVideoEnd?: () => void;
  pollIntervalMs?: number;
  onControllerReady?: (controller: VideoController | null) => void;
}

function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existing) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
}

export function YouTubePlayer({
  youtubeVideoId,
  videoId = "",
  className,
  title,
  externalPlaybackRate,
  onEvent,
  onVideoEnd,
  pollIntervalMs = 1000,
  onControllerReady,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const lastTimeRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef(false);
  const appliedExternalRateRef = useRef<number | null>(null);
  const lastKnownRateRef = useRef(1);
  const controllerRef = useRef<YouTubeVideoController | null>(null);
  const onControllerReadyRef = useRef(onControllerReady);
  onControllerReadyRef.current = onControllerReady;
  const [ready, setReady] = useState(false);

  const emit = useCallback(
    (type: VideoPlayerEventType, payload: any = {}) => {
      const p = playerRef.current;
      if (!p || !onEvent) return;
      const currentTime = p.getCurrentTime?.() ?? 0;
      const duration = p.getDuration?.() ?? 0;
      const rate = p.getPlaybackRate?.() ?? 1;
      const meta: VideoPlayerEventMeta = {
        currentTime,
        duration,
        playbackRate: rate,
        buffer: 0,
        fullscreen: false,
        volume: 1,
        muted: false,
        videoSrc: `youtube:${youtubeVideoId}`,
        timestamp: Date.now(),
      };
      onEvent(type, payload, meta);
    },
    [onEvent, youtubeVideoId]
  );

  useEffect(() => {
    let destroyed = false;

    async function boot() {
      await loadYouTubeAPI();
      if (destroyed || !hostRef.current || !window.YT) return;

      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setReady(true);
            if (videoId) {
              const c = new YouTubeVideoController(videoId, playerRef.current);
              controllerRef.current = c;
              onControllerReadyRef.current?.(c);
            }
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) {
              playingRef.current = true;
              emit("PLAY", {});
            }
            if (e.data === 2) {
              playingRef.current = false;
              emit("PAUSE", {});
            }
            if (e.data === 0) {
              playingRef.current = false;
              emit("VIDEO_END", {});
              onVideoEnd?.();
            }
          },
          onPlaybackRateChange: (e: { data: number }) => {
            const next = e.data;
            if (
              appliedExternalRateRef.current != null &&
              Math.abs(next - appliedExternalRateRef.current) < 0.01
            ) {
              lastKnownRateRef.current = next;
              return;
            }
            if (Math.abs(next - lastKnownRateRef.current) < 0.01) return;
            lastKnownRateRef.current = next;
            emit("SPEED_CHANGE", { to: next });
          },
        },
      });

      pollRef.current = setInterval(() => {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        const t = p.getCurrentTime();
        const duration = p.getDuration?.() ?? 0;
        const prev = lastTimeRef.current;
        const delta = t - prev;

        if (Math.abs(delta) >= 2.5) {
          if (delta > 0) emit("SEEK_FORWARD", { from: prev, to: t, delta });
          else emit("SEEK_BACKWARD", { from: prev, to: t, delta: Math.abs(delta) });
        } else if (playingRef.current && Math.abs(delta) >= 0.5) {
          emit("TIME_UPDATE", {
            currentTime: t,
            duration,
            progress: duration > 0 ? (t / duration) * 100 : 0,
          });
        }
        lastTimeRef.current = t;
      }, pollIntervalMs);
    }

    void boot();

    return () => {
      destroyed = true;
      if (pollRef.current) clearInterval(pollRef.current);
      onControllerReadyRef.current?.(null);
      controllerRef.current = null;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeVideoId, pollIntervalMs, videoId]);

  useEffect(() => {
    if (DISABLE_ADAPTIVE_PLAYBACK) return;
    if (!ready || externalPlaybackRate == null) return;
    const p = playerRef.current;
    if (!p?.setPlaybackRate) return;

    const current = p.getPlaybackRate?.() ?? lastKnownRateRef.current;
    if (Math.abs(current - externalPlaybackRate) < 0.01) return;

    try {
      appliedExternalRateRef.current = externalPlaybackRate;
      p.setPlaybackRate(externalPlaybackRate);
      lastKnownRateRef.current = externalPlaybackRate;
    } catch {
      appliedExternalRateRef.current = null;
    }
  }, [externalPlaybackRate, ready]);

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-black", className)}>
      <div ref={hostRef} className="h-full w-full" title={title} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Loading YouTube…
        </div>
      )}
    </div>
  );
}
