"use client";

/**
 * Session lifecycle + recovery for the Learn page.
 * Single session_id for player events, face telemetry, and WebSocket.
 */

import { useCallback, useEffect, useRef } from "react";
import apiClient from "@/lib/api-client";
import {
  useSessionStore,
  type SessionLifecycle,
} from "@/stores/session-store";
import { getEventService } from "../services/event-service";

export interface UseSessionLifecycleOptions {
  videoId: string;
  /** When true, attempt recover from localStorage then API */
  autoRecover?: boolean;
}

export function useSessionLifecycle(
  options: UseSessionLifecycleOptions
) {
  const { videoId, autoRecover = true } = options;
  const bootstrapped = useRef(false);

  const sessionId = useSessionStore((s) => s.sessionId);
  const status = useSessionStore((s) => s.status);
  const isWritable = useSessionStore((s) => s.isWritable);
  const setSession = useSessionStore((s) => s.setSession);
  const setStatus = useSessionStore((s) => s.setStatus);
  const canWrite = useSessionStore((s) => s.canWrite);

  const applyServerSession = useCallback(
    (data: {
      id: string;
      video_id: string;
      user_id?: string;
      status: string;
      started_at?: string;
    }) => {
      const st = data.status as SessionLifecycle;

      setSession({
        sessionId: data.id,
        videoId: data.video_id,
        userId: data.user_id,
        status: st,
        startedAt: data.started_at,
      });

      getEventService().setContext({
        sessionId: data.id,
        videoId: data.video_id,
      });
    },
    [setSession]
  );

  /**
   * Start or recover an ACTIVE/PAUSED session.
   */
  const ensureSession = useCallback(async () => {
    const store = useSessionStore.getState();

    // ---------------------------------------------------------
    // 1. Try local session recovery first
    // ---------------------------------------------------------
    if (
      store.sessionId &&
      store.videoId === videoId &&
      (store.status === "active" || store.status === "paused")
    ) {
      try {
        const { data } = await apiClient.post("/sessions/recover", {
          session_id: store.sessionId,
        });

        applyServerSession(data);

        return data.id as string;
      } catch (err) {
        console.warn(
          "[Session] Recovery failed; starting new session",
          err
        );
      }
    }

    // ---------------------------------------------------------
    // 2. Start a new server session
    // ---------------------------------------------------------
    try {
      const { data } = await apiClient.post("/sessions", {
        video_id: videoId,
      });

      applyServerSession(data);

      return data.id as string;
    } catch (err) {
      // -------------------------------------------------------
      // 3. Offline / unauthenticated fallback
      // -------------------------------------------------------
      const localId =
        store.sessionId && store.videoId === videoId
          ? store.sessionId
          : typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}`;

      setSession({
        sessionId: localId,
        videoId,
        status: "active",
      });

      getEventService().setContext({
        sessionId: localId,
        videoId,
      });

      console.warn(
        "[Session] API start failed; using local session",
        err
      );

      return localId;
    }
  }, [videoId, applyServerSession, setSession]);

  /**
   * Pause current session.
   */
  const pause = useCallback(async () => {
    const id = useSessionStore.getState().sessionId;

    if (!id) return;

    setStatus("paused");

    try {
      await apiClient.post(`/sessions/${id}/pause`);
    } catch (err) {
      console.warn("[Session] Pause request failed", err);
    }
  }, [setStatus]);

  /**
   * Resume current session.
   */
  const resume = useCallback(async () => {
    const id = useSessionStore.getState().sessionId;

    if (!id) return;

    setStatus("active");

    try {
      await apiClient.post(`/sessions/${id}/resume`);
    } catch (err) {
      console.warn("[Session] Resume request failed", err);
    }
  }, [setStatus]);

  /**
   * End current session.
   */
  const end = useCallback(
    async (abandoned = false) => {
      const id = useSessionStore.getState().sessionId;

      if (!id) return;

      setStatus(abandoned ? "abandoned" : "ended");

      try {
        await apiClient.post(`/sessions/${id}/end`, null, {
          params: { abandoned },
        });
      } catch (err) {
        console.warn("[Session] End request failed", err);
      }

      await getEventService().flush();
    },
    [setStatus]
  );

  // -----------------------------------------------------------
  // Bootstrap session once
  // -----------------------------------------------------------
  useEffect(() => {
    if (!autoRecover || bootstrapped.current) {
      return;
    }

    bootstrapped.current = true;

    void ensureSession();
  }, [autoRecover, ensureSession]);

  // -----------------------------------------------------------
  // Tab visibility
  // -----------------------------------------------------------
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        void getEventService().flush();
      }
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // -----------------------------------------------------------
  // Page unload
  // -----------------------------------------------------------
  useEffect(() => {
    const onHide = () => {
      void getEventService().flush();
    };

    window.addEventListener("pagehide", onHide);

    return () => {
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return {
    sessionId,
    videoId,
    status,
    isWritable,
    canWrite,
    ensureSession,
    pause,
    resume,
    end,
  };
}