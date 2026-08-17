import type { ExperimentCondition } from "./config";

/** Neutral behavioral direction — not "confusion" */
export type SeekDirection = "FORWARD" | "BACKWARD" | "NONE";

export type ClickstreamEventType =
  | "PLAY"
  | "PAUSE"
  | "SEEK"
  | "FORWARD_SEEK"
  | "BACKWARD_SEEK"
  | "SPEED_CHANGE"
  | "USER_MANUAL_SPEED_CHANGE"
  | "ADAPTIVE_SPEED_CHANGE"
  | "VIDEO_END"
  | "REMEDIAL_OPENED"
  | "REMEDIAL_COMPLETED"
  | "REMEDIAL_DISMISSED"
  | "REMEDIAL_RESUMED"
  | "INTERVENTION_CANDIDATE"
  | "INTERVENTION_TRIGGERED";

export interface FinalizedSeekEvent {
  type: "FORWARD_SEEK" | "BACKWARD_SEEK" | "SEEK";
  from: number;
  to: number;
  distance: number;
  direction: SeekDirection;
  isMeaningful: boolean;
  targetZoneId: number;
  sourceZoneId: number;
  wallClockMs: number;
  playbackRate: number;
}

export interface ZoneStats {
  zoneId: number;
  meaningfulEntries: number;
  backwardReturns: number;
  revisitCount: number;
  behavioralPressure: number;
}

export type InterventionState =
  | "IDLE"
  | "CANDIDATE"
  | "NOTIFYING"
  | "REMEDIAL_ACTIVE"
  | "RESUMING"
  | "COOLDOWN";

export interface InterventionContext {
  sessionId: string;
  videoId: string;
  moduleId?: string | null;
  experimentCondition: ExperimentCondition;
  state: InterventionState;
  isRemedialActive: boolean;
  interventionZoneId: number | null;
  resumeTimestamp: number | null;
  interventionTimestamp: number | null;
  cooldownUntilMs: number | null;
  lastAttention: number | null;
}

export interface InterventionDecision {
  shouldNotify: boolean;
  shouldOpenRemedial: boolean;
  reason: string[];
  zoneId: number | null;
  resumeTimestamp: number | null;
  attentionScore: number | null;
  behavioralPressure: number;
}

export interface ResearchEventMeta {
  video_time_from?: number;
  video_time_to?: number;
  seek_distance?: number;
  seek_direction?: SeekDirection;
  is_meaningful?: boolean;
  target_zone_id?: number;
  source_zone_id?: number;
  triggered_intervention?: boolean;
  triggered_remedial?: boolean;
  speed_change_source?: "user" | "adaptive" | "unknown";
  intervention_state?: InterventionState;
  behavioral_pressure?: number;
  experiment_condition?: ExperimentCondition;
  raw_vs_derived?: "raw" | "derived";
}
