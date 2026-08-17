"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InterventionEngine } from "./intervention-engine";
import type { ClickstreamConfig, ExperimentCondition } from "./config";
import type { FinalizedSeekEvent, InterventionContext, InterventionState } from "./types";
import {
  ResumeOrchestrator,
  resumeCommandFromContext,
  type ResumeResult,
  type VideoController,
} from "../player";

export interface UseInterventionOptions {
  sessionId: string;
  videoId: string;
  moduleId?: string | null;
  experimentCondition?: ExperimentCondition;
  config?: Partial<ClickstreamConfig>;
  getAttentionScore?: () => number | null | undefined;
  /** Optional; when set, remedial complete/dismiss will seek+play via contract */
  getVideoController?: () => VideoController | null;
  onNotify?: (ctx: InterventionContext) => void;
  onRemedialOpen?: (ctx: InterventionContext) => void;
  onRemedialComplete?: (ctx: InterventionContext, resume?: ResumeResult) => void;
  onLifecycleEvent?: (
    type:
      | "INTERVENTION_CANDIDATE"
      | "INTERVENTION_TRIGGERED"
      | "REMEDIAL_OPENED"
      | "REMEDIAL_COMPLETED"
      | "REMEDIAL_DISMISSED"
      | "REMEDIAL_RESUMED",
    ctx: InterventionContext
  ) => void;
}

export function useIntervention(options: UseInterventionOptions) {
  const {
    sessionId,
    videoId,
    moduleId,
    experimentCondition = "EXPERIMENTAL",
    config,
    getAttentionScore,
  } = options;

  const engineRef = useRef<InterventionEngine | null>(null);
  const orchestratorRef = useRef<ResumeOrchestrator | null>(null);
  const [state, setState] = useState<InterventionState>("IDLE");
  const [showNotify, setShowNotify] = useState(false);
  const [showRemedial, setShowRemedial] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!sessionId) return;
    const engine = new InterventionEngine({
      sessionId,
      videoId,
      moduleId,
      experimentCondition,
      config,
    });
    engineRef.current = engine;

    orchestratorRef.current = new ResumeOrchestrator({
      sessionId,
      videoId,
      getController: () => optsRef.current.getVideoController?.() ?? null,
    });

    setState("IDLE");
    setShowNotify(false);
    setShowRemedial(false);
    setResumeAt(null);
    return () => {
      engineRef.current = null;
      orchestratorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, videoId]);

  useEffect(() => {
    engineRef.current?.setExperimentCondition(experimentCondition);
  }, [experimentCondition]);

  useEffect(() => {
    orchestratorRef.current?.rebind(sessionId, videoId);
  }, [sessionId, videoId]);

  useEffect(() => {
    const id = setInterval(() => {
      const next = engineRef.current?.tick();
      if (next) setState(next);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleFinalizedSeek = useCallback(
    (seek: FinalizedSeekEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      const att = optsRef.current.getAttentionScore?.() ?? null;
      engine.setAttention(att ?? null);

      const decision = engine.onSeek(seek);
      setState(engine.getContext().state);

      if (decision.shouldNotify) {
        optsRef.current.onLifecycleEvent?.("INTERVENTION_CANDIDATE", engine.getContext());
        setShowNotify(true);
        optsRef.current.onNotify?.(engine.getContext());

        // Pause via controller when notifying (optional best-effort)
        void optsRef.current.getVideoController?.()?.pause();

        const notifyMs = { ...config }.notifyDurationMs ?? 2000;
        window.setTimeout(() => {
          engine.confirmRemedial();
          setShowNotify(false);
          setShowRemedial(true);
          setResumeAt(engine.getContext().resumeTimestamp);
          setState(engine.getContext().state);
          optsRef.current.onLifecycleEvent?.("REMEDIAL_OPENED", engine.getContext());
          optsRef.current.onLifecycleEvent?.("INTERVENTION_TRIGGERED", engine.getContext());
          optsRef.current.onRemedialOpen?.(engine.getContext());
        }, notifyMs);
      }
    },
    [config]
  );

  const runResume = useCallback(async (): Promise<ResumeResult | undefined> => {
    const engine = engineRef.current;
    const orch = orchestratorRef.current;
    if (!engine || !orch) return undefined;

    const ctx = engine.getContext();
    const cmd = resumeCommandFromContext(ctx, true);
    if (!cmd) return { ok: false, reason: "no_resume_timestamp" };

    // Mark RESUMING for guards (engine still remedial until completeRemedial)
    return orch.resume(cmd);
  }, []);

  const completeRemedial = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const resume = await runResume();
    engine.completeRemedial();
    setShowRemedial(false);
    setState(engine.getContext().state);
    optsRef.current.onLifecycleEvent?.("REMEDIAL_COMPLETED", engine.getContext());
    optsRef.current.onLifecycleEvent?.("REMEDIAL_RESUMED", engine.getContext());
    optsRef.current.onRemedialComplete?.(engine.getContext(), resume);
  }, [runResume]);

  const dismissRemedial = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    // Still seek back to resume point so learner is not stranded mid-timeline
    const resume = await runResume();
    engine.dismissRemedial();
    setShowRemedial(false);
    setState(engine.getContext().state);
    optsRef.current.onLifecycleEvent?.("REMEDIAL_DISMISSED", engine.getContext());
    optsRef.current.onRemedialComplete?.(engine.getContext(), resume);
  }, [runResume]);

  return {
    state,
    showNotify,
    showRemedial,
    resumeAt,
    isRemedialActive: state === "REMEDIAL_ACTIVE",
    handleFinalizedSeek,
    completeRemedial,
    dismissRemedial,
    getContext: () => engineRef.current?.getContext() ?? null,
  };
}
