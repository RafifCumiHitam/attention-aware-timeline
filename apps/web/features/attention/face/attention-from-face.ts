import type { FaceLandmarkResult } from "./types";

/**
 * Derive a 0–1 attention score from face landmarks (no emotion model).
 * Used to feed adaptive playback / event logger from browser Face Landmarker.
 */
export function attentionScoreFromFace(r: FaceLandmarkResult | null): number {
  if (!r || !r.face_detected) return 0.2;

  const eyeOpen = (r.eye_open.left + r.eye_open.right) / 2;
  const gazeCenter =
    1 - Math.min(1, Math.hypot(r.gaze.x - 0.5, r.gaze.y - 0.5) * 2);
  const faceOn =
    1 -
    Math.min(1, (Math.abs(r.yaw) / 45 + Math.abs(r.pitch) / 35) / 2);
  const blinkPenalty = r.blink_detected ? 0.15 : 0;

  const raw =
    0.35 * eyeOpen + 0.35 * gazeCenter + 0.3 * faceOn - blinkPenalty;
  return Math.max(0, Math.min(1, raw));
}
