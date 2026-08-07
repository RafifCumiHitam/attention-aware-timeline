/**
 * Analytics API client — real PostgreSQL-backed endpoints.
 */

import apiClient from "@/lib/api-client";
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

export interface OverviewApiResponse {
  overview: {
    total_sessions: number;
    completed_sessions: number;
    total_watch_seconds: number;
    total_watch_hours: number;
    completion_rate: number;
    avg_attention_score: number | null;
    total_videos_watched: number;
    active_days: number;
    pause_count: number;
    seek_count: number;
    forward_seek_count: number;
    backward_seek_count: number;
    avg_playback_speed: number | null;
    attention_sample_count: number;
  };
  attention_trend: {
    points: Array<{
      date: string;
      avg_attention: number | null;
      session_count: number;
      watch_seconds: number;
    }>;
    period_days: number;
  };
  recent_sessions: Array<{
    session_id: string;
    video_id: string;
    video_title: string | null;
    status: string;
    progress_percent: number;
    avg_attention_score: number | null;
    total_watch_seconds: number;
    started_at: string;
  }>;
  top_videos: Array<{
    video_id: string;
    title: string;
    session_count: number;
    avg_attention: number | null;
    total_watch_seconds: number;
  }>;
}

export interface TimelineApiResponse {
  buckets: Array<{
    start: number;
    end: number;
    pause_count: number;
    seek_count: number;
    attention_avg: number | null;
    event_count: number;
  }>;
  bucket_seconds: number;
}

export interface AttentionApiResponse {
  points: Array<{
    video_timestamp: number;
    attention_score: number;
  }>;
  total: number;
  page: number;
  page_size: number;
}

export interface EventsApiResponse {
  items: Array<{
    id: string;
    from?: number | null;
    to?: number | null;
    direction: string;
    video_timestamp?: number | null;
  }>;
  total: number;
  page: number;
  page_size: number;
}

export interface AnalyticsQuery {
  sessionId?: string | null;
  videoId?: string | null;
  trendDays?: number;
  bucketSeconds?: number;
}

function formatTimeLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function dayLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + (isoDate.length === 10 ? "T00:00:00Z" : ""));
    return d.toLocaleDateString(undefined, { weekday: "short" });
  } catch {
    return isoDate.slice(5);
  }
}

/** Map API → chart shapes used by existing Recharts components */
export function mapOverviewToSummary(api: OverviewApiResponse): AnalyticsSummary {
  const o = api.overview;
  const att = o.avg_attention_score;
  // attention may be 0–1 or 0–100 depending on producer; normalize to %
  const avgAttentionPct =
    att == null ? 0 : att <= 1 ? Math.round(att * 1000) / 10 : Math.round(att * 10) / 10;

  return {
    totalWatchHours: o.total_watch_hours,
    avgAttention: avgAttentionPct,
    completionRate: o.completion_rate,
    totalPauses: o.pause_count,
    avgSpeed: o.avg_playback_speed != null ? Math.round(o.avg_playback_speed * 100) / 100 : 1,
    totalSessions: o.total_sessions,
    trends: {
      watchHours: 0,
      attention: 0,
      completion: 0,
      sessions: 0,
    },
  };
}

export function mapDailyActivity(api: OverviewApiResponse): DailyActivityPoint[] {
  return api.attention_trend.points.map((p) => {
    const att = p.avg_attention;
    const attentionPct =
      att == null ? 0 : att <= 1 ? Math.round(att * 100) : Math.round(att);
    return {
      date: String(p.date),
      label: dayLabel(String(p.date)),
      watchMinutes: Math.round((p.watch_seconds || 0) / 60),
      sessions: p.session_count,
      attention: attentionPct,
    };
  });
}

export function mapWatchTime(api: OverviewApiResponse): WatchTimePoint[] {
  return api.top_videos.map((v) => ({
    module: v.title,
    minutes: Math.round((v.total_watch_seconds || 0) / 60),
  }));
}

export function mapCompletion(api: OverviewApiResponse): CompletionPoint[] {
  return api.top_videos.map((v) => {
    // Approximate from session aggregates when module-level status is unavailable
    const total = v.session_count || 1;
    return {
      name: v.title,
      completed: Math.round((api.overview.completion_rate / 100) * total),
      inProgress: Math.max(0, total - Math.round((api.overview.completion_rate / 100) * total)),
      notStarted: 0,
    };
  });
}

export function mapTimelineToSeekHeatmap(api: TimelineApiResponse): SeekHeatmapBin[] {
  return api.buckets.map((b) => ({
    second: Math.round(b.start),
    label: formatTimeLabel(b.start),
    seeks: b.seek_count,
  }));
}

export function mapTimelineToPauses(api: TimelineApiResponse): PauseFrequencyPoint[] {
  return api.buckets.map((b) => ({
    segment: formatTimeLabel(b.start),
    pauses: b.pause_count,
  }));
}

export function mapAttentionPoints(api: AttentionApiResponse): AttentionTrendPoint[] {
  return api.points.map((p) => {
    const raw = p.attention_score;
    const attention = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
    return {
      time: formatTimeLabel(p.video_timestamp),
      attention,
      baseline: 80,
    };
  });
}

/** Derive speed distribution from seek events payload is not available — use overview avg as single bin when no samples */
export function mapSpeedFallback(avgSpeed: number): SpeedDistribution[] {
  const label = `${avgSpeed.toFixed(2)}x`;
  return [{ speed: label, count: 1, percentage: 100 }];
}

export async function fetchOverview(q: AnalyticsQuery = {}): Promise<OverviewApiResponse> {
  const { data } = await apiClient.get<OverviewApiResponse>("/analytics/overview", {
    params: {
      trend_days: q.trendDays ?? 7,
      session_id: q.sessionId || undefined,
      video_id: q.videoId || undefined,
    },
  });
  return data;
}

export async function fetchTimeline(q: AnalyticsQuery = {}): Promise<TimelineApiResponse> {
  const { data } = await apiClient.get<TimelineApiResponse>("/analytics/timeline", {
    params: {
      session_id: q.sessionId || undefined,
      video_id: q.videoId || undefined,
      bucket_seconds: q.bucketSeconds ?? 30,
    },
  });
  return data;
}

export async function fetchAttention(q: AnalyticsQuery = {}): Promise<AttentionApiResponse> {
  const { data } = await apiClient.get<AttentionApiResponse>("/analytics/attention", {
    params: {
      session_id: q.sessionId || undefined,
      video_id: q.videoId || undefined,
      page: 1,
      page_size: 500,
    },
  });
  return data;
}

export async function fetchSeekEvents(q: AnalyticsQuery = {}): Promise<EventsApiResponse> {
  const { data } = await apiClient.get<EventsApiResponse>("/analytics/events", {
    params: {
      session_id: q.sessionId || undefined,
      video_id: q.videoId || undefined,
      page: 1,
      page_size: 200,
    },
  });
  return data;
}
