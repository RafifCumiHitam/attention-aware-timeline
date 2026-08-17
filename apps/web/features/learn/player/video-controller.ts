/**
 * Unified media-control contract (Sprint 20.2).
 * Intervention / resume layers depend only on this — never HTMLVideoElement or YT.Player.
 */

export interface VideoController {
  /** Bound learning video UUID (internal id), for session safety */
  readonly videoId: string;

  getCurrentTime(): number;
  getDuration(): number;
  isReady(): boolean;

  /** Seek to timeline seconds; resolves when seek is applied (best-effort). */
  seekTo(seconds: number): Promise<void>;

  play(): Promise<void>;
  pause(): Promise<void>;

  setPlaybackRate(rate: number): Promise<void>;
  getPlaybackRate(): number;
}

export interface ResumeCommand {
  sessionId: string;
  videoId: string;
  resumeTimestamp: number;
  /** Optional: only resume if intervention still matches */
  interventionActive?: boolean;
  playAfterSeek?: boolean;
}

export type ResumeResult =
  | { ok: true; appliedAt: number }
  | { ok: false; reason: string };
