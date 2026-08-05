"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Captions,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { VideoTimeline } from "./video-timeline";
import { cn } from "@/lib/utils";
import type { SubtitleTrack } from "../types/video-player";

interface VideoControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
  progress: number;
  playbackRate: number;
  playbackRates: number[];
  subtitles?: SubtitleTrack[];
  activeSubtitleIndex: number | null;
  seekStep: number;
  onTogglePlay: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleFullscreen: () => void;
  onSubtitleChange: (index: number | null) => void;
  formatTime: (s: number) => string;
  className?: string;
}

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <VolumeX className="h-4 w-4" />;
  if (volume < 0.5) return <Volume1 className="h-4 w-4" />;
  return <Volume2 className="h-4 w-4" />;
}

export function VideoControls({
  isPlaying,
  isMuted,
  isFullscreen,
  volume,
  currentTime,
  duration,
  buffered,
  progress,
  playbackRate,
  playbackRates,
  subtitles = [],
  activeSubtitleIndex,
  seekStep,
  onTogglePlay,
  onSeekForward,
  onSeekBackward,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onToggleFullscreen,
  onSubtitleChange,
  formatTime,
  className,
}: VideoControlsProps) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-10",
        className
      )}
    >
      <VideoTimeline
        progress={progress}
        buffered={buffered}
        duration={duration}
        currentTime={currentTime}
        onSeek={onSeek}
        formatTime={formatTime}
        className="mb-2"
      />

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/20"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onSeekBackward}
            aria-label={`Seek back ${seekStep}s`}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onSeekForward}
            aria-label={`Seek forward ${seekStep}s`}
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          {/* Volume */}
          <div className="group/vol flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onToggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              <VolumeIcon volume={volume} muted={isMuted} />
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-1 w-0 origin-left scale-x-0 opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:scale-x-100 group-hover/vol:opacity-100 accent-primary"
              aria-label="Volume"
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Speed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs text-white hover:bg-white/20"
              >
                <Gauge className="h-3.5 w-3.5" />
                {playbackRate}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[100px]">
              <DropdownMenuLabel className="text-xs">Speed</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {playbackRates.map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => onPlaybackRateChange(rate)}
                  className={cn(rate === playbackRate && "bg-accent font-medium")}
                >
                  {rate}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 text-white hover:bg-white/20",
                    activeSubtitleIndex !== null && "text-primary"
                  )}
                  aria-label="Subtitles"
                >
                  <Captions className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Subtitles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onSubtitleChange(null)}
                  className={cn(activeSubtitleIndex === null && "bg-accent font-medium")}
                >
                  Off
                </DropdownMenuItem>
                {subtitles.map((track, i) => (
                  <DropdownMenuItem
                    key={track.id}
                    onClick={() => onSubtitleChange(i)}
                    className={cn(activeSubtitleIndex === i && "bg-accent font-medium")}
                  >
                    {track.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Fullscreen */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
