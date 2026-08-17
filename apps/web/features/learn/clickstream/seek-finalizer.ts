import type { ClickstreamConfig } from "./config";
import { DEFAULT_CLICKSTREAM_CONFIG } from "./config";
import { zoneIdForTime } from "./zone-counter";
import type { FinalizedSeekEvent, SeekDirection } from "./types";

export interface SeekFinalizerOptions {
  config?: Partial<ClickstreamConfig>;
  onFinalized: (event: FinalizedSeekEvent) => void;
  /** Optional clock for tests */
  now?: () => number;
}

/**
 * Collapses continuous seeking into one finalized seek after idle debounce.
 * Does NOT decide intervention — only classifies distance/direction/meaning.
 */
export class SeekFinalizer {
  private config: ClickstreamConfig;
  private onFinalized: (event: FinalizedSeekEvent) => void;
  private now: () => number;

  private origin: number | null = null;
  private latest: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playbackRate = 1;

  constructor(opts: SeekFinalizerOptions) {
    this.config = { ...DEFAULT_CLICKSTREAM_CONFIG, ...opts.config };
    this.onFinalized = opts.onFinalized;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Call on each intermediate seeking position (drag) */
  noteSeeking(currentTime: number, playbackRate = 1): void {
    this.playbackRate = playbackRate;
    if (this.origin == null) this.origin = currentTime;
    this.latest = currentTime;
    this.armTimer();
  }

  /**
   * Call when a discrete seek completes (HTML5 seeked / YT jump).
   * from = previous stable time, to = new time.
   */
  noteSeekJump(from: number, to: number, playbackRate = 1): void {
    this.playbackRate = playbackRate;
    if (this.origin == null) this.origin = from;
    this.latest = to;
    this.armTimer();
  }

  /** Force finalize immediately (e.g. pause / unmount) */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.finalize();
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.origin = null;
    this.latest = null;
  }

  private armTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.finalize(), this.config.seekFinalizeMs);
  }

  private finalize(): void {
    this.timer = null;
    if (this.origin == null || this.latest == null) return;

    const from = this.origin;
    const to = this.latest;
    this.origin = null;
    this.latest = null;

    const distance = Math.abs(to - from);
    const direction: SeekDirection =
      to > from + 1e-6 ? "FORWARD" : to < from - 1e-6 ? "BACKWARD" : "NONE";

    if (direction === "NONE" && distance < 0.05) return;

    const isMeaningful =
      distance >= this.config.minMeaningfulSeekDistanceSeconds && direction !== "NONE";

    const zoneSize = this.config.zoneSizeSeconds;
    const event: FinalizedSeekEvent = {
      type:
        direction === "FORWARD"
          ? "FORWARD_SEEK"
          : direction === "BACKWARD"
            ? "BACKWARD_SEEK"
            : "SEEK",
      from,
      to,
      distance,
      direction,
      isMeaningful,
      targetZoneId: zoneIdForTime(to, zoneSize),
      sourceZoneId: zoneIdForTime(from, zoneSize),
      wallClockMs: this.now(),
      playbackRate: this.playbackRate,
    };
    this.onFinalized(event);
  }
}

/** Pure helper for tests — classify without debounce */
export function classifySeek(
  from: number,
  to: number,
  config: Partial<ClickstreamConfig> = {}
): Omit<FinalizedSeekEvent, "wallClockMs" | "playbackRate"> {
  const cfg = { ...DEFAULT_CLICKSTREAM_CONFIG, ...config };
  const distance = Math.abs(to - from);
  const direction: SeekDirection =
    to > from + 1e-6 ? "FORWARD" : to < from - 1e-6 ? "BACKWARD" : "NONE";
  const isMeaningful =
    distance >= cfg.minMeaningfulSeekDistanceSeconds && direction !== "NONE";
  return {
    type:
      direction === "FORWARD"
        ? "FORWARD_SEEK"
        : direction === "BACKWARD"
          ? "BACKWARD_SEEK"
          : "SEEK",
    from,
    to,
    distance,
    direction,
    isMeaningful,
    targetZoneId: zoneIdForTime(to, cfg.zoneSizeSeconds),
    sourceZoneId: zoneIdForTime(from, cfg.zoneSizeSeconds),
  };
}
