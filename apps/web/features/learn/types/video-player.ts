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
  timestamp: number;
  videoSrc: string;
  playbackRate: number;
  /** Buffered percentage 0–100 */
  buffer: number;
  /** Fullscreen state at event time */
  fullscreen: boolean;
  volume: number;
  muted: boolean;
  currentTime: number;
}

export interface SubtitleTrack {
  /** Unique id */
  id: string;
  /** Display label e.g. "English" */
  label: string;
  /** BCP 47 language code */
  srclang: string;
  /** URL to .vtt file */
  src: string;
  /** Default selected */
  default?: boolean;
  /** kind attribute */
  kind?: "subtitles" | "captions" | "descriptions" | "chapters";
}

export interface VideoPlayerSource {
  src: string;
  type?: string;
  quality?: string;
}

export interface VideoPlayerProps {
  /** Primary video URL (or multiple sources) */
  src: string | VideoPlayerSource[];
  /** Poster image */
  poster?: string;
  /** Video title shown in UI */
  title?: string;
  /** Subtitle / caption tracks */
  subtitles?: SubtitleTrack[];
  /** Start time in seconds */
  startTime?: number;
  /** Auto play (may be blocked by browser) */
  autoPlay?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Initial volume 0–1 */
  defaultVolume?: number;
  /** Initial playback rate */
  defaultPlaybackRate?: number;
  /** Seek step for keyboard / buttons (seconds) */
  seekStep?: number;
  /** Available speed options */
  playbackRates?: number[];
  /** Show attention overlay badge */
  attentionScore?: number | null;
  /** CSS class for outer container */
  className?: string;
  /** Unified event callback — fired for every logged action */
  onEvent?: VideoPlayerEventHandler;
  /** Individual callbacks (optional convenience) */
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
