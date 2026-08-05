# Database Documentation

| File | Description |
|------|-------------|
| [ERD.md](./ERD.md) | Entity-relationship diagram (Mermaid) + relationship table |
| [schema.sql](./schema.sql) | Full PostgreSQL DDL (tables, indexes, constraints, views, triggers) |
| [INDEXES_AND_CONSTRAINTS.md](./INDEXES_AND_CONSTRAINTS.md) | Index strategy, constraints, sample analytics SQL |

## Migrations

```
apps/api/alembic/versions/
  001_initial_schema.py   # users, videos, sessions, events
  002_analytics_schema.py # transcripts, AI predictions, analytics,
                          # difficulty timeline, summary cache + indexes
```

```bash
cd apps/api
alembic upgrade head
```

Or apply raw SQL:

```bash
psql $DATABASE_URL -f docs/database/schema.sql
```

## Entity List

1. **users** — accounts & preferences  
2. **videos** — learning content + base_difficulty  
3. **video_transcripts** — full text + segments + tsvector  
4. **learning_sessions** — watch sessions + attention aggregates  
5. **interaction_events** — high-volume event stream  
6. **ai_predictions** — model outputs (attention, gaze, difficulty, …)  
7. **learning_analytics** — daily/weekly/monthly rollups  
8. **difficulty_timeline** — adaptive ordered path  
9. **summary_cache** — TTL summaries by resource  
