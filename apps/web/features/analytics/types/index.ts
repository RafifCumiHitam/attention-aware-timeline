export interface DailyActivityPoint {
  date: string;
  label: string;
  watchMinutes: number;
  sessions: number;
  attention: number;
}

export interface WatchTimePoint {
  module: string;
  minutes: number;
  fill?: string;
}

export interface SeekHeatmapBin {
  second: number;
  label: string;
  seeks: number;
}

export interface SpeedDistribution {
  speed: string;
  count: number;
  percentage: number;
}

export interface PauseFrequencyPoint {
  segment: string;
  pauses: number;
}

export interface CompletionPoint {
  name: string;
  completed: number;
  inProgress: number;
  notStarted: number;
}

export interface AttentionTrendPoint {
  time: string;
  attention: number;
  baseline: number;
}

export interface AnalyticsSummary {
  totalWatchHours: number;
  avgAttention: number;
  completionRate: number;
  totalPauses: number;
  avgSpeed: number;
  totalSessions: number;
  trends: {
    watchHours: number;
    attention: number;
    completion: number;
    sessions: number;
  };
}
