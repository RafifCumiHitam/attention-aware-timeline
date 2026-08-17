"use client";

/**
 * Watch page — pipeline + clickstream + intervention (Sprint 20).
 * VideoPlayer stays free of intervention rules.
 */

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, LogIn } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import apiClient from "@/lib/api-client";
import { extractApiError } from "@/lib/api-error";
import {
  VideoPlayer,
  useAttentionPipeline,
  useEventLogger,
  getEventService,
  useClickstream,
  useIntervention,
  InterventionBanner,
} from "@/features/learn";
import { YouTubePlayer } from "@/features/learn/components/youtube-player";
import { FaceTrackerLazy } from "@/features/attention";
import { RealtimeLearningPanel } from "@/components/realtime/RealtimeLearningPanel";
import { useSessionStore } from "@/stores/session-store";
import { startLearningSession } from "@/features/modules/services/modules-api";
import type {
  VideoPlayerEventMeta,
  VideoPlayerEventPayload,
  VideoPlayerEventType,
} from "@/features/learn/types/video-player";
import type { FinalizedSeekEvent } from "@/features/learn/clickstream";

interface VideoDetail {
  id: string;
  title: string;
  description?: string | null;
  video_url: string;
  youtube_video_id?: string | null;
  source_type?: string;
  duration_seconds: number;
  module_id?: string | null;
  is_published?: boolean;
  is_active?: boolean;
}

function WatchInner() {
  const search = useSearchParams();
  const router = useRouter();
  const videoId = search.get("videoId") || "";
  const sessionIdParam = search.get("sessionId") || "";
  const experimentCondition =
    search.get("condition") === "CONTROL" ? "CONTROL" : "EXPERIMENTAL";

  const setSession = useSessionStore((s) => s.setSession);
  const storeSessionId = useSessionStore((s) => s.sessionId);

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [sessionId, setSessionId] = useState(sessionIdParam || storeSessionId || "");
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    if (!videoId) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<VideoDetail>(`/videos/${videoId}`);
        if (!cancelled) setVideo(data);
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Video not found"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!videoId || !video) return;
    let cancelled = false;

    async function ensureSession() {
      setBootstrapping(true);
      try {
        if (sessionIdParam) {
          if (!cancelled) {
            setSessionId(sessionIdParam);
            setSession({ sessionId: sessionIdParam, videoId, status: "active" });
            getEventService().setContext({ sessionId: sessionIdParam, videoId });
          }
          return;
        }

        const s = await startLearningSession(videoId, video.module_id ?? undefined);
        if (cancelled) return;
        setSessionId(s.id);
        setSession({ sessionId: s.id, videoId: s.video_id, status: "active" });
        getEventService().setContext({ sessionId: s.id, videoId: s.video_id });
        const q = new URLSearchParams({ videoId, sessionId: s.id });
        if (experimentCondition === "CONTROL") q.set("condition", "CONTROL");
        router.replace(`/learn/watch?${q.toString()}`);
      } catch (e) {
        if (!cancelled) setError(extractApiError(e, "Could not start learning session"));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void ensureSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, video?.id]);

  const pipeline = useAttentionPipeline({
    sessionId,
    videoId,
    autoConnect: Boolean(sessionId),
  });

  const { onPlayerEvent, flush, log } = useEventLogger({
    getAttentionScore: () => pipeline.attentionScore,
  });

  const intervention = useIntervention({
    sessionId,
    videoId,
    moduleId: video?.module_id,
    experimentCondition,
    getAttentionScore: () => pipeline.attentionScore,
    onLifecycleEvent: (type, ctx) => {
      log("CUSTOM", {
        currentTime: ctx.resumeTimestamp ?? 0,
        playbackSpeed: pipeline.adaptivePlaybackRate,
        buffer: 0,
        fullscreen: false,
        meta: {
          event_type_raw: type,
          intervention_state: ctx.state,
          target_zone_id: ctx.interventionZoneId,
          resume_timestamp: ctx.resumeTimestamp,
          experiment_condition: ctx.experimentCondition,
          triggered_intervention: type === "INTERVENTION_TRIGGERED",
          triggered_remedial: type === "REMEDIAL_OPENED",
          raw_vs_derived: "derived",
        },
      });
    },
  });

  const { onPlayerEvent: onClickstreamEvent, seekToResearchMeta } = useClickstream({
    getAdaptiveRate: () => pipeline.adaptivePlaybackRate,
    onFinalizedSeek: (seek: FinalizedSeekEvent) => {
      // Derived research event (always log classification; counters only if meaningful)
      log(seek.type === "FORWARD_SEEK" ? "SEEK_FORWARD" : "SEEK_BACKWARD", {
        currentTime: seek.to,
        playbackSpeed: seek.playbackRate,
        buffer: 0,
        fullscreen: false,
        meta: {
          ...seekToResearchMeta(seek),
          experiment_condition: experimentCondition,
        },
      });
      intervention.handleFinalizedSeek(seek);
    },
  });

  const pipelineEventRef = useRef(pipeline.onPlayerEvent);
  const loggerEventRef = useRef(onPlayerEvent);
  const clickstreamRef = useRef(onClickstreamEvent);
  pipelineEventRef.current = pipeline.onPlayerEvent;
  loggerEventRef.current = onPlayerEvent;
  clickstreamRef.current = onClickstreamEvent;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const handleEvent = useCallback(
    (
      type: VideoPlayerEventType,
      payload: VideoPlayerEventPayload[VideoPlayerEventType],
      meta: VideoPlayerEventMeta
    ) => {
      if (!sessionIdRef.current) return;

      // SPEED_CHANGE: tag user vs adaptive in raw log path
      if (type === "SPEED_CHANGE") {
        const p = payload as VideoPlayerEventPayload["SPEED_CHANGE"];
        const adaptive = pipeline.adaptivePlaybackRate;
        const source =
          adaptive != null && Math.abs((p.to ?? meta.playbackRate) - adaptive) < 0.01
            ? "adaptive"
            : "user";
        loggerEventRef.current(type, payload, meta);
        // Re-log meta enrichment via service is already in onPlayerEvent;
        // extra note for research:
        log("SPEED_CHANGE", {
          currentTime: meta.currentTime,
          playbackSpeed: meta.playbackRate,
          buffer: meta.buffer,
          fullscreen: meta.fullscreen,
          meta: {
            from: p.from,
            to: p.to,
            speed_change_source: source,
            raw_vs_derived: "raw",
          },
        });
        pipelineEventRef.current(type, payload, meta);
        return;
      }

      // Seeks: raw path still logs immediately via logger; clickstream finalizes
      pipelineEventRef.current(type, payload, meta);
      if (type === "SEEK_FORWARD" || type === "SEEK_BACKWARD") {
        // Defer meaningful classification to clickstream finalizer (debounce).
        // Skip immediate raw logger duplicate storms — finalizer emits one event.
        clickstreamRef.current(type, payload, meta);
        return;
      }
      loggerEventRef.current(type, payload, meta);
      clickstreamRef.current(type, payload, meta);
    },
    [log, pipeline.adaptivePlaybackRate]
  );

  const adaptiveRate = pipeline.adaptivePlaybackRate;

  const isYouTube = useMemo(
    () => video?.source_type === "youtube" || Boolean(video?.youtube_video_id),
    [video]
  );

  if (!videoId) {
    return (
      <p className="text-sm text-muted-foreground">
        Missing <code>videoId</code> query param. Open a lesson from a module first.
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
        {error.toLowerCase().includes("sign in") && (
          <Button type="button" className="gap-2" onClick={() => router.push("/login")}>
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.push("/learn")}>
          Back to modules
        </Button>
      </div>
    );
  }

  if (!video || bootstrapping || !sessionId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        Preparing session…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={video.title} description="Session-bound adaptive learning" />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="font-mono">
          session: {sessionId.slice(0, 8)}…
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
        <Badge variant={experimentCondition === "CONTROL" ? "outline" : "secondary"}>
          {experimentCondition}
        </Badge>
        <Badge variant={pipeline.connectionStatus === "connected" ? "default" : "secondary"}>
          WS {pipeline.connectionStatus}
        </Badge>
        {intervention.state !== "IDLE" && (
          <Badge variant="outline">ix: {intervention.state}</Badge>
        )}
        {adaptiveRate !== 1 && (
          <Badge variant="secondary">{adaptiveRate}x adaptive</Badge>
        )}
      </div>

      <InterventionBanner
        showNotify={intervention.showNotify}
        showRemedial={intervention.showRemedial}
        onComplete={intervention.completeRemedial}
        onDismiss={intervention.dismissRemedial}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isYouTube && video.youtube_video_id ? (
            <YouTubePlayer
              youtubeVideoId={video.youtube_video_id}
              title={video.title}
              externalPlaybackRate={adaptiveRate}
              onEvent={handleEvent}
              onVideoEnd={() => void flush()}
            />
          ) : (
            <VideoPlayer
              src={video.video_url}
              title={video.title}
              externalPlaybackRate={adaptiveRate}
              onEvent={handleEvent}
              onVideoEnd={() => void flush()}
            />
          )}

          <RealtimeLearningPanel sessionId={sessionId} videoId={videoId} autoConnect={false} />
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
