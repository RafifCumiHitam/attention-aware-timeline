"use client";

import { useEffect, useMemo, useRef } from "react";
import { Play, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoPlayer } from "../hooks/use-video-player";
import { VideoControls } from "./video-controls";
import type { VideoPlayerProps, VideoPlayerSource } from "../types/video-player";
import { Html5VideoController, type VideoController } from "../player";

const DEFAULT_RATES = [0.5, 0.75, 0.8, 1, 1.25, 1.5, 1.75, 2];

function resolveSources(src: string | VideoPlayerSource[]): VideoPlayerSource[] {
  if (typeof src === "string") return [{ src, type: "video/mp4" }];
  return src;
}

export interface VideoPlayerExtendedProps extends VideoPlayerProps {
  /** Internal learning video UUID for VideoController session safety */
  videoId?: string;
  onControllerReady?: (controller: VideoController | null) => void;
}

/**
 * Modern HTML5 learning video player.
 * Supports externalPlaybackRate + VideoController export (Sprint 20.2).
 */
export function VideoPlayer({
  src,
  poster,
  title,
  subtitles = [],
  startTime = 0,
  autoPlay = false,
  loop = false,
  defaultVolume = 1,
  defaultPlaybackRate = 1,
  externalPlaybackRate = null,
  seekStep = 10,
  playbackRates = DEFAULT_RATES,
  attentionScore = null,
  className,
  videoId = "",
  onControllerReady,
  onEvent,
  onPlay,
  onPause,
  onSeekForward,
  onSeekBackward,
  onSpeedChange,
  onVideoEnd,
  onVolumeChange,
  onFullscreenChange,
  onTimeUpdate,
  onSubtitleChange,
}: VideoPlayerExtendedProps) {
  const sources = useMemo(() => resolveSources(src), [src]);
  const primarySrc = sources[0]?.src ?? "";

  const player = useVideoPlayer({
    videoSrc: primarySrc,
    seekStep,
    defaultVolume,
    defaultPlaybackRate,
    startTime,
    onEvent,
    onPlay,
    onPause,
    onSeekForward,
    onSeekBackward,
    onSpeedChange,
    onVideoEnd,
    onVolumeChange,
    onFullscreenChange,
    onTimeUpdate,
    onSubtitleChange,
  });

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalRate = useRef<number | null>(null);
  const onControllerReadyRef = useRef(onControllerReady);
  onControllerReadyRef.current = onControllerReady;

  // Publish Html5VideoController when element is available
  useEffect(() => {
    const el = player.videoRef.current;
    if (!el || !videoId) {
      onControllerReadyRef.current?.(null);
      return;
    }
    const controller = new Html5VideoController(videoId, el);
    onControllerReadyRef.current?.(controller);
    return () => onControllerReadyRef.current?.(null);
  }, [player.videoRef, videoId, primarySrc]);

  const resetHideTimer = () => {
    player.setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (player.isPlaying) {
      hideTimer.current = setTimeout(() => player.setShowControls(false), 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (autoPlay) void player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  useEffect(() => {
    if (externalPlaybackRate == null) return;
    if (lastExternalRate.current === externalPlaybackRate) return;
    if (Math.abs(player.playbackRate - externalPlaybackRate) < 0.01) {
      lastExternalRate.current = externalPlaybackRate;
      return;
    }
    lastExternalRate.current = externalPlaybackRate;
    player.setPlaybackRate(externalPlaybackRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPlaybackRate]);

  useEffect(() => {
    const defaultIdx = subtitles.findIndex((t) => t.default);
    if (defaultIdx >= 0) {
      const t = setTimeout(() => player.setSubtitleTrack(defaultIdx), 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles]);

  return (
    <div
      ref={player.containerRef}
      className={cn(
        "group/player relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg outline-none",
        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background",
        className
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => player.isPlaying && player.setShowControls(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-controls]")) return;
        player.togglePlay();
        resetHideTimer();
      }}
      role="region"
      aria-label={title ? `Video player: ${title}` : "Video player"}
    >
      <video
        ref={player.videoRef}
        className="h-full w-full object-contain"
        poster={poster}
        playsInline
        loop={loop}
        preload="metadata"
        crossOrigin="anonymous"
      >
        {sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type ?? "video/mp4"} />
        ))}
        {subtitles.map((track) => (
          <track
            key={track.id}
            kind={track.kind ?? "subtitles"}
            src={track.src}
            srcLang={track.srclang}
            label={track.label}
            default={track.default}
          />
        ))}
        Your browser does not support HTML5 video.
      </video>

      {!player.isPlaying && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-xl backdrop-blur-sm">
            <Play className="h-7 w-7 ml-1" />
          </div>
        </div>
      )}

      {title && player.showControls && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <p className="truncate text-sm font-medium text-white drop-shadow">{title}</p>
        </div>
      )}

      {attentionScore != null && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <Eye className="h-3.5 w-3.5 text-emerald-400" />
          {Math.round(attentionScore)}% focus
          {externalPlaybackRate != null && externalPlaybackRate !== 1 && (
            <span className="ml-1 text-amber-300">{externalPlaybackRate}x</span>
          )}
        </div>
      )}

      <div
        data-controls
        className={cn(
          "transition-opacity duration-300",
          player.showControls || !player.isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <VideoControls
          isPlaying={player.isPlaying}
          isMuted={player.isMuted}
          isFullscreen={player.isFullscreen}
          volume={player.volume}
          currentTime={player.currentTime}
          duration={player.duration}
          buffered={player.buffered}
          progress={player.progress}
          playbackRate={player.playbackRate}
          playbackRates={playbackRates}
          subtitles={subtitles}
          activeSubtitleIndex={player.activeSubtitleIndex}
          seekStep={seekStep}
          onTogglePlay={player.togglePlay}
          onSeekForward={() => player.seekForward()}
          onSeekBackward={() => player.seekBackward()}
          onSeek={player.seek}
          onVolumeChange={player.setVolume}
          onToggleMute={player.toggleMute}
          onPlaybackRateChange={player.setPlaybackRate}
          onToggleFullscreen={() => void player.toggleFullscreen()}
          onSubtitleChange={player.setSubtitleTrack}
          formatTime={player.formatTime}
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
