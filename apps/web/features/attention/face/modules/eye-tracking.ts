import { LEFT_EYE_EAR, LEFT_IRIS, RIGHT_EYE_EAR, RIGHT_IRIS } from "../constants";
import type { EyeOpenness, GazePoint, LandmarkPoint } from "../types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function irisCenter(landmarks: LandmarkPoint[], indices: readonly number[]) {
  let sx = 0;
  let sy = 0;
  for (const i of indices) {
    sx += landmarks[i].x;
    sy += landmarks[i].y;
  }
  const n = indices.length || 1;
  return { x: sx / n, y: sy / n };
}

export function eyeAspectRatio(
  landmarks: LandmarkPoint[],
  indices: readonly number[]
): number {
  const p = (i: number) => landmarks[indices[i]];
  const dist = (a: LandmarkPoint, b: LandmarkPoint) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const A = dist(p(1), p(5));
  const B = dist(p(2), p(4));
  const C = dist(p(0), p(3));
  return (A + B) / (2 * C + 1e-6);
}

function earToOpenness(ear: number): number {
  return clamp01((ear - 0.12) / (0.35 - 0.12));
}

export interface EyeTrackingResult {
  gaze: GazePoint;
  eyeOpen: EyeOpenness;
  leftEar: number;
  rightEar: number;
}

export function trackEyes(landmarks: LandmarkPoint[]): EyeTrackingResult {
  const hasIris = landmarks.length >= 478;
  let gaze: GazePoint;
  if (hasIris) {
    const left = irisCenter(landmarks, LEFT_IRIS);
    const right = irisCenter(landmarks, RIGHT_IRIS);
    gaze = {
      x: clamp01((left.x + right.x) / 2),
      y: clamp01((left.y + right.y) / 2),
    };
  } else {
    gaze = {
      x: clamp01((landmarks[33].x + landmarks[263].x) / 2),
      y: clamp01((landmarks[33].y + landmarks[263].y) / 2),
    };
  }
  const leftEar = eyeAspectRatio(landmarks, LEFT_EYE_EAR);
  const rightEar = eyeAspectRatio(landmarks, RIGHT_EYE_EAR);
  return {
    gaze,
    eyeOpen: { left: earToOpenness(leftEar), right: earToOpenness(rightEar) },
    leftEar,
    rightEar,
  };
}
