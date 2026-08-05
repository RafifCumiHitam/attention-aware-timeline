# Indexes, Constraints & Analytics Optimization

## Constraints

### Primary Keys
All tables use `UUID` primary keys (`gen_random_uuid()`).

### Unique Constraints

| Table | Constraint | Columns |
|-------|------------|---------|
| users | `uq_users_email` | email |
| video_transcripts | `uq_video_transcripts_video_lang` | video_id, language |
| learning_analytics | `uq_learning_analytics_user_period` | user_id, period_date, period_type |
| difficulty_timeline | `uq_difficulty_timeline_user_seq` | user_id, sequence_index |
| summary_cache | `uq_summary_cache_key` | cache_key |

### Check Constraints (selected)

| Table | Rule |
|-------|------|
| videos | `duration_seconds >= 0`, `base_difficulty ∈ [0,1]` |
| learning_sessions | `progress_percent ∈ [0,100]`, `ended_at >= started_at` |
| interaction_events | `attention_score ∈ [0,100]` when present |
| ai_predictions | `confidence ∈ [0,1]`, `latency_ms >= 0` |
| difficulty_timeline | `difficulty_level ∈ [0,1]`, `sequence_index >= 0` |

### Foreign Keys & ON DELETE

| From → To | ON DELETE |
|-----------|-----------|
| sessions.user_id → users | CASCADE |
| sessions.video_id → videos | CASCADE |
| events.user_id → users | CASCADE |
| events.session_id → sessions | CASCADE |
| events.video_id → videos | SET NULL |
| transcripts.video_id → videos | CASCADE |
| ai_predictions.user_id → users | CASCADE |
| ai_predictions.session_id → sessions | SET NULL |
| analytics.user_id → users | CASCADE |
| difficulty_timeline.user_id → users | CASCADE |
| difficulty_timeline.video_id → videos | CASCADE |

---

## Index Strategy (Analytics-Oriented)

### High-volume: `interaction_events`

| Index | Type | Purpose |
|-------|------|---------|
| `(user_id, created_at DESC)` | B-tree | User timeline / range scans |
| `(user_id, event_type, created_at DESC)` | B-tree | Filtered event history |
| `(session_id, created_at ASC)` | B-tree | Replay session events |
| `BRIN (created_at)` | BRIN | Cheap chronological scans at scale |
| Partial: `event_type = attention_sample` | B-tree | Attention trend queries |
| `GIN (payload jsonb_path_ops)` | GIN | JSON path filters |

### Rollups: `learning_analytics`

| Index | Purpose |
|-------|---------|
| `(user_id, period_date DESC)` | Dashboard “last N days” |
| `(user_id, period_type, period_date DESC)` | Day vs week vs month |
| `GIN (metrics)` | Extensible metric filters |

### Adaptive path: `difficulty_timeline`

| Index | Purpose |
|-------|---------|
| `(user_id, sequence_index)` | Ordered path |
| Partial: `outcome = pending` | Next recommendation queue |

### Search: `videos` / `video_transcripts`

| Index | Purpose |
|-------|---------|
| `GIN (title gin_trgm_ops)` | Fuzzy title search |
| `GIN (search_vector)` | Full-text transcript search |
| `GIN (tags)` | Tag containment |

---

## Example Analytics Queries

### 1. User overview (prefer rollup table)

```sql
SELECT *
FROM learning_analytics
WHERE user_id = $1
  AND period_type = 'day'
  AND period_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY period_date;
```

### 2. Attention trend from raw events (if rollup missing)

```sql
SELECT date_trunc('hour', created_at) AS hour,
       AVG(attention_score) AS avg_attention
FROM interaction_events
WHERE user_id = $1
  AND event_type = 'attention_sample'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;
```

### 3. Session efficiency

```sql
SELECT s.id, s.progress_percent, s.avg_attention_score, s.total_watch_seconds,
       v.title, v.base_difficulty
FROM learning_sessions s
JOIN videos v ON v.id = s.video_id
WHERE s.user_id = $1
ORDER BY s.started_at DESC
LIMIT 20;
```

### 4. Next difficulty step

```sql
SELECT *
FROM difficulty_timeline
WHERE user_id = $1 AND outcome = 'pending'
ORDER BY sequence_index
LIMIT 1;
```

### 5. Transcript search

```sql
SELECT v.id, v.title, ts_rank(t.search_vector, q) AS rank
FROM video_transcripts t
JOIN videos v ON v.id = t.video_id
CROSS JOIN plainto_tsquery('english', $1) q
WHERE t.search_vector @@ q AND v.is_published
ORDER BY rank DESC
LIMIT 20;
```

---

## Scaling Notes

1. **Partition** `interaction_events` by month (`PARTITION BY RANGE (created_at)`) when > ~50M rows.
2. **Roll up** events → `learning_analytics` via scheduled job (or trigger) so dashboards never scan raw events.
3. **TTL job** on `summary_cache` (`DELETE WHERE expires_at < NOW()`).
4. Prefer **BRIN** for append-only time series; **B-tree composites** for point lookups by user.
