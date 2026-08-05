"use client";

import {
  Clock,
  Eye,
  Gauge,
  PauseCircle,
  CheckCircle2,
  CalendarDays,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/features/analytics";
import {
  summary,
  dailyActivity,
  watchTimeByModule,
  seekHeatmap,
  playbackSpeed,
  pauseFrequency,
  completionRate,
  attentionTrend,
} from "@/features/analytics/data/mock-analytics";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Analytics"
        description="Watch time, attention, seeks, speed, pauses, and completion — insights for adaptive learning"
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Watch Time"
          value={`${summary.totalWatchHours}h`}
          trend={summary.trends.watchHours}
          icon={Clock}
          delay={0}
        />
        <StatCard
          title="Avg Attention"
          value={`${summary.avgAttention}%`}
          trend={summary.trends.attention}
          icon={Eye}
          delay={0.05}
        />
        <StatCard
          title="Completion Rate"
          value={`${summary.completionRate}%`}
          trend={summary.trends.completion}
          icon={CheckCircle2}
          delay={0.1}
        />
        <StatCard
          title="Sessions"
          value={String(summary.totalSessions)}
          trend={summary.trends.sessions}
          icon={CalendarDays}
          delay={0.15}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="attention">Attention</TabsTrigger>
          <TabsTrigger value="completion">Completion</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              title="Daily Activity"
              description="Watch minutes and attention over the last 7 days"
              className="lg:col-span-3"
              delay={0.05}
            >
              <DailyActivityChart data={dailyActivity} />
            </ChartCard>
            <ChartCard
              title="Playback Speed"
              description="How learners adjust speed"
              className="lg:col-span-2"
              delay={0.1}
            >
              <PlaybackSpeedChart data={playbackSpeed} />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Watch Time by Module"
              description="Total minutes spent per course module"
              delay={0.12}
            >
              <WatchTimeChart data={watchTimeByModule} />
            </ChartCard>
            <ChartCard
              title="Average Attention"
              description="Attention score across a typical lesson"
              delay={0.15}
            >
              <AttentionChart data={attentionTrend} />
            </ChartCard>
          </div>
        </TabsContent>

        {/* ── Engagement ───────────────────────────────────── */}
        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Total Pauses"
              value={String(summary.totalPauses)}
              icon={PauseCircle}
            />
            <StatCard
              title="Avg Playback Speed"
              value={`${summary.avgSpeed}x`}
              icon={Gauge}
            />
            <StatCard
              title="Seek Hotspots"
              value={String(Math.max(...seekHeatmap.map((s) => s.seeks)))}
              trendLabel="peak seeks / bin"
              icon={Activity}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Seek Heatmap"
              description="Where learners rewind or skip within a lesson"
              delay={0.05}
            >
              <SeekHeatmapChart data={seekHeatmap} />
            </ChartCard>
            <ChartCard
              title="Pause Frequency"
              description="Pauses clustered by lesson segment"
              delay={0.1}
            >
              <PauseFrequencyChart data={pauseFrequency} />
            </ChartCard>
          </div>

          <ChartCard
            title="Playback Speed Distribution"
            description="Session counts at each playback rate"
            delay={0.12}
          >
            <div className="mx-auto max-w-md">
              <PlaybackSpeedChart data={playbackSpeed} />
            </div>
          </ChartCard>
        </TabsContent>

        {/* ── Attention ────────────────────────────────────── */}
        <TabsContent value="attention" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              title="Attention Timeline"
              description="Focus score over lesson duration vs 80% target"
              className="lg:col-span-3"
            >
              <AttentionChart data={attentionTrend} />
            </ChartCard>
            <ChartCard
              title="Daily Attention"
              description="Average attention by day"
              className="lg:col-span-2"
            >
              <DailyActivityChart data={dailyActivity} />
            </ChartCard>
          </div>
          <ChartCard
            title="Seek vs Attention Correlation Zones"
            description="High seek density often aligns with attention dips — review those timestamps"
          >
            <SeekHeatmapChart data={seekHeatmap} />
          </ChartCard>
        </TabsContent>

        {/* ── Completion ───────────────────────────────────── */}
        <TabsContent value="completion" className="space-y-4">
          <ChartCard
            title="Completion Rate by Module"
            description="Completed · In progress · Not started"
          >
            <CompletionRateChart data={completionRate} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Watch Time by Module"
              description="Investment vs completion outcomes"
            >
              <WatchTimeChart data={watchTimeByModule} />
            </ChartCard>
            <ChartCard
              title="Daily Learning Load"
              description="Minutes watched per day"
            >
              <DailyActivityChart data={dailyActivity} />
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
