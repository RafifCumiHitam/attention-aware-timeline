/**
 * Browser MediaPipe Face Landmarker.
 * Default ~10 FPS inference (not 30) — keeps camera preview smooth while cutting CPU.
 */
import { DEFAULT_MODEL_URL, DEFAULT_WASM_PATH } from "./constants";
import { detectBlink } from "./modules/blink-detection";
import { detectFace } from "./modules/face-detection";
import { trackEyes } from "./modules/eye-tracking";
import { estimateHeadPose } from "./modules/head-pose";
import type {
  FaceLandmarkResult,
  FaceLandmarkerOptions,
  LandmarkPoint,
} from "./types";

type MpFaceLandmarker = {
  detectForVideo: (
    input: HTMLVideoElement | HTMLCanvasElement,
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

let visionModulePromise: Promise<MpVisionModule> | null = null;

function runtimeImport(specifier: string): Promise<MpVisionModule> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const importer = new Function(
    "s",
    "return import(s)"
  ) as (s: string) => Promise<MpVisionModule>;
  return importer(specifier);
}

function loadVisionModule(): Promise<MpVisionModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("FaceLandmarker only runs in the browser"));
  }
  if (!visionModulePromise) {
    visionModulePromise = runtimeImport(MEDIAPIPE_ESM);
  }
  return visionModulePromise;
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

function toPoints(
  raw: Array<{ x: number; y: number; z: number }>
): LandmarkPoint[] {
  return raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));
}

export class FaceLandmarkerEngine {
  private landmarker: MpFaceLandmarker | null = null;
  private opts: Required<
    Pick<
      FaceLandmarkerOptions,
      | "targetFps"
      | "maxWidth"
      | "wasmPath"
      | "modelAssetPath"
      | "minDetectionConfidence"
      | "minTrackingConfidence"
    >
  > &
    FaceLandmarkerOptions;
  private running = false;
  private busy = false;
  private rafId: number | null = null;
  private lastTs = 0;
  private lastEmit = 0;
  private frameInterval: number;
  private closedFrames = 0;
  private fpsWindow: number[] = [];
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(options: FaceLandmarkerOptions = {}) {
    this.opts = {
      // Attention heuristics do not need 30 FPS inference on a laptop.
      targetFps: options.targetFps ?? 10,
      maxWidth: options.maxWidth ?? 480,
      wasmPath: options.wasmPath ?? DEFAULT_WASM_PATH,
      modelAssetPath: options.modelAssetPath ?? DEFAULT_MODEL_URL,
      minDetectionConfidence: options.minDetectionConfidence ?? 0.5,
      minTrackingConfidence: options.minTrackingConfidence ?? 0.5,
      onResult: options.onResult,
      onError: options.onError,
    };
    this.frameInterval = 1000 / this.opts.targetFps;
  }

  async init(): Promise<void> {
    const { FilesetResolver, FaceLandmarker } = await loadVisionModule();

    const create = async (delegate: "GPU" | "CPU") => {
      const vision = await FilesetResolver.forVisionTasks(this.opts.wasmPath);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.opts.modelAssetPath,
          delegate,
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: this.opts.minDetectionConfidence,
        minFacePresenceConfidence: this.opts.minDetectionConfidence,
        minTrackingConfidence: this.opts.minTrackingConfidence,
      });
    };

    try {
      this.landmarker = await create("GPU");
    } catch {
      this.landmarker = await create("CPU");
    }

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false });
  }

  start(video: HTMLVideoElement): void {
    if (!this.landmarker) throw new Error("Call init() first");
    this.video = video;
    this.running = true;
    this.lastTs = 0;
    this.lastEmit = 0;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  async close(): Promise<void> {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  analyzeVideoFrame(
    video: HTMLVideoElement,
    timestampMs: number
  ): FaceLandmarkResult {
    if (!this.landmarker) return emptyResult(timestampMs / 1000);
    const t0 = performance.now();
    const input = this.maybeDownscale(video);
    const mp = this.landmarker.detectForVideo(input, timestampMs);
    return this.mapResult(mp, t0);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const video = this.video;
    if (!video || video.readyState < 2) return;
    const now = performance.now();
    if (now - this.lastEmit < this.frameInterval || this.busy) return;
    this.busy = true;
    this.lastEmit = now;
    try {
      if (now <= this.lastTs) return;
      this.lastTs = now;
      const result = this.analyzeVideoFrame(video, now);
      this.opts.onResult?.(result);
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.busy = false;
    }
  };

  private maybeDownscale(
    video: HTMLVideoElement
  ): HTMLVideoElement | HTMLCanvasElement {
    const maxW = this.opts.maxWidth;
    if (video.videoWidth <= maxW || !this.canvas || !this.ctx) return video;
    const scale = maxW / video.videoWidth;
    const w = maxW;
    const h = Math.round(video.videoHeight * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.drawImage(video, 0, 0, w, h);
    return this.canvas;
  }

  private mapResult(
    mp: { faceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> },
    t0: number
  ): FaceLandmarkResult {
    const timestamp = Date.now() / 1000;
    const latency = performance.now() - t0;
    this.fpsWindow.push(performance.now());
    if (this.fpsWindow.length > 30) this.fpsWindow.shift();
    let fps = 0;
    if (this.fpsWindow.length >= 2) {
      const dt =
        (this.fpsWindow[this.fpsWindow.length - 1] - this.fpsWindow[0]) /
        (this.fpsWindow.length - 1);
      fps = dt > 0 ? Math.round(1000 / dt) : 0;
    }
    if (!mp.faceLandmarks?.length) {
      this.closedFrames = 0;
      return {
        ...emptyResult(timestamp),
        latency_ms: Math.round(latency * 10) / 10,
        fps,
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
      this.closedFrames
    );
    this.closedFrames = blink.closedFrames;
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
      latency_ms: Math.round(latency * 10) / 10,
      fps,
    };
  }
}
