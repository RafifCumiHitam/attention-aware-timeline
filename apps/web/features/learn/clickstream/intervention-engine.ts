/**
 * Deterministic InterventionEngine — no React, no DOM.
 * Combines meaningful backward seek + zone pressure + low attention.
 * Never labels a single signal as "confusion".
 */

import type { ClickstreamConfig, ExperimentCondition } from "./config";
import { DEFAULT_CLICKSTREAM_CONFIG } from "./config";
import { ZoneCounter } from "./zone-counter";
import type {
  FinalizedSeekEvent,
  InterventionContext,
  InterventionDecision,
  InterventionState,
} from "./types";

export interface InterventionEngineOptions {
  sessionId: string;
  videoId: string;
  moduleId?: string | null;
  experimentCondition?: ExperimentCondition;
  config?: Partial<ClickstreamConfig>;
  now?: () => number;
}

export class InterventionEngine {
  readonly zones: ZoneCounter;
  private config: ClickstreamConfig;
  private now: () => number;
  private ctx: InterventionContext;
  private attention: number | null = null;

  constructor(opts: InterventionEngineOptions) {
    this.config = { ...DEFAULT_CLICKSTREAM_CONFIG, ...opts.config };
    this.now = opts.now ?? (() => Date.now());
    this.zones = new ZoneCounter(this.config);
    this.ctx = {
      sessionId: opts.sessionId,
      videoId: opts.videoId,
      moduleId: opts.moduleId ?? null,
      experimentCondition: opts.experimentCondition ?? "EXPERIMENTAL",
      state: "IDLE",
      isRemedialActive: false,
      interventionZoneId: null,
      resumeTimestamp: null,
      interventionTimestamp: null,
      cooldownUntilMs: null,
      lastAttention: null,
    };
  }

  getContext(): InterventionContext {
    return { ...this.ctx };
  }

  setAttention(score: number | null): void {
    this.attention = score;
    this.ctx.lastAttention = score;
  }

  setExperimentCondition(c: ExperimentCondition): void {
    this.ctx.experimentCondition = c;
  }

  /**
   * Process a finalized seek. Returns intervention decision (may be no-op).
   * During REMEDIAL_ACTIVE / COOLDOWN / CONTROL: no intervention trigger.
   */
  onSeek(seek: FinalizedSeekEvent): InterventionDecision {
    const zone = this.zones.applySeek(seek);
    const pressure = zone?.behavioralPressure ?? 0;

    const reasons: string[] = [];
    const decision: InterventionDecision = {
      shouldNotify: false,
      shouldOpenRemedial: false,
      reason: reasons,
      zoneId: seek.targetZoneId,
      resumeTimestamp: seek.to,
      attentionScore: this.attention,
      behavioralPressure: pressure,
    };

    if (this.ctx.experimentCondition === "CONTROL") {
      reasons.push("experiment_condition_CONTROL");
      return decision;
    }

    if (this.ctx.isRemedialActive || this.ctx.state === "REMEDIAL_ACTIVE") {
      reasons.push("remedial_active_guard");
      return decision;
    }

    if (this.ctx.state === "NOTIFYING" || this.ctx.state === "RESUMING") {
      reasons.push(`state_${this.ctx.state}`);
      return decision;
    }

    if (this.ctx.cooldownUntilMs != null && this.now() < this.ctx.cooldownUntilMs) {
      reasons.push("cooldown_active");
      return decision;
    }

    if (!seek.isMeaningful) {
      reasons.push("seek_not_meaningful");
      return decision;
    }

    if (seek.direction !== "BACKWARD") {
      reasons.push("not_backward_seek");
      return decision;
    }

    const lowAtt =
      this.attention != null && this.attention < this.config.lowAttentionThreshold;
    if (!lowAtt) {
      reasons.push("attention_not_low");
      return decision;
    }
    reasons.push("attention_low");

    const pressureOk =
      pressure >= this.config.minBehavioralPressure ||
      (zone != null && zone.revisitCount >= this.config.requiredRevisits);
    if (!pressureOk) {
      reasons.push("behavioral_pressure_insufficient");
      return decision;
    }
    reasons.push("high_behavioral_pressure");
    reasons.push("meaningful_backward_seek");

    // Eligible → NOTIFYING
    this.ctx.state = "NOTIFYING";
    this.ctx.interventionZoneId = seek.targetZoneId;
    this.ctx.resumeTimestamp = seek.to;
    this.ctx.interventionTimestamp = seek.to;
    decision.shouldNotify = true;
    decision.reason = reasons;
    return decision;
  }

  /** After notify duration — open remedial */
  confirmRemedial(): void {
    if (this.ctx.state !== "NOTIFYING") return;
    this.ctx.state = "REMEDIAL_ACTIVE";
    this.ctx.isRemedialActive = true;
  }

  completeRemedial(): void {
    if (this.ctx.interventionZoneId != null) {
      this.zones.resetZone(this.ctx.interventionZoneId);
    }
    this.ctx.state = "COOLDOWN";
    this.ctx.isRemedialActive = false;
    this.ctx.cooldownUntilMs =
      this.now() + this.config.interventionCooldownSeconds * 1000;
  }

  dismissRemedial(): void {
    this.ctx.state = "COOLDOWN";
    this.ctx.isRemedialActive = false;
    this.ctx.cooldownUntilMs =
      this.now() + this.config.interventionCooldownSeconds * 1000;
  }

  /** Leave cooldown when timer expires */
  tick(): InterventionState {
    if (
      this.ctx.state === "COOLDOWN" &&
      this.ctx.cooldownUntilMs != null &&
      this.now() >= this.ctx.cooldownUntilMs
    ) {
      this.ctx.state = "IDLE";
      this.ctx.cooldownUntilMs = null;
      this.ctx.interventionZoneId = null;
    }
    return this.ctx.state;
  }

  /** Hard reset when switching sessions */
  resetForSession(sessionId: string, videoId: string): void {
    this.zones.clear();
    this.ctx = {
      ...this.ctx,
      sessionId,
      videoId,
      state: "IDLE",
      isRemedialActive: false,
      interventionZoneId: null,
      resumeTimestamp: null,
      interventionTimestamp: null,
      cooldownUntilMs: null,
    };
  }
}
