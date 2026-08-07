/**
 * Learning video player types & event contracts
 */

export type VideoPlayerEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK_FORWARD"
  | "SEEK_BACKWARD"
  | "SPEED_CHANGE"
  | "VIDEO_END"
  | "VOLUME_CHANGE"
  | "FULLSCREEN_CHANGE"
  | "TIME_UPDATE"
  | "SUBTITLE_CHANGE";

export interface VideoPlayerEventPayload {
  PLAY: { currentTime: number };
  PAUSE: { currentTime: number };
  SEEK_FORWARD: { from: number; to: number; delta: number };
  SEEK_BACKWARD: { from: number; to: number; delta: number };
  SPEED_CHANGE: { from: number; to: number };
  VIDEO_END: { duration: number };
  VOLUME_CHANGE: { volume: number; muted: boolean };
  FULLSCREEN_CHANGE: { isFullscreen: boolean };
  TIME_UPDATE: { currentTime: number; duration: number; progress: number };
  SUBTITLE_CHANGE: { trackIndex: number | null; label: string | null };
}

export type VideoPlayerEventHandler<T extends VideoPlayerEventType = VideoPlayerEventType> = (
  type: T,
  payload: VideoPlayerEventPayload[T],
  meta: VideoPlayerEventMeta
) => void;

export interface VideoPlayerEventMeta {
  /** Wall-clock epoch ms when the event was emitted */
  timestamp: number;
  videoSrc: string;
  playbackRate: number;
  /** Buffered percentage 0–100 */
  buffer: number;
  fullscreen: boolean;
  volume: number;
  muted: boolean;
  /** Video timeline position in seconds */
  currentTime: number;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  srclang: string;
  src: string;
  default?: boolean;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters";
}

export interface VideoPlayerSource {
  src: string;
  type?: string;
  quality?: string;
}

export interface VideoPlayerProps {
  src: string | VideoPlayerSource[];
  poster?: string;
  title?: string;
  subtitles?: SubtitleTrack[];
  startTime?: number;
  autoPlay?: boolean;
  loop?: boolean;
  defaultVolume?: number;
  defaultPlaybackRate?: number;
  /**
   * When set, the player applies this rate from the adaptive engine.
   * Distinct from user manual speed changes.
   */
  externalPlaybackRate?: number | null;
  seekStep?: number;
  playbackRates?: number[];
  attentionScore?: number | null;
  className?: string;
  onEvent?: VideoPlayerEventHandler;
  onPlay?: (payload: VideoPlayerEventPayload["PLAY"]) => void;
  onPause?: (payload: VideoPlayerEventPayload["PAUSE"]) => void;
  onSeekForward?: (payload: VideoPlayerEventPayload["SEEK_FORWARD"]) => void;
  onSeekBackward?: (payload: VideoPlayerEventPayload["SEEK_BACKWARD"]) => void;
  onSpeedChange?: (payload: VideoPlayerEventPayload["SPEED_CHANGE"]) => void;
  onVideoEnd?: (payload: VideoPlayerEventPayload["VIDEO_END"]) => void;
  onVolumeChange?: (payload: VideoPlayerEventPayload["VOLUME_CHANGE"]) => void;
  onFullscreenChange?: (payload: VideoPlayerEventPayload["FULLSCREEN_CHANGE"]) => void;
  onTimeUpdate?: (payload: VideoPlayerEventPayload["TIME_UPDATE"]) => void;
  onSubtitleChange?: (payload: VideoPlayerEventPayload["SUBTITLE_CHANGE"]) => void;
}

export interface UseVideoPlayerOptions {
  seekStep?: number;
  defaultVolume?: number;
  defaultPlaybackRate?: number;
  startTime?: number;
  videoSrc: string;
  onEvent?: VideoPlayerEventHandler;
  onPlay?: VideoPlayerProps["onPlay"];
  onPause?: VideoPlayerProps["onPause"];
  onSeekForward?: VideoPlayerProps["onSeekForward"];
  onSeekBackward?: VideoPlayerProps["onSeekBackward"];
  onSpeedChange?: VideoPlayerProps["onSpeedChange"];
  onVideoEnd?: VideoPlayerProps["onVideoEnd"];
  onVolumeChange?: VideoPlayerProps["onVolumeChange"];
  onFullscreenChange?: VideoPlayerProps["onFullscreenChange"];
  onTimeUpdate?: VideoPlayerProps["onTimeUpdate"];
  onSubtitleChange?: VideoPlayerProps["onSubtitleChange"];
}

export interface UseVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
  playbackRate: number;
  progress: number;
  activeSubtitleIndex: number | null;
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekForward: (delta?: number) => void;
  seekBackward: (delta?: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleFullscreen: () => Promise<void>;
  setSubtitleTrack: (index: number | null) => void;
  formatTime: (seconds: number) => string;
}
