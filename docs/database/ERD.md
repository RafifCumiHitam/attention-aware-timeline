# Database ERD — Attention-Aware Timeline

## Entity-Relationship Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ learning_sessions : "has"
    users ||--o{ interaction_events : "emits"
    users ||--o{ ai_predictions : "receives"
    users ||--o{ learning_analytics : "aggregates"
    users ||--o{ difficulty_timeline : "follows"
    users ||--o{ videos : "creates"

    videos ||--o| video_transcripts : "has"
    videos ||--o{ learning_sessions : "watched_in"
    videos ||--o{ interaction_events : "context"
    videos ||--o{ ai_predictions : "context"
    videos ||--o{ difficulty_timeline : "step"
    videos ||--o{ summary_cache : "cached_as"

    learning_sessions ||--o{ interaction_events : "contains"
    learning_sessions ||--o{ ai_predictions : "generates"
    learning_sessions ||--o{ difficulty_timeline : "influences"
    learning_sessions ||--o{ summary_cache : "cached_as"

    users {
        uuid id PK
        varchar email UK
        varchar hashed_password
        varchar full_name
        boolean is_active
        boolean is_superuser
        boolean attention_tracking_enabled
        timestamptz created_at
    }

    videos {
        uuid id PK
        varchar title
        text description
        varchar video_url
        int duration_seconds
        varchar module
        int order_index
        boolean is_published
        float base_difficulty
        uuid created_by_id FK
    }

    video_transcripts {
        uuid id PK
        uuid video_id FK_UK
        varchar language
        text full_text
        jsonb segments
        tsvector search_vector
        int word_count
    }

    learning_sessions {
        uuid id PK
        uuid user_id FK
        uuid video_id FK
        enum status
        float progress_percent
        float avg_attention_score
        timestamptz started_at
        timestamptz ended_at
    }

    interaction_events {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        uuid video_id FK
        enum event_type
        float attention_score
        float gaze_x
        float gaze_y
        jsonb payload
        timestamptz created_at
    }

    ai_predictions {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        uuid video_id FK
        varchar model_name
        varchar prediction_type
        jsonb output
        float confidence
        int latency_ms
        timestamptz created_at
    }

    learning_analytics {
        uuid id PK
        uuid user_id FK
        date period_date
        varchar period_type
        int total_watch_seconds
        float avg_attention_score
        jsonb metrics
    }

    difficulty_timeline {
        uuid id PK
        uuid user_id FK
        uuid video_id FK
        uuid session_id FK
        int sequence_index
        float difficulty_level
        varchar outcome
        timestamptz recommended_at
    }

    summary_cache {
        uuid id PK
        varchar cache_key UK
        varchar resource_type
        uuid resource_id
        text summary_text
        jsonb summary_json
        timestamptz expires_at
    }
```

## Relationship Summary

| Parent | Child | Cardinality | On Delete |
|--------|-------|-------------|-----------|
| users | learning_sessions | 1:N | CASCADE |
| users | interaction_events | 1:N | CASCADE |
| users | ai_predictions | 1:N | CASCADE |
| users | learning_analytics | 1:N | CASCADE |
| users | difficulty_timeline | 1:N | CASCADE |
| users | videos (created_by) | 1:N | SET NULL |
| videos | video_transcripts | 1:0..1 | CASCADE |
| videos | learning_sessions | 1:N | CASCADE |
| videos | interaction_events | 1:N | SET NULL |
| videos | ai_predictions | 1:N | SET NULL |
| videos | difficulty_timeline | 1:N | CASCADE |
| learning_sessions | interaction_events | 1:N | CASCADE |
| learning_sessions | ai_predictions | 1:N | SET NULL |
| learning_sessions | difficulty_timeline | 1:N | SET NULL |

## Analytics Query Paths (optimized)

```
learning_analytics  ←── daily rollups (UNIQUE user_id + period_date + period_type)
        ↑
interaction_events  ←── BRIN(created_at) + (user_id, created_at) composite
        ↑
learning_sessions   ←── (user_id, started_at), (user_id, status)
        ↑
ai_predictions      ←── (user_id, prediction_type, created_at)
difficulty_timeline ←── (user_id, sequence_index)
```
