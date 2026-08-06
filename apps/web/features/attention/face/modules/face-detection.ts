import type { LandmarkPoint } from "../types";

export interface FaceDetectionResult {
  faceDetected: boolean;
  confidence: number;
  landmarkCount: number;
}

export function detectFace(
  landmarks: LandmarkPoint[] | null | undefined
): FaceDetectionResult {
  if (!landmarks || landmarks.length < 468) {
    return { faceDetected: false, confidence: 0, landmarkCount: 0 };
  }
  const noseZ = Math.abs(landmarks[1]?.z ?? 0);
  const confidence = Math.max(0, Math.min(1, 1 - noseZ * 2));
  return { faceDetected: true, confidence, landmarkCount: landmarks.length };
}
