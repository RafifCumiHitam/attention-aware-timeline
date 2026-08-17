import type { ClickstreamConfig } from "./config";
import { DEFAULT_CLICKSTREAM_CONFIG } from "./config";
import type { FinalizedSeekEvent, ZoneStats } from "./types";

export function zoneIdForTime(t: number, zoneSize: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  return Math.floor(t / zoneSize);
}

/**
 * Session-scoped zone behavioral counters.
 * Only meaningful backward seeks update pressure (research-safe).
 */
export class ZoneCounter {
  private zones = new Map<number, ZoneStats>();
  private config: ClickstreamConfig;

  constructor(config: Partial<ClickstreamConfig> = {}) {
    this.config = { ...DEFAULT_CLICKSTREAM_CONFIG, ...config };
  }

  get(zoneId: number): ZoneStats {
    let z = this.zones.get(zoneId);
    if (!z) {
      z = {
        zoneId,
        meaningfulEntries: 0,
        backwardReturns: 0,
        revisitCount: 0,
        behavioralPressure: 0,
      };
      this.zones.set(zoneId, z);
    }
    return z;
  }

  /** Apply a finalized seek — ignores non-meaningful seeks for counters */
  applySeek(seek: FinalizedSeekEvent): ZoneStats | null {
    if (!seek.isMeaningful) return null;
    if (seek.direction !== "BACKWARD") return null;

    const z = this.get(seek.targetZoneId);
    z.meaningfulEntries += 1;
    z.backwardReturns += 1;
    // revisit = returning to a zone already visited meaningfully
    if (z.meaningfulEntries >= 2) {
      z.revisitCount += 1;
    }
    z.behavioralPressure = Math.min(
      1,
      z.revisitCount * this.config.pressurePerRevisit +
        (z.backwardReturns >= this.config.requiredRevisits ? 0.3 : 0)
    );
    return { ...z };
  }

  resetZone(zoneId: number): void {
    this.zones.set(zoneId, {
      zoneId,
      meaningfulEntries: 0,
      backwardReturns: 0,
      revisitCount: 0,
      behavioralPressure: 0,
    });
  }

  snapshot(): ZoneStats[] {
    return Array.from(this.zones.values()).map((z) => ({ ...z }));
  }

  clear(): void {
    this.zones.clear();
  }
}
