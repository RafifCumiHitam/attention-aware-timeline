import type { VideoController } from "./video-controller";

/** Minimal YT.Player surface used by the adapter */
export interface YouTubePlayerHandle {
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getPlaybackRate?: () => number;
  setPlaybackRate?: (rate: number) => void;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  getPlayerState?: () => number;
}

/**
 * YouTube IFrame adapter — no YT types leak past this boundary.
 */
export class YouTubeVideoController implements VideoController {
  readonly videoId: string;
  private player: YouTubePlayerHandle;

  constructor(videoId: string, player: YouTubePlayerHandle) {
    this.videoId = videoId;
    this.player = player;
  }

  /** Replace underlying handle after re-init */
  bind(player: YouTubePlayerHandle): void {
    this.player = player;
  }

  isReady(): boolean {
    return typeof this.player.getCurrentTime === "function";
  }

  getCurrentTime(): number {
    return this.player.getCurrentTime?.() ?? 0;
  }

  getDuration(): number {
    return this.player.getDuration?.() ?? 0;
  }

  getPlaybackRate(): number {
    return this.player.getPlaybackRate?.() ?? 1;
  }

  async seekTo(seconds: number): Promise<void> {
    const dur = this.getDuration();
    const target =
      dur > 0 ? Math.max(0, Math.min(seconds, dur)) : Math.max(0, seconds);

    if (!this.player.seekTo) {
      throw new Error("youtube_seek_unavailable");
    }

    this.player.seekTo(target, true);

    // YT does not expose a reliable seeked event on all embeds.
    // Poll currentTime until within tolerance or timeout (bounded, not fixed single sleep).
    const tolerance = 1.0;
    const deadline = performance.now() + 2500;
    while (performance.now() < deadline) {
      const t = this.getCurrentTime();
      if (Math.abs(t - target) <= tolerance) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    // Best effort — do not throw if slightly off; orchestrator may corrective-seek once
  }

  async play(): Promise<void> {
    this.player.playVideo?.();
  }

  async pause(): Promise<void> {
    this.player.pauseVideo?.();
  }

  async setPlaybackRate(rate: number): Promise<void> {
    try {
      this.player.setPlaybackRate?.(rate);
    } catch {
      /* unsupported rate */
    }
  }
}
