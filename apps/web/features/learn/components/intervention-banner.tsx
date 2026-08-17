"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface InterventionBannerProps {
  showNotify: boolean;
  showRemedial: boolean;
  onComplete: () => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Non-blocking pre-intervention toast + simple remedial placeholder.
 * Real LLM content is out of scope for Sprint 20.
 */
export function InterventionBanner({
  showNotify,
  showRemedial,
  onComplete,
  onDismiss,
  className,
}: InterventionBannerProps) {
  if (!showNotify && !showRemedial) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {showNotify && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          Bagian ini tampaknya perlu perhatian lebih. Kami akan membantu Anda memahami bagian
          ini.
        </div>
      )}
      {showRemedial && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Bantuan singkat (pengembangan)</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Konten remediasi penuh belum tersedia. Ini adalah placeholder pengembangan — bukan
            data penelitian fiktif. Tinjau ulang segmen video di sekitar titik resume, lalu
            lanjutkan.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={onComplete}>
              Selesai & lanjut
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
              Tutup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
