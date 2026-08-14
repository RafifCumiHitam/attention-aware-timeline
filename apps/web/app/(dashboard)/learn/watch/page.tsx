"use client";

/**
 * Learning watch page — binds internal video_id + session_id + YouTube/HTML5 player.
 * youtube_video_id is ONLY for the player source.
 */

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import apiClient from "@/lib/api-client";
import {
  VideoPlayer,
  YouTubePlayer,
  useAttentionPipeline,
  useEventLogger,
  getEventService,
} from "@/features/learn";
import { FaceTrackerLazy } from "@/features/attention";
import { RealtimeLearningPanel } from "@/components/realtime/RealtimeLearningPanel";
import { useSessionStore } from "@/stores/session-store";

// Re-export YouTubePlayer via learn index — local import fallback
import { YouTubePlayer as YTPlayer } from "@/features/learn/components/youtube-player";

interface VideoDetail {
  id: string;
  title: string;
  description?: string | null;
  video_url: string;
  youtube_video_id?: string | null;
  source_type?: string;
  duration_seconds: number;
  module_id?: string | null;
}

function WatchInner() {
  const search = useSearchParams();
  const videoId = search.get("videoId") || "";
  const sessionIdParam = search.get("sessionId") || "";

  const storeSessionId = useSessionStore((s) => s.sessionId);
  const setSession = useSessionStore((s) => s.setSession);

  const sessionId = sessionIdParam || storeSessionId || "";

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<VideoDetail>(`/videos/${videoId}`);
        if (!cancelled) setVideo(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Video not found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (sessionId && videoId) {
      setSession({ sessionId, videoId, status: "active" });
      getEventService().setContext({ sessionId, videoId });
    }
  }, [sessionId, videoId, setSession]);

  const pipeline = useAttentionPipeline({
    sessionId,
    videoId,
    autoConnect: Boolean(sessionId),
  });

  const { onPlayerEvent } = useEventLogger({
    getAttentionScore: () => pipeline.attentionScore,
  });

  const isYouTube = useMemo(
    () =>
      video?.source_type === "youtube" || Boolean(video?.youtube_video_id),
    [video]
  );

  if (!videoId) {
    return <p className="text-sm text-muted-foreground">Missing videoId query param.</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!video) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleEvent = (
    type: Parameters<typeof pipeline.onPlayerEvent>[0],
    payload: Parameters<typeof pipeline.onPlayerEvent>[1],
    meta: Parameters<typeof pipeline.onPlayerEvent>[2]
  ) => {
    pipeline.onPlayerEvent(type, payload, meta);
    onPlayerEvent(type, payload, meta);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={video.title} description="Session-bound adaptive learning" />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="font-mono">
          session: {sessionId ? `${sessionId.slice(0, 8)}…` : "none"}
        </Badge>
        <Badge variant="outline" className="font-mono">
          video_id: {video.id.slice(0, 8)}…
        </Badge>
        {video.youtube_video_id && (
          <Badge variant="secondary" className="font-mono">
            yt: {video.youtube_video_id}
          </Badge>
        )}
        <Badge>{isYouTube ? "YouTube" : "HTML5"}</Badge>
        <Badge variant={pipeline.connectionStatus === "connected" ? "default" : "secondary"}>
          WS {pipeline.connectionStatus}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isYouTube && video.youtube_video_id ? (
            <YTPlayer
              youtubeVideoId={video.youtube_video_id}
              title={video.title}
              externalPlaybackRate={pipeline.adaptivePlaybackRate}
              onEvent={handleEvent}
            />
          ) : (
            <VideoPlayer
              src={video.video_url}
              title={video.title}
              externalPlaybackRate={pipeline.adaptivePlaybackRate}
              onEvent={handleEvent}
            />
          )}

          <RealtimeLearningPanel
            sessionId={sessionId}
            videoId={videoId}
            autoConnect={false}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attention Camera</CardTitle>
          </CardHeader>
          <CardContent>
            <FaceTrackerLazy
              className="aspect-video w-full"
              autoStart={false}
              onResult={pipeline.onFaceResult}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WatchInner />
    </Suspense>
  );
}
