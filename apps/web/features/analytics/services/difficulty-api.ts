import apiClient from "@/lib/api-client";
import type { DifficultyBin } from "../components/difficulty-timeline-chart";

export interface DifficultyTimelineApi {
  video_id: string;
  session_id?: string | null;
  bucket_seconds: number;
  label: string;
  disclaimer: string;
  event_count: number;
  buckets: Array<{
    video_timestamp_start: number;
    video_timestamp_end: number;
    difficulty_score: number;
    pause_density: number;
    seek_density: number;
    backward_seek_density: number;
    replay_density: number;
    revisit_density: number;
    normalized_seek_distance: number;
  }>;
}

function formatLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function mapDifficultyBins(api: DifficultyTimelineApi): DifficultyBin[] {
  return api.buckets.map((b) => ({
    start: b.video_timestamp_start,
    end: b.video_timestamp_end,
    label: formatLabel(b.video_timestamp_start),
    difficulty: b.difficulty_score,
    pause: b.pause_density,
    seek: b.seek_density,
    backward: b.backward_seek_density,
    replay: b.replay_density,
    revisit: b.revisit_density,
  }));
}

export async function fetchDifficultyTimeline(
  videoId: string,
  opts?: { bucketSeconds?: number; sessionId?: string }
): Promise<DifficultyTimelineApi> {
  const { data } = await apiClient.get<DifficultyTimelineApi>(
    `/videos/${videoId}/difficulty-timeline`,
    {
      params: {
        bucket_seconds: opts?.bucketSeconds ?? 10,
        session_id: opts?.sessionId || undefined,
      },
    }
  );
  return data;
}
