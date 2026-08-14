"use client";

import { useCallback, useEffect, useState } from "react";
import type { DifficultyBin } from "../components/difficulty-timeline-chart";
import {
  fetchDifficultyTimeline,
  mapDifficultyBins,
  type DifficultyTimelineApi,
} from "../services/difficulty-api";

export function useDifficultyTimeline(videoId: string | null | undefined) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [bins, setBins] = useState<DifficultyBin[]>([]);
  const [meta, setMeta] = useState<Pick<
    DifficultyTimelineApi,
    "label" | "disclaimer" | "event_count" | "bucket_seconds"
  > | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!videoId) {
      setState("empty");
      setBins([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setState("loading");
      setError(null);
      try {
        const api = await fetchDifficultyTimeline(videoId, { bucketSeconds: 10 });
        if (cancelled) return;
        const mapped = mapDifficultyBins(api);
        setBins(mapped);
        setMeta({
          label: api.label,
          disclaimer: api.disclaimer,
          event_count: api.event_count,
          bucket_seconds: api.bucket_seconds,
        });
        setState(mapped.length === 0 ? "empty" : "success");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load difficulty timeline");
        setBins([]);
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [videoId, tick]);

  return { state, error, bins, meta, refresh };
}
