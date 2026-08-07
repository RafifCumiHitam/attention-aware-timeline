"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Clock,
  CheckCircle2,
  Circle,
  Play,
  Wifi,
  WifiOff,
  Upload,
  Gauge,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RealtimeLearningPanel } from "@/components/realtime/RealtimeLearningPanel";
import {
  VideoPlayer,
  useEventLogger,
  useAttentionPipeline,
  useSessionLifecycle,
  getEventService,
  type EventSnapshot,
} from "@/features/learn";
import { FaceTrackerLazy } from "@/features/attention";

const lessons = [
  { id: 1, title: "What is Attention?", duration: "8:24", completed: true },
  { id: 2, title: "Gaze Estimation Basics", duration: "12:10", completed: true },
  { id: 3, title: "Building Focus Metrics", duration: "15:45", completed: false, current: true },
  { id: 4, title: "Adaptive Content Delivery", duration: "10:30", completed: false },
  { id: 5, title: "Real-time Feedback Loops", duration: "14:00", completed: false },
  { id: 6, title: "Case Study: Learning Outcomes", duration: "18:20", completed: false },
];

const DEMO_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const DEMO_SUBTITLES = [
  {
    id: "en",
    label: "English",
    srclang: "en",
    src: "https://raw.githubusercontent.com/videojs/video.js/main/docs/examples/shared/example-caption.vtt",
    default: true,
  },
];

/** Stable demo video UUID placeholder — replace with real catalog id when auth+DB seeded */
const DEMO_VIDEO_ID = "00000000-0000-4000-8000-000000000101";

export default function LearnPage() {
  const [localLog, setLocalLog] = useState<EventSnapshot[]>([]);

  const session = useSessionLifecycle({
    videoId: DEMO_VIDEO_ID,
    autoRecover: true,
  });

  const pipeline = useAttentionPipeline({
    sessionId: session.sessionId,
    videoId: DEMO_VIDEO_ID,
    telemetryIntervalMs: 1000,
    autoConnect: true,
  });

  const { onPlayerEvent, flush, status } = useEventLogger({
    debounceMs: 800,
    maxRetries: 5,
    getAttentionScore: () => pipeline.attentionScore,
  });

  // Sync event logger context whenever session settles
  useEffect(() => {
    if (session.sessionId) {
      getEventService().setContext({
        sessionId: session.sessionId,
        videoId: DEMO_VIDEO_ID,
      });
    }
  }, [session.sessionId]);

  const handlePlayerEvent = useCallback(
    (
      type: Parameters<typeof pipeline.onPlayerEvent>[0],
      payload: Parameters<typeof pipeline.onPlayerEvent>[1],
      meta: Parameters<typeof pipeline.onPlayerEvent>[2]
    ) => {
      pipeline.onPlayerEvent(type, payload, meta);

      // Only queue REST events when session is writable
      if (session.canWrite()) {
        onPlayerEvent(type, payload, meta);
      }

      if (type === "VIDEO_END") {
        void session.end(false);
      }
      if (type === "PAUSE") {
        // soft pause marker only — full PAUSED status on tab hide optional
      }

      if (type !== "TIME_UPDATE") {
        const snap: EventSnapshot = {
          id: crypto.randomUUID?.() ?? String(Date.now()),
          timestamp: new Date().toISOString(),
          eventType: type as EventSnapshot["eventType"],
          currentTime: meta.currentTime,
          playbackSpeed: meta.playbackRate,
          buffer: meta.buffer,
          fullscreen: meta.fullscreen,
          volume: meta.volume,
          muted: meta.muted,
          videoSrc: meta.videoSrc,
          sessionId: session.sessionId,
          videoId: DEMO_VIDEO_ID,
        };
        setLocalLog((prev) => [snap, ...prev].slice(0, 25));
      }
    },
    [pipeline, onPlayerEvent, session]
  );

  const onCameraError = useCallback(() => {
    // Camera permission denied — same session_id, log via event service if writable
    if (!session.canWrite()) return;
    getEventService().log("CUSTOM", {
      currentTime: 0,
      playbackSpeed: 1,
      buffer: 0,
      fullscreen: false,
      sessionId: session.sessionId,
      videoId: DEMO_VIDEO_ID,
      meta: { reason: "camera_denied" },
    });
  }, [session]);

  return (
    <div>
      <PageHeader
        title="Video Learning"
        description="Attention-aware adaptive video lessons"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono">
          session: {session.sessionId ? `${session.sessionId.slice(0, 8)}…` : "booting…"}
        </Badge>
        <Badge variant={session.isWritable ? "default" : "destructive"}>
          {session.status}
        </Badge>
        <Badge variant={pipeline.connectionStatus === "connected" ? "default" : "secondary"}>
          WS {pipeline.connectionStatus}
        </Badge>
        {pipeline.adaptiveReason && (
          <Badge variant="secondary" className="max-w-md truncate gap-1">
            <Gauge className="h-3 w-3" />
            {pipeline.adaptivePlaybackRate}x · {pipeline.adaptiveAction}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <VideoPlayer
              src={DEMO_VIDEO}
              title="Building Focus Metrics"
              poster="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
              subtitles={DEMO_SUBTITLES}
              attentionScore={Math.round(pipeline.attentionScore * 100)}
              externalPlaybackRate={pipeline.adaptivePlaybackRate}
              seekStep={10}
              onEvent={handlePlayerEvent}
              onVideoEnd={() => {
                void flush();
                void session.end(false);
              }}
            />
          </motion.div>

          <RealtimeLearningPanel
            sessionId={session.sessionId ?? pipeline.sessionId}
            videoId={DEMO_VIDEO_ID}
            autoConnect={false}
          />

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Building Focus Metrics</CardTitle>
                  <CardDescription className="mt-1">
                    One session_id binds face telemetry, player events, adaptive decisions, and
                    WebSocket. Closed sessions reject new writes.
                  </CardDescription>
                </div>
                <Badge variant="secondary">Module 3</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> 15:45
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Attention{" "}
                  {Math.round(pipeline.attentionScore * 100)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" /> Rate {pipeline.adaptivePlaybackRate}x
                </span>
              </div>
              {pipeline.adaptiveReason && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {pipeline.adaptiveReason}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Event Logger</CardTitle>
                  <CardDescription>
                    session_id · video_timestamp · client_timestamp → FastAPI
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={status.isOnline ? "default" : "destructive"} className="gap-1">
                    {status.isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {status.isOnline ? "Online" : "Offline"}
                  </Badge>
                  <Badge variant="outline">Queue: {status.queueLength}</Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    onClick={() => void flush()}
                  >
                    <Upload className="h-3 w-3" /> Flush
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40 rounded-md border bg-muted/30 p-2">
                {localLog.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">
                    Interact with the player — all events carry the same session_id.
                  </p>
                ) : (
                  <ul className="space-y-1.5 font-mono text-[11px]">
                    {localLog.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border/40 pb-1 last:border-0"
                      >
                        <span className="text-muted-foreground">
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-semibold text-primary">{e.eventType}</span>
                        <span>t={e.currentTime.toFixed(1)}s</span>
                        <span>{e.playbackSpeed}x</span>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Attention Camera</CardTitle>
              <CardDescription>
                Same session_id as the player — no separate camera session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaceTrackerLazy
                className="aspect-video w-full"
                autoStart={false}
                onResult={pipeline.onFaceResult}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course Playlist</CardTitle>
              <CardDescription>Attention-Aware Learning Fundamentals</CardDescription>
              <Progress value={33} className="mt-2 h-1.5" />
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                <div className="space-y-1 p-3">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent",
                        lesson.current && "bg-primary/10 hover:bg-primary/15"
                      )}
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                      ) : lesson.current ? (
                        <Play className="h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            lesson.current && "text-primary"
                          )}
                        >
                          {lesson.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{lesson.duration}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
