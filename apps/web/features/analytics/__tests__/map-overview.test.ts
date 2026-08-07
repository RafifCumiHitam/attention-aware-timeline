/**
 * Frontend mapping tests — ensure API → chart shapes (no mock hardcoded path).
 * Run with: npx vitest run features/analytics (when vitest is configured)
 */

import { describe, expect, it } from "vitest";
import {
  mapAttentionPoints,
  mapDailyActivity,
  mapOverviewToSummary,
  mapTimelineToSeekHeatmap,
  type OverviewApiResponse,
  type TimelineApiResponse,
  type AttentionApiResponse,
} from "../services/analytics-api";

const overviewFixture: OverviewApiResponse = {
  overview: {
    total_sessions: 2,
    completed_sessions: 1,
    total_watch_seconds: 7200,
    total_watch_hours: 2,
    completion_rate: 50,
    avg_attention_score: 0.82,
    total_videos_watched: 1,
    active_days: 1,
    pause_count: 4,
    seek_count: 3,
    forward_seek_count: 2,
    backward_seek_count: 1,
    avg_playback_speed: 1.25,
    attention_sample_count: 20,
  },
  attention_trend: {
    points: [
      {
        date: "2026-08-07",
        avg_attention: 0.8,
        session_count: 2,
        watch_seconds: 3600,
      },
    ],
    period_days: 7,
  },
  recent_sessions: [],
  top_videos: [
    {
      video_id: "v1",
      title: "Focus Metrics",
      session_count: 2,
      avg_attention: 0.8,
      total_watch_seconds: 3600,
    },
  ],
};

describe("mapOverviewToSummary", () => {
  it("maps real API counters without mock defaults", () => {
    const s = mapOverviewToSummary(overviewFixture);
    expect(s.totalSessions).toBe(2);
    expect(s.totalPauses).toBe(4);
    expect(s.avgSpeed).toBe(1.25);
    expect(s.completionRate).toBe(50);
    expect(s.totalWatchHours).toBe(2);
    expect(s.avgAttention).toBe(82);
  });
});

describe("mapDailyActivity", () => {
  it("converts watch_seconds to minutes", () => {
    const d = mapDailyActivity(overviewFixture);
    expect(d[0].watchMinutes).toBe(60);
    expect(d[0].sessions).toBe(2);
  });
});

describe("mapTimelineToSeekHeatmap", () => {
  it("uses bucket start as second", () => {
    const timeline: TimelineApiResponse = {
      buckets: [
        { start: 0, end: 30, pause_count: 1, seek_count: 2, attention_avg: 0.7, event_count: 3 },
      ],
      bucket_seconds: 30,
    };
    const bins = mapTimelineToSeekHeatmap(timeline);
    expect(bins[0].second).toBe(0);
    expect(bins[0].seeks).toBe(2);
  });
});

describe("mapAttentionPoints", () => {
  it("normalizes 0-1 scores to percent", () => {
    const api: AttentionApiResponse = {
      points: [{ video_timestamp: 124.5, attention_score: 0.38 }],
      total: 1,
      page: 1,
      page_size: 200,
    };
    const pts = mapAttentionPoints(api);
    expect(pts[0].attention).toBe(38);
    expect(pts[0].time).toBe("2:04");
  });
});
