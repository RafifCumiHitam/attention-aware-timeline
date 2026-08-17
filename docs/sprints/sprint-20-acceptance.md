# Sprint 20 Acceptance Audit (Sprint 20.1)

**Date:** 2026-08-17  
**Repo:** RafifCumiHitam/attention-aware-timeline  
**Scope:** Audit only — no feature expansion, no architecture rewrite.

---

## 1. Current architecture

```
HTML5 VideoPlayer / YouTubePlayer
  → normalized VideoPlayerEventType (PLAY, PAUSE, SEEK_*, SPEED_CHANGE, …)
  → watch/page handleEvent
       ├─ useAttentionPipeline.onPlayerEvent
       ├─ useEventLogger.onPlayerEvent (raw path; seeks deferred)
       └─ useClickstream.onPlayerEvent
            → SeekFinalizer (~300ms)
            → FinalizedSeekEvent { distance, direction, isMeaningful, zones }
            → InterventionEngine.onSeek
            → useIntervention UI (notify → remedial banner)
            → EventService log with research meta (derived)
  → GET /api/v1/analytics/sessions/{id}/export?format=json|csv
```

**Separation (as designed):**

| Layer | Responsibility |
|-------|----------------|
| VideoPlayer / YouTubePlayer | Media only |
| useClickstream | Debounce + classify seeks |
| InterventionEngine | Thresholds, zones, FSM (no React) |
| useIntervention | Session-scoped UI mirror + lifecycle log hooks |
| EventService | Persist raw + meta |

---

## 2. Existing contracts

### Player events (`features/learn/types/video-player.ts`)

- `SEEK_FORWARD` / `SEEK_BACKWARD`: `{ from, to, delta }`
- Meta: `currentTime`, `playbackRate`, `timestamp` (wall clock on HTML5 path)

### Clickstream (`features/learn/clickstream/`)

- Config defaults: finalize 300ms, meaningful ≥ 5s, zone 10s, low attention 0.40, cooldown 15s, required revisits 2
- Neutral terms only (no single-signal “confusion”)

### Backend events

- Table `interaction_events` + JSONB `payload`
- Research fields stored in payload (`is_meaningful`, `seek_distance`, `target_zone_id`, …)
- Export maps payload keys → CSV/JSON columns

---

## 3. Player control methods (resume-relevant)

| Surface | Method | Notes |
|---------|--------|--------|
| **HTML5 `useVideoPlayer`** | `seek(time: number)` | Sets `video.currentTime`; **exists** |
| **HTML5 `useVideoPlayer`** | `seekForward` / `seekBackward` | Step seeks + emit events |
| **HTML5 `useVideoPlayer`** | `setPlaybackRate(rate)` | Emits SPEED_CHANGE |
| **HTML5 `VideoPlayer` props** | `startTime?` | Applied on `loadedmetadata` only |
| **HTML5 parent API** | — | Watch page does **not** hold `seek` ref/imperative handle |
| **YouTubePlayer** | `player.seekTo` (YT API internal) | **Not exposed** as prop/callback |
| **YouTubePlayer** | `externalPlaybackRate` | Adaptive rate only |
| **YouTubePlayer** | — | No `seekToTime` / `externalCurrentTime` prop |

**Resume gap (precise):**

1. `useIntervention` sets React state `resumeAt` from `engine.getContext().resumeTimestamp` (destination of meaningful seek, e.g. 120s).
2. Watch page renders `InterventionBanner` but **never reads `intervention.resumeAt`** to call a player seek.
3. On `completeRemedial` / `REMEDIAL_RESUMED`, no `video.currentTime = resumeAt` and no `YT.Player.seekTo(resumeAt)`.
4. Therefore resume is **data-complete, control-incomplete**.

**Sprint 20.2 should:** expose a minimal imperative/prop API on both players (reuse HTML5 `seek`, add YouTube `seekTo`) and call it once from watch page on remedial complete — without putting intervention logic inside the player.

---

## 4. Where `resumeAt` lives today

| Location | Field | Wired to player? |
|----------|-------|------------------|
| `InterventionEngine.ctx.resumeTimestamp` | set on notify-eligible seek | No |
| `useIntervention` state `resumeAt` | set when remedial opens | No |
| Watch page | receives hook return | **Unused** |
| Event meta | `resume_timestamp` on lifecycle CUSTOM logs | Analytics only |

---

## 5. Experiment condition

| Source | Behavior |
|--------|----------|
| URL query `?condition=CONTROL` | Watch page → `experimentCondition` |
| Default | `EXPERIMENTAL` |
| `useIntervention` / engine | `setExperimentCondition`; CONTROL blocks notify |
| `LearningSession` ORM | **No `experiment_condition` column** |
| Export | No session-level condition field (only event payload if logged) |

**Gap (precise):** condition is **ephemeral UI/query**, not durable on the session row. Refresh without query → EXPERIMENTAL. Research export cannot reliably filter CONTROL vs EXPERIMENTAL at session grain.

**Sprint 20.3 candidate:** optional `experiment_condition` on `learning_sessions` + set at session create; keep URL as override only if needed.

---

## 6. Test infrastructure

| Layer | What exists |
|-------|-------------|
| Frontend unit | `apps/web/features/learn/clickstream/__tests__/clickstream.test.ts` (manual `tsx` runner) |
| `apps/web/package.json` | `lint`, `typecheck`, `build` — **no** `test` script / Jest / Vitest / Playwright wired for clickstream |
| Backend | Prior sprint tests may exist under `apps/api`; not re-executed in this audit environment |
| E2E | Not present as a Sprint 20 matrix |

---

## 7. Acceptance matrix

| Requirement | Existing | Verified | Gap |
|-------------|----------|----------|-----|
| Seek debounce (~300ms) | Yes — `SeekFinalizer` | Unit test in clickstream.test | HTML5 continuous `seeking` event path may still be jump-only |
| ≥5s meaningful threshold | Yes — config + `classifySeek` | Unit (2.1 / 4.99 / 5 / 20s) | — |
| Direction FORWARD/BACKWARD | Yes | Unit | — |
| Zone counter (10s) | Yes — backward meaningful only | Unit | Forward not counted (by design) |
| Intervention FSM | Yes — engine + hook | Partial unit | Full path depends on attention + pressure |
| Remedial loop guard | Yes | Unit path when pressure triggers | — |
| Pre-notify 2s + banner | Yes — `InterventionBanner` | Code review | Manual UX not run here |
| Remedial content | Placeholder only | Code review | Real content out of scope |
| Raw vs derived meta | Yes — payload flags | Code review | — |
| Export JSON/CSV | Yes — analytics router | Code review | Runtime authz not exercised here |
| Resume at destination | **Partial** — `resumeAt` stored | Code review | **Not connected to player seek** |
| Experiment condition | **Partial** — URL + engine | Code review | **Not on session DB / export** |
| Manual vs adaptive speed | Yes — watch tags source | Code review | HTML5 `setPlaybackRate` still emits SPEED_CHANGE (player-level) |
| CONTROL disables intervention | Yes | Unit | Not persisted |
| E2E matrix | No | Not run | Missing |
| typecheck / lint baseline | Scripts exist | **Not executed in agent** | Local run required |

---

## 8. Recommended Sprint 20.2–20.10 order (no implementation here)

| Sprint | Focus |
|--------|--------|
| **20.2** | Wire `resumeAt` → HTML5 `seek` + YouTube `seekTo` on remedial complete/dismiss policy |
| **20.3** | Persist `experiment_condition` on session + export field |
| **20.4** | Expand automated tests (Vitest) for engine + finalizer |
| **20.5** | Optional: HTML5 `seeking`/`seeked` continuous drag path into finalizer |
| **20.6+** | E2E matrix, metrics, docs — still no DL/emotion |

---

## 9. Explicit non-goals (20.1)

- No Deep Learning / emotion
- No new remedial LLM content
- No new analytics dashboard
- No auth rewrite
- No duplicate clickstream/intervention systems
