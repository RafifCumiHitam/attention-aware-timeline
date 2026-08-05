"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UseVideoPlayerOptions,
  UseVideoPlayerReturn,
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "../types/video-player";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useVideoPlayer(options: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const {
    seekStep = 10,
    defaultVolume = 1,
    defaultPlaybackRate = 1,
    startTime = 0,
    videoSrc,
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
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolumeState] = useState(defaultVolume);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(defaultPlaybackRate);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const emit = useCallback(
    <T extends VideoPlayerEventType>(type: T, payload: VideoPlayerEventPayload[T]) => {
      const video = videoRef.current;
      const meta: VideoPlayerEventMeta = {
        timestamp: Date.now(),
        videoSrc,
        playbackRate: video?.playbackRate ?? playbackRate,
        buffer: (() => {
          if (!video || !video.duration || video.buffered.length === 0) return 0;
          try {
            const end = video.buffered.end(video.buffered.length - 1);
            return (end / video.duration) * 100;
          } catch {
            return 0;
          }
        })(),
        fullscreen: Boolean(typeof document !== "undefined" && document.fullscreenElement),
        volume: video?.volume ?? volume,
        muted: video?.muted ?? isMuted,
        currentTime: video?.currentTime ?? currentTime,
      };
      // Structured log for learning analytics
      console.log(`[VideoPlayer] ${type}`, { ...payload, ...meta });
      onEvent?.(type, payload, meta);

      switch (type) {
        case "PLAY":
          onPlay?.(payload as VideoPlayerEventPayload["PLAY"]);
          break;
        case "PAUSE":
          onPause?.(payload as VideoPlayerEventPayload["PAUSE"]);
          break;
        case "SEEK_FORWARD":
          onSeekForward?.(payload as VideoPlayerEventPayload["SEEK_FORWARD"]);
          break;
        case "SEEK_BACKWARD":
          onSeekBackward?.(payload as VideoPlayerEventPayload["SEEK_BACKWARD"]);
          break;
        case "SPEED_CHANGE":
          onSpeedChange?.(payload as VideoPlayerEventPayload["SPEED_CHANGE"]);
          break;
        case "VIDEO_END":
          onVideoEnd?.(payload as VideoPlayerEventPayload["VIDEO_END"]);
          break;
        case "VOLUME_CHANGE":
          onVolumeChange?.(payload as VideoPlayerEventPayload["VOLUME_CHANGE"]);
          break;
        case "FULLSCREEN_CHANGE":
          onFullscreenChange?.(payload as VideoPlayerEventPayload["FULLSCREEN_CHANGE"]);
          break;
        case "TIME_UPDATE":
          onTimeUpdate?.(payload as VideoPlayerEventPayload["TIME_UPDATE"]);
          break;
        case "SUBTITLE_CHANGE":
          onSubtitleChange?.(payload as VideoPlayerEventPayload["SUBTITLE_CHANGE"]);
          break;
      }
    },
    [
      videoSrc,
      playbackRate,
      volume,
      isMuted,
      currentTime,
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
    ]
  );

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setIsPlaying(true);
      emit("PLAY", { currentTime: video.currentTime });
    } catch {
      // Autoplay blocked or interrupted
    }
  }, [emit]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    emit("PAUSE", { currentTime: video.currentTime });
  }, [emit]);

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      void play();
    } else {
      pause();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration));
    setCurrentTime(video.currentTime);
  }, []);

  const seekForward = useCallback(
    (delta = seekStep) => {
      const video = videoRef.current;
      if (!video) return;
      const from = video.currentTime;
      const to = Math.min(from + delta, video.duration || from + delta);
      video.currentTime = to;
      setCurrentTime(to);
      emit("SEEK_FORWARD", { from, to, delta: to - from });
    },
    [seekStep, emit]
  );

  const seekBackward = useCallback(
    (delta = seekStep) => {
      const video = videoRef.current;
      if (!video) return;
      const from = video.currentTime;
      const to = Math.max(from - delta, 0);
      video.currentTime = to;
      setCurrentTime(to);
      emit("SEEK_BACKWARD", { from, to, delta: from - to });
    },
    [seekStep, emit]
  );

  const setVolume = useCallback(
    (v: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(1, v));
      video.volume = clamped;
      video.muted = clamped === 0;
      setVolumeState(clamped);
      setIsMuted(clamped === 0);
      emit("VOLUME_CHANGE", { volume: clamped, muted: clamped === 0 });
    },
    [emit]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      const restore = volume > 0 ? volume : defaultVolume;
      video.muted = false;
      video.volume = restore;
      setIsMuted(false);
      setVolumeState(restore);
      emit("VOLUME_CHANGE", { volume: restore, muted: false });
    } else {
      video.muted = true;
      setIsMuted(true);
      emit("VOLUME_CHANGE", { volume: video.volume, muted: true });
    }
  }, [volume, defaultVolume, emit]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (!video) return;
      const from = video.playbackRate;
      video.playbackRate = rate;
      setPlaybackRateState(rate);
      emit("SPEED_CHANGE", { from, to: rate });
    },
    [emit]
  );

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
        emit("FULLSCREEN_CHANGE", { isFullscreen: true });
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        emit("FULLSCREEN_CHANGE", { isFullscreen: false });
      }
    } catch {
      // Fullscreen API not available
    }
  }, [emit]);

  const setSubtitleTrack = useCallback(
    (index: number | null) => {
      const video = videoRef.current;
      if (!video) return;
      const tracks = video.textTracks;
      let label: string | null = null;
      for (let i = 0; i < tracks.length; i++) {
        if (index === i) {
          tracks[i].mode = "showing";
          label = tracks[i].label || tracks[i].language || `Track ${i + 1}`;
        } else {
          tracks[i].mode = "hidden";
        }
      }
      if (index === null) {
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = "hidden";
        }
      }
      setActiveSubtitleIndex(index);
      emit("SUBTITLE_CHANGE", { trackIndex: index, label });
    },
    [emit]
  );

  // Media element listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (startTime > 0) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
      }
      video.volume = defaultVolume;
      video.playbackRate = defaultPlaybackRate;
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const dur = video.duration || 0;
      const prog = dur > 0 ? (video.currentTime / dur) * 100 : 0;
      emit("TIME_UPDATE", {
        currentTime: video.currentTime,
        duration: dur,
        progress: prog,
      });
    };

    const onProgress = () => {
      if (video.buffered.length > 0) {
        const end = video.buffered.end(video.buffered.length - 1);
        setBuffered(video.duration > 0 ? (end / video.duration) * 100 : 0);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      emit("VIDEO_END", { duration: video.duration });
    };

    const onPlayEvent = () => setIsPlaying(true);
    const onPauseEvent = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onProgress);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlayEvent);
    video.addEventListener("pause", onPauseEvent);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlayEvent);
      video.removeEventListener("pause", onPauseEvent);
    };
  }, [startTime, defaultVolume, defaultPlaybackRate, emit]);

  // Fullscreen change (user pressed Esc, etc.)
  useEffect(() => {
    const handler = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      // Only when focus is inside player or no specific input
      const container = containerRef.current;
      if (container && !container.contains(document.activeElement) && document.activeElement !== document.body) {
        // still allow global shortcuts when body focused
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekForward();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekBackward();
          break;
        case "arrowup":
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          void toggleFullscreen();
          break;
        case "<":
        case ",":
          e.preventDefault();
          setPlaybackRate(Math.max(0.25, playbackRate - 0.25));
          break;
        case ">":
        case ".":
          e.preventDefault();
          setPlaybackRate(Math.min(3, playbackRate + 0.25));
          break;
        case "c":
          // toggle first subtitle track
          e.preventDefault();
          setSubtitleTrack(activeSubtitleIndex === null ? 0 : null);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    togglePlay,
    seekForward,
    seekBackward,
    setVolume,
    volume,
    toggleMute,
    toggleFullscreen,
    setPlaybackRate,
    playbackRate,
    setSubtitleTrack,
    activeSubtitleIndex,
  ]);

  return {
    videoRef,
    containerRef,
    isPlaying,
    isMuted,
    isFullscreen,
    volume,
    currentTime,
    duration,
    buffered,
    playbackRate,
    progress,
    activeSubtitleIndex,
    showControls,
    setShowControls,
    play,
    pause,
    togglePlay,
    seek,
    seekForward,
    seekBackward,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
    setSubtitleTrack,
    formatTime,
  };
}
