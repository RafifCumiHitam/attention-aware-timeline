"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface VideoTimelineProps {
  progress: number;
  buffered: number;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  formatTime: (seconds: number) => string;
  className?: string;
}

export function VideoTimeline({
  progress,
  buffered,
  duration,
  currentTime,
  onSeek,
  formatTime,
  className,
}: VideoTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || duration <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    seekFromClientX(e.clientX);
  };

  return (
    <div className={cn("group/timeline flex items-center gap-2", className)}>
      <span className="min-w-[40px] text-right text-xs tabular-nums text-white/80">
        {formatTime(currentTime)}
      </span>
      <div
        ref={barRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
        tabIndex={0}
        className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20 transition-all group-hover/timeline:h-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        {/* Buffered */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/30"
          style={{ width: `${buffered}%` }}
        />
        {/* Progress */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-primary shadow-md opacity-0 transition-opacity group-hover/timeline:opacity-100"
          style={{ left: `calc(${progress}% - 7px)` }}
        />
      </div>
      <span className="min-w-[40px] text-xs tabular-nums text-white/80">
        {formatTime(duration)}
      </span>
    </div>
  );
}
