/**
 * Main-thread Face Landmarker engine (Phase 12).
 *
 * - Camera / frame scheduling on main thread
 * - detectForVideo() ONLY inside face-landmarker.worker.ts
 * - ImageBitmap transfer + latest-frame-wins (no queue buildup)
 * - UI callbacks throttled by consumers; this engine does not set React state
 */

import { DEFAULT_MODEL_URL, DEFAULT_WASM_PATH } from "./constants";
import type { FaceLandmarkResult, FaceLandmarkerOptions } from "./types";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "./workers/worker-protocol";
import { DISABLE_FACE_INFERENCE, PERF_DEBUG } from "@/lib/perf-flags";

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

export class FaceLandmarkerEngine {
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

  private worker: Worker | null = null;
  private workerReady = false;
  private running = false;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private rvfcHandle: number | null = null;

  private frameInterval: number;
  private lastSubmitted = 0;
  private frameId = 0;

  /** Latest-frame-wins */
  private workerBusy = false;
  private pendingBitmap: ImageBitmap | null = null;
  private pendingTimestamp = 0;
  private pendingFrameId = 0;

  // Perf aggregates
  private submitted = 0;
  private processed = 0;
  private dropped = 0;
  private inferMs: number[] = [];
  private rttMs: number[] = [];
  private submitTimes = new Map<number, number>();
  private lastPerfLog = 0;
  private lastInputW = 0;
  private lastInputH = 0;

  constructor(options: FaceLandmarkerOptions = {}) {
    this.opts = {
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
    if (DISABLE_FACE_INFERENCE) {
      this.workerReady = true;
      return;
    }

    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are not available in this environment");
    }

    // Webpack / Next.js worker bundling
    this.worker = new Worker(
      new URL("./workers/face-landmarker.worker.ts", import.meta.url)
    );

    this.worker.onmessage = (ev: MessageEvent<WorkerToMainMessage>) => {
      this.handleWorkerMessage(ev.data);
    };
    this.worker.onerror = (ev) => {
      this.opts.onError?.(new Error(ev.message || "Face worker error"));
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker failed to construct"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Face worker init timeout"));
      }, 60000);

      const onMsg = (ev: MessageEvent<WorkerToMainMessage>) => {
        if (ev.data?.type === "READY") {
          clearTimeout(timeout);
          this.worker?.removeEventListener("message", onMsg);
          this.workerReady = true;
          resolve();
        }
        if (ev.data?.type === "ERROR" && ev.data.fatal) {
          clearTimeout(timeout);
          this.worker?.removeEventListener("message", onMsg);
          reject(new Error(ev.data.message));
        }
      };

      this.worker.addEventListener("message", onMsg);

      const initMsg: MainToWorkerMessage = {
        type: "INIT",
        config: {
          wasmPath: this.opts.wasmPath,
          modelAssetPath: this.opts.modelAssetPath,
          minDetectionConfidence: this.opts.minDetectionConfidence,
          minTrackingConfidence: this.opts.minTrackingConfidence,
        },
      };
      this.worker.postMessage(initMsg);
    });
  }

  start(video: HTMLVideoElement): void {
    if (!DISABLE_FACE_INFERENCE && !this.workerReady) {
      throw new Error("Call init() first");
    }
    this.video = video;
    this.running = true;
    this.lastSubmitted = 0;
    this.lastPerfLog = performance.now();
    this.scheduleLoop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.rvfcHandle != null && this.video) {
      const v = this.video as HTMLVideoElement & {
        cancelVideoFrameCallback?: (h: number) => void;
      };
      v.cancelVideoFrameCallback?.(this.rvfcHandle);
      this.rvfcHandle = null;
    }
    this.clearPendingBitmap();
  }

  async close(): Promise<void> {
    this.stop();
    if (this.worker) {
      try {
        this.worker.postMessage({ type: "CLOSE" } satisfies MainToWorkerMessage);
      } catch {
        /* ignore */
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }

  /** @deprecated Main thread must not run detectForVideo — kept for API compatibility */
  analyzeVideoFrame(
    _video: HTMLVideoElement,
    timestampMs: number
  ): FaceLandmarkResult {
    return emptyResult(timestampMs / 1000);
  }

  // ---------------------------------------------------------------------------

  private scheduleLoop(): void {
    const video = this.video;
    if (!video || !this.running) return;

    const hasRvfc =
      typeof (video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }).requestVideoFrameCallback === "function";

    if (hasRvfc) {
      const tick = () => {
        if (!this.running) return;
        void this.onFrameOpportunity();
        const v = this.video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => number;
        };
        if (v) this.rvfcHandle = v.requestVideoFrameCallback(tick);
      };
      this.rvfcHandle = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback: (cb: () => void) => number;
        }
      ).requestVideoFrameCallback(tick);
    } else {
      const tick = () => {
        if (!this.running) return;
        this.rafId = requestAnimationFrame(tick);
        void this.onFrameOpportunity();
      };
      this.rafId = requestAnimationFrame(tick);
    }
  }

  private async onFrameOpportunity(): Promise<void> {
    if (!this.running) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const video = this.video;
    if (!video || video.readyState < 2) return;

    const now = performance.now();
    if (now - this.lastSubmitted < this.frameInterval) return;

    if (DISABLE_FACE_INFERENCE) {
      this.lastSubmitted = now;
      this.opts.onResult?.({
        ...emptyResult(Date.now() / 1000),
        fps: this.opts.targetFps,
        latency_ms: 0,
      });
      return;
    }

    if (!this.worker || !this.workerReady) return;

    // Create downscaled ImageBitmap (prefer native resize)
    let bitmap: ImageBitmap;
    try {
      bitmap = await this.captureBitmap(video);
    } catch {
      return;
    }

    this.lastSubmitted = now;
    this.frameId += 1;
    const frameId = this.frameId;
    const timestampMs = now;

    if (this.workerBusy) {
      // Latest-frame-wins: drop previous pending
      if (this.pendingBitmap) {
        try {
          this.pendingBitmap.close();
        } catch {
          /* ignore */
        }
        this.dropped += 1;
      }
      this.pendingBitmap = bitmap;
      this.pendingTimestamp = timestampMs;
      this.pendingFrameId = frameId;
      return;
    }

    this.sendBitmap(bitmap, timestampMs, frameId);
  }

  private async captureBitmap(video: HTMLVideoElement): Promise<ImageBitmap> {
    const maxW = this.opts.maxWidth;
    const vw = video.videoWidth || maxW;
    const vh = video.videoHeight || Math.round(maxW * 0.75);

    if (vw > maxW) {
      const scale = maxW / vw;
      const w = maxW;
      const h = Math.max(1, Math.round(vh * scale));
      this.lastInputW = w;
      this.lastInputH = h;
      try {
        return await createImageBitmap(video, {
          resizeWidth: w,
          resizeHeight: h,
          resizeQuality: "medium",
        } as ImageBitmapOptions);
      } catch {
        // Fallback: draw to canvas then bitmap
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(video, 0, 0, w, h);
        return createImageBitmap(canvas);
      }
    }

    this.lastInputW = vw;
    this.lastInputH = vh;
    return createImageBitmap(video);
  }

  private sendBitmap(
    bitmap: ImageBitmap,
    timestampMs: number,
    frameId: number
  ): void {
    if (!this.worker) {
      try {
        bitmap.close();
      } catch {
        /* ignore */
      }
      return;
    }

    this.workerBusy = true;
    this.submitted += 1;
    this.submitTimes.set(frameId, performance.now());

    const msg: MainToWorkerMessage = {
      type: "FRAME",
      bitmap,
      timestampMs,
      frameId,
    };
    this.worker.postMessage(msg, [bitmap]);
  }

  private handleWorkerMessage(data: WorkerToMainMessage): void {
    if (!data) return;

    if (data.type === "RESULT") {
      const submitAt = this.submitTimes.get(data.frameId);
      if (submitAt != null) {
        this.rttMs.push(performance.now() - submitAt);
        this.submitTimes.delete(data.frameId);
      }
      this.inferMs.push(data.inferenceMs);
      this.processed += 1;
      this.lastInputW = data.inputWidth;
      this.lastInputH = data.inputHeight;

      const result: FaceLandmarkResult = {
        ...data.result,
        fps: this.opts.targetFps,
      };
      this.opts.onResult?.(result);

      this.workerBusy = false;
      this.flushPending();
      this.maybeLogPerf();
      return;
    }

    if (data.type === "ERROR") {
      this.opts.onError?.(new Error(data.message));
      this.workerBusy = false;
      this.flushPending();
      return;
    }
  }

  private flushPending(): void {
    if (!this.pendingBitmap || this.workerBusy) return;
    const bmp = this.pendingBitmap;
    const ts = this.pendingTimestamp;
    const id = this.pendingFrameId;
    this.pendingBitmap = null;
    this.sendBitmap(bmp, ts, id);
  }

  private clearPendingBitmap(): void {
    if (this.pendingBitmap) {
      try {
        this.pendingBitmap.close();
      } catch {
        /* ignore */
      }
      this.pendingBitmap = null;
    }
  }

  private maybeLogPerf(): void {
    if (!PERF_DEBUG) return;
    const now = performance.now();
    if (now - this.lastPerfLog < 5000) return;

    const avg = (a: number[]) =>
      a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const max = (a: number[]) => (a.length ? Math.max(...a) : 0);
    const p95 = (a: number[]) => {
      if (!a.length) return 0;
      const s = [...a].sort((x, y) => x - y);
      return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
    };

    const windowSec = (now - this.lastPerfLog) / 1000;
    const camW = this.video?.videoWidth ?? 0;
    const camH = this.video?.videoHeight ?? 0;

    console.log("[PERF][FACE-WORKER]", {
      targetFps: this.opts.targetFps,
      submittedFrames: this.submitted,
      processedFrames: this.processed,
      droppedFrames: this.dropped,
      processedFps: Math.round((this.processed / windowSec) * 10) / 10,
      inferenceAvgMs: Math.round(avg(this.inferMs) * 10) / 10,
      inferenceP95Ms: Math.round(p95(this.inferMs) * 10) / 10,
      inferenceMaxMs: Math.round(max(this.inferMs) * 10) / 10,
      workerRoundTripAvgMs: Math.round(avg(this.rttMs) * 10) / 10,
      workerRoundTripP95Ms: Math.round(p95(this.rttMs) * 10) / 10,
      queueDepth: this.pendingBitmap ? 1 : 0,
      workerBusy: this.workerBusy,
      cameraResolution: `${camW}x${camH}`,
      inputResolution: `${this.lastInputW}x${this.lastInputH}`,
    });

    this.submitted = 0;
    this.processed = 0;
    this.dropped = 0;
    this.inferMs = [];
    this.rttMs = [];
    this.lastPerfLog = now;
  }
}
