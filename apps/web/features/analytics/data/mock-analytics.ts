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

export const summary: AnalyticsSummary = {
  totalWatchHours: 12.4,
  avgAttention: 81.2,
  completionRate: 68,
  totalPauses: 147,
  avgSpeed: 1.15,
  totalSessions: 34,
  trends: {
    watchHours: 12.5,
    attention: 4.2,
    completion: 6.0,
    sessions: 8.0,
  },
};

export const dailyActivity: DailyActivityPoint[] = [
  { date: "2026-07-30", label: "Thu", watchMinutes: 42, sessions: 2, attention: 76 },
  { date: "2026-07-31", label: "Fri", watchMinutes: 58, sessions: 3, attention: 82 },
  { date: "2026-08-01", label: "Sat", watchMinutes: 25, sessions: 1, attention: 68 },
  { date: "2026-08-02", label: "Sun", watchMinutes: 35, sessions: 2, attention: 71 },
  { date: "2026-08-03", label: "Mon", watchMinutes: 72, sessions: 4, attention: 88 },
  { date: "2026-08-04", label: "Tue", watchMinutes: 64, sessions: 3, attention: 85 },
  { date: "2026-08-05", label: "Wed", watchMinutes: 51, sessions: 3, attention: 81 },
];

export const watchTimeByModule: WatchTimePoint[] = [
  { module: "Attention Basics", minutes: 145 },
  { module: "Gaze Estimation", minutes: 98 },
  { module: "Focus Metrics", minutes: 132 },
  { module: "Adaptive Delivery", minutes: 76 },
  { module: "Feedback Loops", minutes: 54 },
  { module: "Case Studies", minutes: 41 },
];

/** Seek density across a 15-min lesson (bins every 30s) */
export const seekHeatmap: SeekHeatmapBin[] = Array.from({ length: 30 }, (_, i) => {
  const second = i * 30;
  // Deterministic peaks near concept transitions ~3min, ~7min, ~11min
  const peaks = [180, 420, 660];
  // Pseudo-random base from index (stable across renders)
  let seeks = ((i * 7 + 3) % 5) + 1;
  for (const p of peaks) {
    const dist = Math.abs(second - p);
    if (dist < 60) seeks += Math.max(0, 12 - Math.floor(dist / 10));
  }
  const m = Math.floor(second / 60);
  const s = second % 60;
  return {
    second,
    label: `${m}:${String(s).padStart(2, "0")}`,
    seeks,
  };
});

export const playbackSpeed: SpeedDistribution[] = [
  { speed: "0.75x", count: 12, percentage: 8 },
  { speed: "1.0x", count: 68, percentage: 45 },
  { speed: "1.25x", count: 42, percentage: 28 },
  { speed: "1.5x", count: 22, percentage: 15 },
  { speed: "1.75x", count: 4, percentage: 3 },
  { speed: "2.0x", count: 2, percentage: 1 },
];

export const pauseFrequency: PauseFrequencyPoint[] = [
  { segment: "0–2m", pauses: 8 },
  { segment: "2–4m", pauses: 14 },
  { segment: "4–6m", pauses: 22 },
  { segment: "6–8m", pauses: 31 },
  { segment: "8–10m", pauses: 18 },
  { segment: "10–12m", pauses: 27 },
  { segment: "12–14m", pauses: 16 },
  { segment: "14–16m", pauses: 11 },
];

export const completionRate: CompletionPoint[] = [
  { name: "Attention Basics", completed: 92, inProgress: 5, notStarted: 3 },
  { name: "Gaze Estimation", completed: 78, inProgress: 14, notStarted: 8 },
  { name: "Focus Metrics", completed: 65, inProgress: 22, notStarted: 13 },
  { name: "Adaptive Delivery", completed: 48, inProgress: 30, notStarted: 22 },
  { name: "Feedback Loops", completed: 35, inProgress: 28, notStarted: 37 },
  { name: "Case Studies", completed: 22, inProgress: 18, notStarted: 60 },
];

export const attentionTrend: AttentionTrendPoint[] = [
  { time: "0:00", attention: 88, baseline: 80 },
  { time: "2:00", attention: 85, baseline: 80 },
  { time: "4:00", attention: 72, baseline: 80 },
  { time: "6:00", attention: 68, baseline: 80 },
  { time: "8:00", attention: 79, baseline: 80 },
  { time: "10:00", attention: 91, baseline: 80 },
  { time: "12:00", attention: 86, baseline: 80 },
  { time: "14:00", attention: 74, baseline: 80 },
  { time: "15:45", attention: 82, baseline: 80 },
];
