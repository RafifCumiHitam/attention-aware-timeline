import apiClient from "@/lib/api-client";
import { extractApiError } from "@/lib/api-error";

export interface ModuleDto {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ModuleVideoDto {
  id: string;
  module_id: string | null;
  youtube_video_id: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  channel_title: string | null;
  position: number;
  source_type: string;
  is_active: boolean;
  is_published: boolean;
}

export interface YouTubeSearchItem {
  youtube_video_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  channel_title: string | null;
}

export interface SessionDto {
  id: string;
  video_id: string;
  module_id?: string | null;
  status: string;
  user_id?: string;
}

export async function listModules(): Promise<ModuleDto[]> {
  try {
    const { data } = await apiClient.get<{
      items: ModuleDto[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>("/modules", {
      params: { page: 1, page_size: 50 },
    });
    return data.items ?? [];
  } catch (err) {
    throw new Error(extractApiError(err, "Failed to load modules"));
  }
}

export async function getModule(moduleId: string): Promise<ModuleDto> {
  try {
    const { data } = await apiClient.get<ModuleDto>(`/modules/${moduleId}`);
    return data;
  } catch (err) {
    throw new Error(extractApiError(err, "Failed to load module"));
  }
}

export async function createModule(input: {
  title: string;
  description?: string;
  slug?: string;
}): Promise<ModuleDto> {
  try {
    const { data } = await apiClient.post<ModuleDto>("/modules", input);
    return data;
  } catch (err) {
    throw new Error(extractApiError(err, "Failed to create module"));
  }
}

export async function listModuleVideos(moduleId: string): Promise<ModuleVideoDto[]> {
  try {
    const { data } = await apiClient.get<ModuleVideoDto[]>(`/modules/${moduleId}/videos`);
    // Defense in depth — only show active published lessons in the learner UI
    return (data ?? []).filter((v) => v.is_active && v.is_published);
  } catch (err) {
    throw new Error(extractApiError(err, "Failed to load module videos"));
  }
}

export async function importYouTubeVideo(
  moduleId: string,
  youtubeVideoId: string
): Promise<ModuleVideoDto> {
  try {
    const { data } = await apiClient.post<ModuleVideoDto>(`/modules/${moduleId}/videos`, {
      youtube_video_id: youtubeVideoId,
    });
    return data;
  } catch (err) {
    throw new Error(extractApiError(err, "Failed to import YouTube video"));
  }
}

export async function searchYouTube(q: string, maxResults = 10): Promise<YouTubeSearchItem[]> {
  try {
    const { data } = await apiClient.get<{ items: YouTubeSearchItem[] }>("/youtube/search", {
      params: { q, max_results: maxResults },
    });
    return data.items ?? [];
  } catch (err) {
    throw new Error(extractApiError(err, "YouTube search failed"));
  }
}

/** Create/resume persistent learning session — never invent a client UUID. */
export async function startLearningSession(
  videoId: string,
  moduleId?: string
): Promise<SessionDto> {
  try {
    const { data } = await apiClient.post<SessionDto>("/sessions", {
      video_id: videoId,
      module_id: moduleId || undefined,
    });
    return data;
  } catch (err) {
    throw new Error(extractApiError(err, "Failed to start learning session"));
  }
}

export async function getVideo(videoId: string) {
  try {
    const { data } = await apiClient.get(`/${"videos"}/${videoId}`);
    return data;
  } catch (err) {
    throw new Error(extractApiError(err, "Video not found"));
  }
}

export function formatDuration(sec: number): string {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
