/**
 * MediaPipe Face Landmarker — runs ONLY inside this Web Worker.
 * Main thread must never call detectForVideo().
 */

/// <reference lib="webworker" />

import { detectBlink } from "../modules/blink-detection";
import { detectFace } from "../modules/face-detection";
import { trackEyes } from "../modules/eye-tracking";
import { estimateHeadPose } from "../modules/head-pose";
import type { FaceLandmarkResult, LandmarkPoint } from "../types";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./worker-protocol";

type MpFaceLandmarker = {
  detectForVideo: (
    input: ImageBitmap | OffscreenCanvas,
    timestampMs: number
  ) => { faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> };
  close: () => void;
};

type MpVisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  FaceLandmarker: {
    createFromOptions: (
      vision: unknown,
      options: Record<string, unknown>
    ) => Promise<MpFaceLandmarker>;
  };
};

const MEDIAPIPE_ESM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm";

let landmarker: MpFaceLandmarker | null = null;
let closedFrames = 0;
let offscreen: OffscreenCanvas | null = null;
let offCtx: OffscreenCanvasRenderingContext2D | null = null;

function post(msg: WorkerToMainMessage): void {
  self.postMessage(msg);
}

function toPoints(
  raw: Array<{ x: number; y: number; z: number }>
): LandmarkPoint[] {
  return raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));
}

function emptyResult(timestamp: number): FaceLandmarkResult {
  return {
    gaze: { x: 0.5, y: 0.5 },
    eye_open: { left: 0, right: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    timestamp,
    face_detected: false,
    tracking_confidence: 0,
    blink_detected: false,
  };
}

async function loadVision(): Promise<MpVisionModule> {
  // Dynamic import in worker — same CDN package as main-thread engine used
  const mod = (await import(
    /* webpackIgnore: true */ MEDIAPIPE_ESM
  )) as MpVisionModule;
  return mod;
}

async function initLandmarker(config: {
  wasmPath: string;
  modelAssetPath: string;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}): Promise<void> {
  const { FilesetResolver, FaceLandmarker } = await loadVision();

  const create = async (delegate: "GPU" | "CPU") => {
    const vision = await FilesetResolver.forVisionTasks(config.wasmPath);
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: config.modelAssetPath,
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: config.minDetectionConfidence,
      minFacePresenceConfidence: config.minDetectionConfidence,
      minTrackingConfidence: config.minTrackingConfidence,
    });
  };

  try {
    landmarker = await create("GPU");
  } catch {
    landmarker = await create("CPU");
  }
}

function ensureCanvas(w: number, h: number): OffscreenCanvas {
  if (!offscreen || offscreen.width !== w || offscreen.height !== h) {
    offscreen = new OffscreenCanvas(w, h);
    offCtx = offscreen.getContext("2d");
  }
  return offscreen;
}

function mapResult(
  mp: { faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> },
  latencyMs: number
): FaceLandmarkResult {
  const timestamp = Date.now() / 1000;
  if (!mp.faceLandmarks?.length) {
    closedFrames = 0;
    return {
      ...emptyResult(timestamp),
      latency_ms: Math.round(latencyMs * 10) / 10,
    };
  }

  const landmarks = toPoints(mp.faceLandmarks[0]);
  const detection = detectFace(landmarks);
  const eyes = trackEyes(landmarks);
  const pose = estimateHeadPose(landmarks);
  const blink = detectBlink(
    eyes.leftEar,
    eyes.rightEar,
    undefined,
    closedFrames
  );
  closedFrames = blink.closedFrames;

  return {
    gaze: eyes.gaze,
    eye_open: eyes.eyeOpen,
    yaw: pose.yaw,
    pitch: pose.pitch,
    roll: pose.roll,
    timestamp,
    face_detected: detection.faceDetected,
    tracking_confidence: detection.confidence,
    blink_detected: blink.blinkDetected,
    latency_ms: Math.round(latencyMs * 10) / 10,
  };
}

function processFrame(bitmap: ImageBitmap, timestampMs: number, frameId: number): void {
  if (!landmarker) {
    try {
      bitmap.close();
    } catch {
      /* ignore */
    }
    post({ type: "ERROR", message: "Landmarker not initialized" });
    return;
  }

  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = ensureCanvas(w, h);
  const ctx = offCtx;

  try {
    const t0 = performance.now();
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, w, h);
      const mp = landmarker.detectForVideo(canvas, timestampMs);
      const inferenceMs = performance.now() - t0;
      const result = mapResult(mp, inferenceMs);
      post({
        type: "RESULT",
        frameId,
        result,
        inferenceMs,
        inputWidth: w,
        inputHeight: h,
      });
    } else {
      // Fallback: pass ImageBitmap directly if OffscreenCanvas 2d unavailable
      const mp = landmarker.detectForVideo(bitmap, timestampMs);
      const inferenceMs = performance.now() - t0;
      const result = mapResult(mp, inferenceMs);
      post({
        type: "RESULT",
        frameId,
        result,
        inferenceMs,
        inputWidth: w,
        inputHeight: h,
      });
    }
  } catch (err) {
    post({
      type: "ERROR",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    try {
      bitmap.close();
    } catch {
      /* ignore */
    }
  }
}

self.onmessage = async (ev: MessageEvent<MainToWorkerMessage>) => {
  const data = ev.data;
  if (!data || typeof data !== "object") return;

  try {
    if (data.type === "INIT") {
      await initLandmarker(data.config);
      post({ type: "READY" });
      return;
    }

    if (data.type === "FRAME") {
      processFrame(data.bitmap, data.timestampMs, data.frameId);
      return;
    }

    if (data.type === "CLOSE") {
      landmarker?.close();
      landmarker = null;
      offscreen = null;
      offCtx = null;
      return;
    }
  } catch (err) {
    post({
      type: "ERROR",
      message: err instanceof Error ? err.message : String(err),
      fatal: data.type === "INIT",
    });
  }
};

export {};
