/**
 * Session-safe resume after remedial intervention.
 * Uses VideoController only — InterventionEngine stays free of player APIs.
 */

import type { InterventionContext } from "../clickstream/types";
import type { ResumeCommand, ResumeResult, VideoController } from "./video-controller";

export interface ResumeOrchestratorOptions {
  /** Expected active session id */
  sessionId: string;
  /** Expected active internal video UUID */
  videoId: string;
  getController: () => VideoController | null;
  /** Tolerance when verifying seek landed */
  seekToleranceSeconds?: number;
}

/**
 * Build a resume command from intervention context (destination timestamp).
 */
export function resumeCommandFromContext(
  ctx: InterventionContext,
  playAfterSeek = true
): ResumeCommand | null {
  if (ctx.resumeTimestamp == null || !Number.isFinite(ctx.resumeTimestamp)) {
    return null;
  }
  return {
    sessionId: ctx.sessionId,
    videoId: ctx.videoId,
    resumeTimestamp: ctx.resumeTimestamp,
    interventionActive: ctx.isRemedialActive || ctx.state === "REMEDIAL_ACTIVE" || ctx.state === "RESUMING",
    playAfterSeek,
  };
}

export class ResumeOrchestrator {
  private sessionId: string;
  private videoId: string;
  private getController: () => VideoController | null;
  private seekTolerance: number;
  private inFlight: Promise<ResumeResult> | null = null;
  private generation = 0;

  constructor(opts: ResumeOrchestratorOptions) {
    this.sessionId = opts.sessionId;
    this.videoId = opts.videoId;
    this.getController = opts.getController;
    this.seekTolerance = opts.seekToleranceSeconds ?? 1.25;
  }

  /** Call when user navigates to another session/video */
  rebind(sessionId: string, videoId: string): void {
    this.sessionId = sessionId;
    this.videoId = videoId;
    this.generation += 1;
    this.inFlight = null;
  }

  /**
   * Execute resume: pause → seekTo → play (optional).
   * Rejects stale session/video and concurrent overlapping resumes (latest wins via generation).
   */
  async resume(cmd: ResumeCommand): Promise<ResumeResult> {
    const gen = this.generation;

    if (cmd.sessionId !== this.sessionId) {
      return { ok: false, reason: "stale_session" };
    }
    if (cmd.videoId !== this.videoId) {
      return { ok: false, reason: "wrong_video" };
    }

    const controller = this.getController();
    if (!controller) {
      return { ok: false, reason: "no_controller" };
    }
    if (controller.videoId !== this.videoId) {
      return { ok: false, reason: "controller_video_mismatch" };
    }
    if (!controller.isReady()) {
      return { ok: false, reason: "controller_not_ready" };
    }

    const run = async (): Promise<ResumeResult> => {
      try {
        await controller.pause();
        if (gen !== this.generation) {
          return { ok: false, reason: "superseded" };
        }

        const target = Math.max(0, cmd.resumeTimestamp);
        await controller.seekTo(target);

        if (gen !== this.generation) {
          return { ok: false, reason: "superseded" };
        }

        // Best-effort verification without fixed sleep hacks as primary sync:
        // adapters resolve seekTo when the underlying API reports completion.
        const landed = controller.getCurrentTime();
        if (Math.abs(landed - target) > this.seekTolerance) {
          // One corrective seek if adapter reported early
          await controller.seekTo(target);
        }

        if (cmd.playAfterSeek !== false) {
          await controller.play();
        }

        if (gen !== this.generation) {
          return { ok: false, reason: "superseded" };
        }

        return { ok: true, appliedAt: controller.getCurrentTime() };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : "resume_failed",
        };
      }
    };

    // Serialize multiple resume requests on the same orchestrator
    const pending = this.inFlight
      ? this.inFlight.then(() => run(), () => run())
      : run();
    this.inFlight = pending.finally(() => {
      if (this.inFlight === pending) this.inFlight = null;
    });
    return pending;
  }
}
