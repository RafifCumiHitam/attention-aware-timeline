/**
 * Sprint 20 — configurable research thresholds (no magic numbers in logic).
 */

export interface ClickstreamConfig {
  /** Debounce before finalizing a continuous seek drag */
  seekFinalizeMs: number;
  /** Minimum |to-from| to count as meaningful behavioral seek */
  minMeaningfulSeekDistanceSeconds: number;
  /** Same threshold for revisit counting */
  minRevisitSeekDistanceSeconds: number;
  /** Zone size for floor(t / zoneSize) */
  zoneSizeSeconds: number;
  /** Attention score below this is attention_low */
  lowAttentionThreshold: number;
  /** Cooldown after remedial before next intervention */
  interventionCooldownSeconds: number;
  /** Meaningful backward returns into a zone before pressure qualifies */
  requiredRevisits: number;
  /** Pre-intervention toast duration */
  notifyDurationMs: number;
  /** Behavioral pressure score weight for revisits */
  pressurePerRevisit: number;
  /** Min pressure (0–1 scale-ish) to qualify with other signals */
  minBehavioralPressure: number;
}

export const DEFAULT_CLICKSTREAM_CONFIG: ClickstreamConfig = {
  seekFinalizeMs: 300,
  minMeaningfulSeekDistanceSeconds: 5,
  minRevisitSeekDistanceSeconds: 5,
  zoneSizeSeconds: 10,
  lowAttentionThreshold: 0.4,
  interventionCooldownSeconds: 15,
  requiredRevisits: 2,
  notifyDurationMs: 2000,
  pressurePerRevisit: 0.35,
  minBehavioralPressure: 0.7,
};

export type ExperimentCondition = "CONTROL" | "EXPERIMENTAL";
