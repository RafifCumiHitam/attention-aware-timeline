"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InterventionEngine } from "./intervention-engine";
import type { ClickstreamConfig, ExperimentCondition } from "./config";
import type { FinalizedSeekEvent, InterventionContext, InterventionState } from "./types";

export interface UseInterventionOptions {
  sessionId: string;
  videoId: string;
  moduleId?: string | null;
  experimentCondition?: ExperimentCondition;
  config?: Partial<ClickstreamConfig>;
  getAttentionScore?: () => number | null | undefined;
  onNotify?: (ctx: InterventionContext) => void;
  onRemedialOpen?: (ctx: InterventionContext) => void;
  onRemedialComplete?: (ctx: InterventionContext) => void;
  /** Log derived lifecycle events */
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
    setState("IDLE");
    setShowNotify(false);
    setShowRemedial(false);
    return () => {
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, videoId]);

  useEffect(() => {
    engineRef.current?.setExperimentCondition(experimentCondition);
  }, [experimentCondition]);

  // Cooldown ticker
  useEffect(() => {
    const id = setInterval(() => {
      const next = engineRef.current?.tick();
      if (next) setState(next);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleFinalizedSeek = useCallback((seek: FinalizedSeekEvent) => {
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
  }, [config]);

  const completeRemedial = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.completeRemedial();
    setShowRemedial(false);
    setState(engine.getContext().state);
    optsRef.current.onLifecycleEvent?.("REMEDIAL_COMPLETED", engine.getContext());
    optsRef.current.onLifecycleEvent?.("REMEDIAL_RESUMED", engine.getContext());
    optsRef.current.onRemedialComplete?.(engine.getContext());
  }, []);

  const dismissRemedial = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.dismissRemedial();
    setShowRemedial(false);
    setState(engine.getContext().state);
    optsRef.current.onLifecycleEvent?.("REMEDIAL_DISMISSED", engine.getContext());
  }, []);

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
