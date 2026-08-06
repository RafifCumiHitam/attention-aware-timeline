import { EAR_BLINK_THRESHOLD } from "../constants";

export interface BlinkState {
  blinkDetected: boolean;
  closedFrames: number;
}

export function detectBlink(
  leftEar: number,
  rightEar: number,
  threshold: number = EAR_BLINK_THRESHOLD,
  prevClosedFrames = 0
): BlinkState {
  const bothClosed = leftEar < threshold && rightEar < threshold;
  return {
    blinkDetected: bothClosed,
    closedFrames: bothClosed ? prevClosedFrames + 1 : 0,
  };
}
