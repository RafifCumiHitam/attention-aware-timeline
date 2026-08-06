import {
  CHIN,
  FOREHEAD,
  LEFT_EYE_OUTER,
  NOSE_TIP,
  RIGHT_EYE_OUTER,
} from "../constants";
import type { LandmarkPoint } from "../types";

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function estimateHeadPose(landmarks: LandmarkPoint[]): HeadPose {
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  const nose = landmarks[NOSE_TIP];
  const chin = landmarks[CHIN];
  const forehead = landmarks[FOREHEAD];

  const rollRad = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const roll = (rollRad * 180) / Math.PI;

  const midEyeX = (leftEye.x + rightEye.x) / 2;
  const eyeDist =
    Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) || 1e-6;
  const yaw = clamp(((nose.x - midEyeX) / eyeDist) * 60, -90, 90);

  const faceH =
    Math.hypot(chin.x - forehead.x, chin.y - forehead.y) || 1e-6;
  const midEyeY = (leftEye.y + rightEye.y) / 2;
  const pitch = clamp(((midEyeY - nose.y) / faceH) * 90, -90, 90);

  return {
    yaw: Math.round(yaw * 100) / 100,
    pitch: Math.round(pitch * 100) / 100,
    roll: Math.round(roll * 100) / 100,
  };
}
