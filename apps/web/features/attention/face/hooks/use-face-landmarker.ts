"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarkerEngine } from "../face-landmarker-engine";
import type { FaceLandmarkResult, FaceLandmarkerOptions } from "../types";
import { PERF_DEBUG } from "@/lib/perf-flags";

export interface UseFaceLandmarkerOptions extends FaceLandmarkerOptions {
  autoStart?: boolean;
  facingMode?: "user" | "environment";
  /** Throttle React state updates for UI (ms). Pipeline callback still fires. */
  uiUpdateIntervalMs?: number;
}

export function useFaceLandmarker(options: UseFaceLandmarkerOptions = {}) {
  const {
    autoStart = false,
    facingMode = "user",
    onResult,
    onError,
    uiUpdateIntervalMs = 250,
    ...engineOpts
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<FaceLandmarkerEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const lastUiUpdate = useRef(0);
  const cameraLogged = useRef(false);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const [result, setResult] = useState<FaceLandmarkResult | null>(null);
  const [ready, setReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const engine = new FaceLandmarkerEngine({
      targetFps: engineOpts.targetFps ?? 10,
      maxWidth: engineOpts.maxWidth ?? 480,
      ...engineOpts,
      onResult: (r) => {
        onResultRef.current?.(r);
        const now = performance.now();
        if (now - lastUiUpdate.current >= uiUpdateIntervalMs) {
          lastUiUpdate.current = now;
          setResult(r);
        }
      },
      onError: (e) => {
        setError(e.message);
        onErrorRef.current?.(e);
      },
    });
    engineRef.current = engine;
    engine
      .init()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to init Face Landmarker");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void engine.close();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!engineRef.current || !ready) {
      setError("Engine not ready");
      return;
    }
    const video = videoRef.current;
    if (!video) {
      setError("videoRef not attached");
      return;
    }
    try {
      // Camera stays ~30fps for smooth preview; inference is independently throttled to ~10fps
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode,
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      streamRef.current = stream;
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();

      if (PERF_DEBUG && !cameraLogged.current) {
        cameraLogged.current = true;
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.() ?? {};
        console.log("[PERF][CAMERA]", {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          facingMode: settings.facingMode,
          deviceId: settings.deviceId ? "(set)" : undefined,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      }

      engineRef.current.start(video);
      setStreaming(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera permission denied");
      setStreaming(false);
    }
  }, [ready, facingMode]);

  useEffect(() => {
    if (autoStart && ready) void start();
  }, [autoStart, ready, start]);

  return { result, ready, streaming, error, videoRef, start, stop };
}
