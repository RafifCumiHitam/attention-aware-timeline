"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AnalyticsSummary,
  AttentionTrendPoint,
  CompletionPoint,
  DailyActivityPoint,
  PauseFrequencyPoint,
  SeekHeatmapBin,
  SpeedDistribution,
  WatchTimePoint,
} from "../types";
import {
  fetchAttention,
  fetchOverview,
  fetchTimeline,
  mapAttentionPoints,
  mapCompletion,
  mapDailyActivity,
  mapOverviewToSummary,
  mapSpeedFallback,
  mapTimelineToPauses,
  mapTimelineToSeekHeatmap,
  mapWatchTime,
  type AnalyticsQuery,
} from "../services/analytics-api";

export type AnalyticsLoadState = "idle" | "loading" | "success" | "empty" | "error";

export interface AnalyticsViewModel {
  state: AnalyticsLoadState;
  error: string | null;
  summary: AnalyticsSummary | null;
  dailyActivity: DailyActivityPoint[];
  watchTimeByModule: WatchTimePoint[];
  seekHeatmap: SeekHeatmapBin[];
  pauseFrequency: PauseFrequencyPoint[];
  attentionTrend: AttentionTrendPoint[];
  completionRate: CompletionPoint[];
  playbackSpeed: SpeedDistribution[];
  refresh: () => void;
}

const emptySummary: AnalyticsSummary = {
  totalWatchHours: 0,
  avgAttention: 0,
  completionRate: 0,
  totalPauses: 0,
  avgSpeed: 1,
  totalSessions: 0,
  trends: { watchHours: 0, attention: 0, completion: 0, sessions: 0 },
};

export function useAnalyticsData(query: AnalyticsQuery = {}): AnalyticsViewModel {
  const [state, setState] = useState<AnalyticsLoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyActivity, setDaily] = useState<DailyActivityPoint[]>([]);
  const [watchTimeByModule, setWatch] = useState<WatchTimePoint[]>([]);
  const [seekHeatmap, setSeek] = useState<SeekHeatmapBin[]>([]);
  const [pauseFrequency, setPause] = useState<PauseFrequencyPoint[]>([]);
  const [attentionTrend, setAttention] = useState<AttentionTrendPoint[]>([]);
  const [completionRate, setCompletion] = useState<CompletionPoint[]>([]);
  const [playbackSpeed, setSpeed] = useState<SpeedDistribution[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      setError(null);
      try {
        const [overview, timeline, attention] = await Promise.all([
          fetchOverview(query),
          fetchTimeline(query),
          fetchAttention(query),
        ]);

        if (cancelled) return;

        const mappedSummary = mapOverviewToSummary(overview);
        const daily = mapDailyActivity(overview);
        const watch = mapWatchTime(overview);
        const seeks = mapTimelineToSeekHeatmap(timeline);
        const pauses = mapTimelineToPauses(timeline);
        const att = mapAttentionPoints(attention);
        const completion = mapCompletion(overview);
        const speed = mapSpeedFallback(mappedSummary.avgSpeed);

        const isEmpty =
          mappedSummary.totalSessions === 0 &&
          seeks.every((s) => s.seeks === 0) &&
          att.length === 0;

        setSummary(mappedSummary);
        setDaily(daily);
        setWatch(watch);
        setSeek(seeks);
        setPause(pauses);
        setAttention(att);
        setCompletion(completion);
        setSpeed(speed);
        setState(isEmpty ? "empty" : "success");
      } catch (err) {
        if (cancelled) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to load analytics";
        setError(message);
        setSummary(emptySummary);
        setDaily([]);
        setWatch([]);
        setSeek([]);
        setPause([]);
        setAttention([]);
        setCompletion([]);
        setSpeed([]);
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.sessionId, query.videoId, query.trendDays, query.bucketSeconds, tick]);

  return {
    state,
    error,
    summary,
    dailyActivity,
    watchTimeByModule,
    seekHeatmap,
    pauseFrequency,
    attentionTrend,
    completionRate,
    playbackSpeed,
    refresh,
  };
}
