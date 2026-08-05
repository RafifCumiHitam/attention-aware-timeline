-- =============================================================================
-- Attention-Aware Timeline — PostgreSQL Schema (Analytics-Optimized)
-- PostgreSQL 16+
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- fuzzy / ILIKE search
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- composite GIN helpers

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM (
        'in_progress', 'completed', 'abandoned', 'paused'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
        'play', 'pause', 'seek', 'complete',
        'attention_sample', 'gaze_sample',
        'focus_lost', 'focus_regained',
        'quiz_answer', 'note', 'rate', 'custom'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE prediction_type AS ENUM (
        'attention', 'gaze', 'emotion', 'engagement',
        'difficulty', 'focus_state', 'comprehension', 'custom'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE period_type AS ENUM ('day', 'week', 'month');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM (
        'video', 'session', 'user', 'module', 'transcript'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE timeline_outcome AS ENUM (
        'pending', 'completed', 'skipped', 'failed', 'in_progress'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 1. USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                           VARCHAR(255) NOT NULL,
    hashed_password                 VARCHAR(255) NOT NULL,
    full_name                       VARCHAR(255) NOT NULL,
    is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
    is_superuser                    BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url                      VARCHAR(512),
    bio                             TEXT,
    attention_tracking_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    gaze_estimation_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_difficulty            REAL CHECK (preferred_difficulty IS NULL OR (preferred_difficulty >= 0 AND preferred_difficulty <= 1)),
    timezone                        VARCHAR(64) DEFAULT 'UTC',
    last_login_at                   TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS ix_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS ix_users_is_active ON users (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS ix_users_created_at ON users (created_at DESC);

-- =============================================================================
-- 2. VIDEOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS videos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    video_url           VARCHAR(1024) NOT NULL,
    thumbnail_url       VARCHAR(1024),
    duration_seconds    INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    module              VARCHAR(128),
    order_index         INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    tags                TEXT[],
    is_published        BOOLEAN NOT NULL DEFAULT FALSE,
    -- Adaptive learning: base difficulty 0 (easy) .. 1 (hard)
    base_difficulty     REAL NOT NULL DEFAULT 0.5
                            CHECK (base_difficulty >= 0 AND base_difficulty <= 1),
    created_by_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_videos_title ON videos (title);
CREATE INDEX IF NOT EXISTS ix_videos_title_trgm ON videos USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_videos_module ON videos (module) WHERE module IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_videos_published ON videos (is_published, order_index)
    WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS ix_videos_difficulty ON videos (base_difficulty);
CREATE INDEX IF NOT EXISTS ix_videos_tags ON videos USING GIN (tags);
CREATE INDEX IF NOT EXISTS ix_videos_created_by ON videos (created_by_id)
    WHERE created_by_id IS NOT NULL;

-- =============================================================================
-- 3. VIDEO TRANSCRIPTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS video_transcripts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    language            VARCHAR(16) NOT NULL DEFAULT 'en',
    full_text           TEXT NOT NULL,
    -- segments: [{start, end, text, speaker?}, ...]
    segments            JSONB NOT NULL DEFAULT '[]'::jsonb,
    word_count          INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
    duration_seconds    INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    source              VARCHAR(64) DEFAULT 'manual',  -- manual | whisper | auto
    search_vector       TSVECTOR,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_video_transcripts_video_lang UNIQUE (video_id, language)
);

CREATE INDEX IF NOT EXISTS ix_video_transcripts_video_id ON video_transcripts (video_id);
CREATE INDEX IF NOT EXISTS ix_video_transcripts_search ON video_transcripts USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS ix_video_transcripts_segments ON video_transcripts USING GIN (segments);

-- Auto-maintain search_vector
CREATE OR REPLACE FUNCTION video_transcripts_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.full_text, '')), 'A');
    NEW.word_count := array_length(regexp_split_to_array(trim(NEW.full_text), '\s+'), 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_transcripts_search ON video_transcripts;
CREATE TRIGGER trg_video_transcripts_search
    BEFORE INSERT OR UPDATE OF full_text ON video_transcripts
    FOR EACH ROW EXECUTE FUNCTION video_transcripts_search_trigger();

-- =============================================================================
-- 4. LEARNING SESSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS learning_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id                UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    status                  session_status NOT NULL DEFAULT 'in_progress',
    progress_seconds        INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
    progress_percent        REAL NOT NULL DEFAULT 0
                                CHECK (progress_percent >= 0 AND progress_percent <= 100),
    avg_attention_score     REAL CHECK (avg_attention_score IS NULL OR (avg_attention_score >= 0 AND avg_attention_score <= 100)),
    max_attention_score     REAL CHECK (max_attention_score IS NULL OR (max_attention_score >= 0 AND max_attention_score <= 100)),
    min_attention_score     REAL CHECK (min_attention_score IS NULL OR (min_attention_score >= 0 AND min_attention_score <= 100)),
    attention_samples       INTEGER NOT NULL DEFAULT 0 CHECK (attention_samples >= 0),
    started_at              TIMESTAMPTZ NOT NULL,
    ended_at                TIMESTAMPTZ,
    total_watch_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (total_watch_seconds >= 0),
    -- Effective difficulty experienced in this session
    applied_difficulty      REAL CHECK (applied_difficulty IS NULL OR (applied_difficulty >= 0 AND applied_difficulty <= 1)),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_session_ended_after_start
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Hot paths for "my sessions" and analytics
CREATE INDEX IF NOT EXISTS ix_sessions_user_started
    ON learning_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_sessions_user_status
    ON learning_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS ix_sessions_video_id
    ON learning_sessions (video_id);
CREATE INDEX IF NOT EXISTS ix_sessions_status_active
    ON learning_sessions (user_id, video_id)
    WHERE status IN ('in_progress', 'paused');
CREATE INDEX IF NOT EXISTS ix_sessions_started_brin
    ON learning_sessions USING BRIN (started_at);

-- =============================================================================
-- 5. INTERACTION EVENTS  (high-volume, analytics-critical)
-- =============================================================================

CREATE TABLE IF NOT EXISTS interaction_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES learning_sessions(id) ON DELETE CASCADE,
    video_id            UUID REFERENCES videos(id) ON DELETE SET NULL,
    event_type          event_type NOT NULL,
    video_timestamp     REAL CHECK (video_timestamp IS NULL OR video_timestamp >= 0),
    attention_score     REAL CHECK (attention_score IS NULL OR (attention_score >= 0 AND attention_score <= 100)),
    gaze_x              REAL,
    gaze_y              REAL,
    payload             JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-series + user analytics (most important indexes)
CREATE INDEX IF NOT EXISTS ix_events_user_created
    ON interaction_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_events_session_created
    ON interaction_events (session_id, created_at ASC)
    WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_events_type_created
    ON interaction_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_events_user_type_created
    ON interaction_events (user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_events_video_id
    ON interaction_events (video_id)
    WHERE video_id IS NOT NULL;
-- BRIN for large chronological scans / partitioning-friendly
CREATE INDEX IF NOT EXISTS ix_events_created_brin
    ON interaction_events USING BRIN (created_at) WITH (pages_per_range = 32);
-- Attention samples partial index (frequent analytics filter)
CREATE INDEX IF NOT EXISTS ix_events_attention_samples
    ON interaction_events (user_id, created_at DESC, attention_score)
    WHERE event_type = 'attention_sample' AND attention_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_events_payload_gin
    ON interaction_events USING GIN (payload jsonb_path_ops)
    WHERE payload IS NOT NULL;

-- =============================================================================
-- 6. AI PREDICTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_predictions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
    video_id            UUID REFERENCES videos(id) ON DELETE SET NULL,
    model_name          VARCHAR(128) NOT NULL,
    model_version       VARCHAR(64),
    prediction_type     prediction_type NOT NULL,
    -- Optional reference to source event or frame
    source_event_id     UUID REFERENCES interaction_events(id) ON DELETE SET NULL,
    input_metadata      JSONB,
    output              JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence          REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    latency_ms          INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ai_pred_user_created
    ON ai_predictions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_ai_pred_user_type_created
    ON ai_predictions (user_id, prediction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_ai_pred_session
    ON ai_predictions (session_id, created_at ASC)
    WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_ai_pred_type_created
    ON ai_predictions (prediction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_ai_pred_model
    ON ai_predictions (model_name, model_version);
CREATE INDEX IF NOT EXISTS ix_ai_pred_output_gin
    ON ai_predictions USING GIN (output jsonb_path_ops);
CREATE INDEX IF NOT EXISTS ix_ai_pred_created_brin
    ON ai_predictions USING BRIN (created_at);

-- =============================================================================
-- 7. LEARNING ANALYTICS  (pre-aggregated for dashboards)
-- =============================================================================

CREATE TABLE IF NOT EXISTS learning_analytics (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_date             DATE NOT NULL,
    period_type             period_type NOT NULL DEFAULT 'day',
    total_watch_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (total_watch_seconds >= 0),
    session_count           INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
    completed_sessions      INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
    videos_touched          INTEGER NOT NULL DEFAULT 0 CHECK (videos_touched >= 0),
    avg_attention_score     REAL CHECK (avg_attention_score IS NULL OR (avg_attention_score >= 0 AND avg_attention_score <= 100)),
    max_attention_score     REAL CHECK (max_attention_score IS NULL OR (max_attention_score >= 0 AND max_attention_score <= 100)),
    min_attention_score     REAL CHECK (min_attention_score IS NULL OR (min_attention_score >= 0 AND min_attention_score <= 100)),
    attention_sample_count  INTEGER NOT NULL DEFAULT 0 CHECK (attention_sample_count >= 0),
    focus_lost_count        INTEGER NOT NULL DEFAULT 0 CHECK (focus_lost_count >= 0),
    engagement_score        REAL CHECK (engagement_score IS NULL OR (engagement_score >= 0 AND engagement_score <= 100)),
    avg_difficulty          REAL CHECK (avg_difficulty IS NULL OR (avg_difficulty >= 0 AND avg_difficulty <= 1)),
    -- Extensible metrics bag
    metrics                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_learning_analytics_user_period
        UNIQUE (user_id, period_date, period_type)
);

CREATE INDEX IF NOT EXISTS ix_analytics_user_date
    ON learning_analytics (user_id, period_date DESC);
CREATE INDEX IF NOT EXISTS ix_analytics_period_type_date
    ON learning_analytics (period_type, period_date DESC);
CREATE INDEX IF NOT EXISTS ix_analytics_user_type_date
    ON learning_analytics (user_id, period_type, period_date DESC);
CREATE INDEX IF NOT EXISTS ix_analytics_metrics_gin
    ON learning_analytics USING GIN (metrics jsonb_path_ops);

-- =============================================================================
-- 8. DIFFICULTY TIMELINE  (adaptive path per learner)
-- =============================================================================

CREATE TABLE IF NOT EXISTS difficulty_timeline (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id                UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    session_id              UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
    sequence_index          INTEGER NOT NULL CHECK (sequence_index >= 0),
    difficulty_level        REAL NOT NULL
                                CHECK (difficulty_level >= 0 AND difficulty_level <= 1),
    -- Why this difficulty was chosen
    reason                  VARCHAR(512),
    attention_at_decision   REAL CHECK (attention_at_decision IS NULL OR (attention_at_decision >= 0 AND attention_at_decision <= 100)),
    prediction_id           UUID REFERENCES ai_predictions(id) ON DELETE SET NULL,
    outcome                 timeline_outcome NOT NULL DEFAULT 'pending',
    outcome_at              TIMESTAMPTZ,
    recommended_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_difficulty_timeline_user_seq
        UNIQUE (user_id, sequence_index)
);

CREATE INDEX IF NOT EXISTS ix_diff_timeline_user_seq
    ON difficulty_timeline (user_id, sequence_index ASC);
CREATE INDEX IF NOT EXISTS ix_diff_timeline_user_recommended
    ON difficulty_timeline (user_id, recommended_at DESC);
CREATE INDEX IF NOT EXISTS ix_diff_timeline_video
    ON difficulty_timeline (video_id);
CREATE INDEX IF NOT EXISTS ix_diff_timeline_outcome
    ON difficulty_timeline (user_id, outcome)
    WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS ix_diff_timeline_session
    ON difficulty_timeline (session_id)
    WHERE session_id IS NOT NULL;

-- =============================================================================
-- 9. SUMMARY CACHE
-- =============================================================================

CREATE TABLE IF NOT EXISTS summary_cache (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key           VARCHAR(512) NOT NULL,
    resource_type       resource_type NOT NULL,
    resource_id         UUID NOT NULL,
    summary_text        TEXT,
    summary_json        JSONB,
    model_used          VARCHAR(128),
    locale              VARCHAR(16) DEFAULT 'en',
    hit_count           INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_summary_cache_key UNIQUE (cache_key)
);

CREATE INDEX IF NOT EXISTS ix_summary_resource
    ON summary_cache (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_summary_expires
    ON summary_cache (expires_at)
    WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_summary_json_gin
    ON summary_cache USING GIN (summary_json jsonb_path_ops)
    WHERE summary_json IS NOT NULL;

-- =============================================================================
-- HELPER: updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users', 'videos', 'video_transcripts', 'learning_sessions', 'learning_analytics', 'summary_cache']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t
        );
    END LOOP;
END $$;

-- =============================================================================
-- ANALYTICS VIEWS (optional convenience)
-- =============================================================================

CREATE OR REPLACE VIEW v_user_session_stats AS
SELECT
    s.user_id,
    COUNT(*) AS total_sessions,
    COUNT(*) FILTER (WHERE s.status = 'completed') AS completed_sessions,
    COALESCE(SUM(s.total_watch_seconds), 0) AS total_watch_seconds,
    AVG(s.avg_attention_score) AS avg_attention_score,
    COUNT(DISTINCT s.video_id) AS distinct_videos
FROM learning_sessions s
GROUP BY s.user_id;

CREATE OR REPLACE VIEW v_daily_attention AS
SELECT
    user_id,
    (started_at AT TIME ZONE 'UTC')::date AS day,
    AVG(avg_attention_score) AS avg_attention,
    COUNT(*) AS session_count,
    COALESCE(SUM(total_watch_seconds), 0) AS watch_seconds
FROM learning_sessions
WHERE avg_attention_score IS NOT NULL
GROUP BY user_id, (started_at AT TIME ZONE 'UTC')::date;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE interaction_events IS 'High-volume event stream; prefer BRIN + composite indexes; consider monthly partitioning at scale';
COMMENT ON TABLE learning_analytics IS 'Pre-aggregated rollups for dashboard queries — avoid scanning raw events for overview';
COMMENT ON TABLE difficulty_timeline IS 'Ordered adaptive path of recommended content difficulty per user';
COMMENT ON TABLE ai_predictions IS 'Model inference outputs linked to sessions/events for audit and analytics';
COMMENT ON TABLE summary_cache IS 'TTL cache for LLM/video summaries keyed by resource';
COMMENT ON TABLE video_transcripts IS 'One transcript per video+language; full-text via tsvector';
