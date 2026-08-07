import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Canonical learning session lifecycle (mirrors API SessionStatus). */
export type SessionLifecycle = "active" | "paused" | "ended" | "abandoned";

export interface LearningSessionState {
  sessionId: string | null;
  videoId: string | null;
  userId: string | null;
  status: SessionLifecycle;
  startedAt: string | null;
  endedAt: string | null;
  /** Last known video timeline position (seconds) */
  lastVideoTimestamp: number;
  isWritable: boolean;

  setSession: (data: {
    sessionId: string;
    videoId: string;
    userId?: string | null;
    status?: SessionLifecycle;
    startedAt?: string | null;
  }) => void;
  setStatus: (status: SessionLifecycle) => void;
  setLastVideoTimestamp: (t: number) => void;
  clearSession: () => void;
  /** Whether events may still be written */
  canWrite: () => boolean;
}

const closed = new Set<SessionLifecycle>(["ended", "abandoned"]);

export const useSessionStore = create<LearningSessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      videoId: null,
      userId: null,
      status: "ended",
      startedAt: null,
      endedAt: null,
      lastVideoTimestamp: 0,
      isWritable: false,

      setSession: (data) =>
        set({
          sessionId: data.sessionId,
          videoId: data.videoId,
          userId: data.userId ?? null,
          status: data.status ?? "active",
          startedAt: data.startedAt ?? new Date().toISOString(),
          endedAt: null,
          isWritable: (data.status ?? "active") === "active" || data.status === "paused",
        }),

      setStatus: (status) =>
        set({
          status,
          isWritable: !closed.has(status),
          endedAt: closed.has(status) ? new Date().toISOString() : null,
        }),

      setLastVideoTimestamp: (t) => set({ lastVideoTimestamp: t }),

      clearSession: () =>
        set({
          sessionId: null,
          videoId: null,
          userId: null,
          status: "ended",
          startedAt: null,
          endedAt: null,
          lastVideoTimestamp: 0,
          isWritable: false,
        }),

      canWrite: () => {
        const s = get();
        return Boolean(s.sessionId && s.isWritable && !closed.has(s.status));
      },
    }),
    {
      name: "aat-learning-session",
      partialize: (state) => ({
        sessionId: state.sessionId,
        videoId: state.videoId,
        userId: state.userId,
        status: state.status,
        startedAt: state.startedAt,
        endedAt: state.endedAt,
        lastVideoTimestamp: state.lastVideoTimestamp,
        isWritable: state.isWritable,
      }),
    }
  )
);
