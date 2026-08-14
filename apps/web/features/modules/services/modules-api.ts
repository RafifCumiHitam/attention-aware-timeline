import apiClient from "@/lib/api-client";

export interface ModuleDto {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  thumbnail_url: string | null;
  is_active: boolean;
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

export async function listModules() {
  const { data } = await apiClient.get<{ items: ModuleDto[] }>("/modules", {
    params: { page: 1, page_size: 50 },
  });
  return data.items;
}

export async function getModule(moduleId: string) {
  const { data } = await apiClient.get<ModuleDto>(`/modules/${moduleId}`);
  return data;
}

export async function createModule(input: {
  title: string;
  description?: string;
  slug?: string;
}) {
  const { data } = await apiClient.post<ModuleDto>("/modules", input);
  return data;
}

export async function listModuleVideos(moduleId: string) {
  const { data } = await apiClient.get<ModuleVideoDto[]>(`/modules/${moduleId}/videos`);
  return data;
}

export async function importYouTubeVideo(moduleId: string, youtubeVideoId: string) {
  const { data } = await apiClient.post<ModuleVideoDto>(`/modules/${moduleId}/videos`, {
    youtube_video_id: youtubeVideoId,
  });
  return data;
}

export async function searchYouTube(q: string, maxResults = 10) {
  const { data } = await apiClient.get<{ items: YouTubeSearchItem[] }>("/youtube/search", {
    params: { q, max_results: maxResults },
  });
  return data.items;
}

export async function startLearningSession(videoId: string, moduleId?: string) {
  const { data } = await apiClient.post<{ id: string; video_id: string; module_id?: string; status: string }>(
    "/sessions",
    { video_id: videoId, module_id: moduleId || undefined }
  );
  return data;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
