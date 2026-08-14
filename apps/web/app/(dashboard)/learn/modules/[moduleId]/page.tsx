"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Play, Search, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatDuration,
  getModule,
  importYouTubeVideo,
  listModuleVideos,
  searchYouTube,
  startLearningSession,
  type ModuleDto,
  type ModuleVideoDto,
  type YouTubeSearchItem,
} from "@/features/modules/services/modules-api";
import { useSessionStore } from "@/stores/session-store";

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = String(params.moduleId);
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);

  const [module, setModule] = useState<ModuleDto | null>(null);
  const [videos, setVideos] = useState<ModuleVideoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Admin search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, v] = await Promise.all([getModule(moduleId), listModuleVideos(moduleId)]);
      setModule(m);
      setVideos(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load module");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStart(video: ModuleVideoDto) {
    setStartingId(video.id);
    setError(null);
    try {
      // Persistent session from backend — not a client UUID
      const session = await startLearningSession(video.id, moduleId);
      setSession({
        sessionId: session.id,
        videoId: session.video_id,
        status: "active",
      });
      router.push(
        `/learn/watch?videoId=${encodeURIComponent(video.id)}&sessionId=${encodeURIComponent(session.id)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStartingId(null);
    }
  }

  async function onSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchYouTube(query.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "YouTube search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function onAdd(ytId: string) {
    setAddingId(ytId);
    setError(null);
    try {
      await importYouTubeVideo(moduleId, ytId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed (duplicate or unavailable)");
    } finally {
      setAddingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={module?.title ?? "Module"}
        description={module?.description ?? "Select a video to start a persistent learning session"}
      />

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Videos</h2>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No videos yet. Import from YouTube below.
          </p>
        ) : (
          <div className="grid gap-3">
            {videos.map((v) => (
              <Card key={v.id} className="overflow-hidden">
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:w-40">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{v.title}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{formatDuration(v.duration_seconds)}</span>
                      {v.channel_title && <span>· {v.channel_title}</span>}
                      <Badge variant="outline">{v.source_type}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      video_id={v.id.slice(0, 8)}…
                      {v.youtube_video_id ? ` · yt=${v.youtube_video_id}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="shrink-0 gap-2"
                    disabled={startingId === v.id}
                    onClick={() => void onStart(v)}
                  >
                    {startingId === v.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start Learning
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add YouTube video</CardTitle>
          <CardDescription>
            Search uses server-side YouTube Data API — API key never reaches the browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="neural network basics"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onSearch()}
              className="max-w-md"
            />
            <Button type="button" variant="secondary" onClick={() => void onSearch()} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          <div className="grid gap-3">
            {results.map((r) => (
              <div
                key={r.youtube_video_id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <div className="relative h-20 w-full shrink-0 overflow-hidden rounded bg-muted sm:w-32">
                  {r.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.channel_title}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    yt={r.youtube_video_id}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  disabled={addingId === r.youtube_video_id}
                  onClick={() => void onAdd(r.youtube_video_id)}
                >
                  {addingId === r.youtube_video_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add to Module
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
