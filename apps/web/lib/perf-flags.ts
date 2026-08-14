/**
 * Phase 11 isolation flags (dev only).
 * Set in apps/web/.env.local and restart Next:
 *
 * NEXT_PUBLIC_PERF_DEBUG=true
 * NEXT_PUBLIC_DISABLE_FACE_INFERENCE=true
 * NEXT_PUBLIC_DISABLE_LEARNING_WS=true
 * NEXT_PUBLIC_DISABLE_ADAPTIVE_PLAYBACK=true
 */

function envTrue(key: string): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env[key];
  return v === "1" || v === "true" || v === "TRUE";
}

export const PERF_DEBUG = envTrue("NEXT_PUBLIC_PERF_DEBUG");

/** Camera preview on; MediaPipe detectForVideo skipped. */
export const DISABLE_FACE_INFERENCE = envTrue("NEXT_PUBLIC_DISABLE_FACE_INFERENCE");

/** No learning WebSocket acquire/connect. */
export const DISABLE_LEARNING_WS = envTrue("NEXT_PUBLIC_DISABLE_LEARNING_WS");

/** Keep playback rate fixed at 1x (ignore adaptive commands). */
export const DISABLE_ADAPTIVE_PLAYBACK = envTrue("NEXT_PUBLIC_DISABLE_ADAPTIVE_PLAYBACK");
