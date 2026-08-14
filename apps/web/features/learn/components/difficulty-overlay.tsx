"use client";

/**
 * Compact difficulty strip aligned to HTML5 video currentTime.
 * Reuses Behavioral Difficulty Score API — no duplicate scoring on client.
 */

import { useDifficultyTimeline } from "@/features/analytics";
import { cn } from "@/lib/utils";

interface Props {
  videoId: string;
  currentTime?: number;
  duration?: number;
  className?: string;
}

export function DifficultyOverlay({ videoId, currentTime = 0, duration, className }: Props) {
  const { bins, meta, state } = useDifficultyTimeline(videoId);

  if (state === "loading") {
    return <div className={cn("h-2 w-full animate-pulse rounded-full bg-muted", className)} />;
  }

  if (!bins.length) {
    return null;
  }

  const maxEnd = duration && duration > 0 ? duration : Math.max(...bins.map((b) => b.end), 1);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        {bins.map((b) => {
          const left = (b.start / maxEnd) * 100;
          const width = ((b.end - b.start) / maxEnd) * 100;
          const t = b.difficulty;
          const bg =
            t < 0.33
              ? `hsla(142, 60%, 40%, ${0.4 + t})`
              : t < 0.66
                ? `hsla(38, 92%, 48%, ${0.5 + t * 0.3})`
                : `hsla(0, 84%, 50%, ${0.65 + t * 0.25})`;
          return (
            <div
              key={b.start}
              className="absolute top-0 h-full"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.4)}%`, background: bg }}
              title={`${b.label} · difficulty ${b.difficulty.toFixed(2)}`}
            />
          );
        })}
        {duration && duration > 0 && (
          <div
            className="absolute top-0 z-10 h-full w-0.5 bg-primary"
            style={{ left: `${Math.min(100, (currentTime / duration) * 100)}%` }}
          />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {meta?.label ?? "Behavioral Difficulty"} · playhead aligned to video time
      </p>
    </div>
  );
}
