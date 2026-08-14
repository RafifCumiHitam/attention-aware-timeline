"use client";

import { useMemo } from "react";
import {
  Clock,
  Eye,
  Gauge,
  PauseCircle,
  CheckCircle2,
  CalendarDays,
  Activity,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ChartCard,
  StatCard,
  WatchTimeChart,
  SeekHeatmapChart,
  PlaybackSpeedChart,
  PauseFrequencyChart,
  CompletionRateChart,
  DailyActivityChart,
  AttentionChart,
  DifficultyTimelineChart,
  useAnalyticsData,
  useDifficultyTimeline,
} from "@/features/analytics";

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <Activity className="mb-3 h-10 w-10 text-muted-foreground" />
      <h3 className="text-lg font-semibold">No analytics yet</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Watch a lesson on the Learn page. Interaction events and attention samples will appear here
        after they are stored in PostgreSQL.
      </p>
      <Button type="button" variant="outline" className="mt-4 gap-2" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" /> Refresh
      </Button>
    </div>
  );
}

function ErrorState({ message, onRefresh }: { message: string; onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
      <h3 className="text-lg font-semibold">Could not load analytics</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Ensure the API is running and you are signed in. Endpoints require JWT ownership checks.
      </p>
      <Button type="button" variant="outline" className="mt-4 gap-2" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" /> Retry
      </Button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const {
    state,
    error,
    summary,
    dailyActivity,
    watchTimeByModule,
    seekHeatmap,
    pauseFrequency,
    attentionTrend,
    completionRate,
    playbackSpeed,
    refresh,
  } = useAnalyticsData({ trendDays: 7, bucketSeconds: 30 });

  // Prefer first top video from overview (when analytics loaded)
  // DEMO fallback matches Learn page placeholder UUID used in sessions
  const difficultyVideoId = useMemo(() => {
    return "00000000-0000-4000-8000-000000000101";
  }, []);

  const difficulty = useDifficultyTimeline(
    state === "success" || state === "empty" ? difficultyVideoId : null
  );

  if (state === "loading" || state === "idle") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Learning Analytics"
          description="Live metrics from your learning sessions and interaction events"
        />
        <LoadingGrid />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Learning Analytics" description="Live metrics from PostgreSQL" />
        <ErrorState message={error ?? "Unknown error"} onRefresh={refresh} />
      </div>
    );
  }

  if (state === "empty" || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Learning Analytics" description="Live metrics from PostgreSQL" />
        <EmptyState onRefresh={refresh} />
      </div>
    );
  }

  const peakSeeks =
    seekHeatmap.length > 0 ? Math.max(...seekHeatmap.map((s) => s.seeks), 0) : 0;

  const peakDifficulty =
    difficulty.bins.length > 0
      ? Math.max(...difficulty.bins.map((b) => b.difficulty))
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Learning Analytics"
          description="Watch time, attention, seeks, speed, pauses — from real interaction events"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            refresh();
            difficulty.refresh();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Watch Time"
          value={`${summary.totalWatchHours}h`}
          icon={Clock}
          delay={0}
        />
        <StatCard
          title="Avg Attention"
          value={`${summary.avgAttention}%`}
          icon={Eye}
          delay={0.05}
        />
        <StatCard
          title="Completion Rate"
          value={`${summary.completionRate}%`}
          icon={CheckCircle2}
          delay={0.1}
        />
        <StatCard
          title="Sessions"
          value={String(summary.totalSessions)}
          icon={CalendarDays}
          delay={0.15}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="difficulty">Difficulty</TabsTrigger>
          <TabsTrigger value="attention">Attention</TabsTrigger>
          <TabsTrigger value="completion">Completion</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              title="Daily Activity"
              description="Watch minutes and attention (from sessions)"
              className="lg:col-span-3"
              delay={0.05}
            >
              {dailyActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No daily data yet</p>
              ) : (
                <DailyActivityChart data={dailyActivity} />
              )}
            </ChartCard>
            <ChartCard
              title="Playback Speed"
              description="Average from SPEED_CHANGE events"
              className="lg:col-span-2"
              delay={0.1}
            >
              <PlaybackSpeedChart data={playbackSpeed} />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Watch Time by Video" description="Top videos by total watch seconds">
              {watchTimeByModule.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No watch data</p>
              ) : (
                <WatchTimeChart data={watchTimeByModule} />
              )}
            </ChartCard>
            <ChartCard title="Attention Timeline" description="Samples ordered by video_timestamp">
              {attentionTrend.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No attention samples yet
                </p>
              ) : (
                <AttentionChart data={attentionTrend} />
              )}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total Pauses" value={String(summary.totalPauses)} icon={PauseCircle} />
            <StatCard title="Avg Playback Speed" value={`${summary.avgSpeed}x`} icon={Gauge} />
            <StatCard
              title="Seek Hotspots"
              value={String(peakSeeks)}
              trendLabel="peak seeks / bin"
              icon={Activity}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Seek Heatmap"
              description="Seek counts bucketed by video_timestamp"
            >
              {seekHeatmap.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No seeks recorded</p>
              ) : (
                <SeekHeatmapChart data={seekHeatmap} />
              )}
            </ChartCard>
            <ChartCard title="Pause Frequency" description="Pauses per timeline bucket">
              {pauseFrequency.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No pauses recorded</p>
              ) : (
                <PauseFrequencyChart data={pauseFrequency} />
              )}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="difficulty" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Peak Difficulty"
              value={peakDifficulty.toFixed(2)}
              trendLabel="Behavioral Score [0–1]"
              icon={Activity}
            />
            <StatCard
              title="Buckets"
              value={String(difficulty.bins.length)}
              trendLabel={`${difficulty.meta?.bucket_seconds ?? 10}s intervals`}
              icon={Clock}
            />
            <StatCard
              title="Source Events"
              value={String(difficulty.meta?.event_count ?? 0)}
              trendLabel="pause / seek / play"
              icon={Activity}
            />
          </div>

          <ChartCard
            title={difficulty.meta?.label ?? "Behavioral Difficulty Score"}
            description={
              difficulty.meta?.disclaimer ??
              "Heuristic from pause, seek, replay, and revisit density — not scientifically validated"
            }
          >
            {difficulty.state === "loading" ? (
              <div className="h-[280px] animate-pulse rounded-md bg-muted" />
            ) : difficulty.state === "error" ? (
              <p className="py-8 text-center text-sm text-destructive">
                {difficulty.error ?? "Failed to load difficulty timeline"}
              </p>
            ) : (
              <DifficultyTimelineChart data={difficulty.bins} />
            )}
          </ChartCard>

          <p className="text-xs text-muted-foreground">
            Score weights: pause 0.20 · seek 0.20 · backward seek 0.20 · replay 0.15 · revisit 0.15 ·
            seek distance 0.10. Aligned to video timeline buckets (default 10s).
          </p>
        </TabsContent>

        <TabsContent value="attention" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              title="Attention Timeline"
              description="Focus score vs 80% baseline"
              className="lg:col-span-3"
            >
              {attentionTrend.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No samples</p>
              ) : (
                <AttentionChart data={attentionTrend} />
              )}
            </ChartCard>
            <ChartCard
              title="Daily Attention"
              description="Average attention by day"
              className="lg:col-span-2"
            >
              {dailyActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No daily data</p>
              ) : (
                <DailyActivityChart data={dailyActivity} />
              )}
            </ChartCard>
          </div>
          <ChartCard title="Seek vs Attention Zones" description="Seek density along the timeline">
            {seekHeatmap.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No seek data</p>
            ) : (
              <SeekHeatmapChart data={seekHeatmap} />
            )}
          </ChartCard>
        </TabsContent>

        <TabsContent value="completion" className="space-y-4">
          <ChartCard title="Completion by Video" description="Derived from session completion rate">
            {completionRate.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No sessions</p>
            ) : (
              <CompletionRateChart data={completionRate} />
            )}
          </ChartCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Watch Time by Video" description="Investment vs outcomes">
              {watchTimeByModule.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
              ) : (
                <WatchTimeChart data={watchTimeByModule} />
              )}
            </ChartCard>
            <ChartCard title="Daily Learning Load" description="Minutes watched per day">
              {dailyActivity.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
              ) : (
                <DailyActivityChart data={dailyActivity} />
              )}
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
