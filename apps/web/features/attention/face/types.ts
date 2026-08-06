export interface GazePoint {
  x: number;
  y: number;
}

export interface EyeOpenness {
  left: number;
  right: number;
}

export interface FaceLandmarkResult {
  gaze: GazePoint;
  eye_open: EyeOpenness;
  yaw: number;
  pitch: number;
  roll: number;
  timestamp: number;
  face_detected: boolean;
  tracking_confidence: number;
  blink_detected: boolean;
  latency_ms?: number;
  fps?: number;
}

export interface FaceLandmarkerOptions {
  targetFps?: number;
  maxWidth?: number;
  wasmPath?: string;
  modelAssetPath?: string;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  onResult?: (result: FaceLandmarkResult) => void;
  onError?: (error: Error) => void;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}
