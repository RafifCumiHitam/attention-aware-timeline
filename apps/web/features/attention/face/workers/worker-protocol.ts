import type { FaceLandmarkResult } from "../types";

export interface WorkerInitConfig {
  wasmPath: string;
  modelAssetPath: string;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

export type MainToWorkerMessage =
  | { type: "INIT"; config: WorkerInitConfig }
  | {
      type: "FRAME";
      /** Transferable ImageBitmap */
      bitmap: ImageBitmap;
      timestampMs: number;
      frameId: number;
    }
  | { type: "CLOSE" };

export type WorkerToMainMessage =
  | { type: "READY" }
  | {
      type: "RESULT";
      frameId: number;
      result: FaceLandmarkResult;
      inferenceMs: number;
      inputWidth: number;
      inputHeight: number;
    }
  | { type: "ERROR"; message: string; fatal?: boolean };
