import type { VideoController } from "./video-controller";

/**
 * HTML5 adapter — wraps HTMLVideoElement without leaking it to intervention code.
 */
export class Html5VideoController implements VideoController {
  readonly videoId: string;
  private el: HTMLVideoElement;

  constructor(videoId: string, el: HTMLVideoElement) {
    this.videoId = videoId;
    this.el = el;
  }

  isReady(): boolean {
    return this.el.readyState >= 1;
  }

  getCurrentTime(): number {
    return this.el.currentTime || 0;
  }

  getDuration(): number {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }

  getPlaybackRate(): number {
    return this.el.playbackRate || 1;
  }

  async seekTo(seconds: number): Promise<void> {
    const dur = this.getDuration();
    const target =
      dur > 0 ? Math.max(0, Math.min(seconds, dur)) : Math.max(0, seconds);

    if (Math.abs(this.el.currentTime - target) < 0.05) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("html5_seek_error"));
      };
      const cleanup = () => {
        this.el.removeEventListener("seeked", onSeeked);
        this.el.removeEventListener("error", onError);
      };
      this.el.addEventListener("seeked", onSeeked, { once: true });
      this.el.addEventListener("error", onError, { once: true });
      try {
        this.el.currentTime = target;
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error("html5_seek_throw"));
      }
    });
  }

  async play(): Promise<void> {
    try {
      await this.el.play();
    } catch {
      // Autoplay policies may block; intervention still completed seek
    }
  }

  async pause(): Promise<void> {
    this.el.pause();
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.el.playbackRate = rate;
  }
}
