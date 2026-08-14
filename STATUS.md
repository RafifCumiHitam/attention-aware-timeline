# Project Status — Attention-Aware Timeline

**Last updated:** 2026-08-15  
**Stage:** Advanced prototype / thesis MVP

## YouTube Module System (this sprint)

| Area | Status |
|------|--------|
| Module ORM + API | Done |
| Video.youtube_video_id vs internal video.id | Done |
| YouTube Data API (server-side key) | Done |
| Import video into module | Done |
| Session.module_id | Done |
| YouTube IFrame player adapter | Done |
| Module UI + Start Learning → session | Done |
| Attention pipeline source-agnostic | Done |

### Identity rules

- `video_id` = internal PostgreSQL UUID
- `youtube_video_id` = YouTube string (player only)
- `session_id` = learning session UUID from `POST /sessions`

### Env

```
YOUTUBE_API_KEY=your_key_here   # API only — never NEXT_PUBLIC_
```

### Migration

```bash
cd apps/api && alembic upgrade head   # includes 20260815_0003_modules_youtube
```

### Key endpoints

- `GET/POST /api/v1/modules`
- `GET /api/v1/modules/{id}/videos`
- `POST /api/v1/modules/{id}/videos` `{ "youtube_video_id": "..." }`
- `GET /api/v1/youtube/search?q=`
- `POST /api/v1/sessions` `{ "video_id", "module_id?" }`

### Frontend routes

- `/learn/modules` — list / create
- `/learn/modules/[moduleId]` — videos + YouTube import
- `/learn/watch?videoId=&sessionId=` — player + attention pipeline

### Regression

HTML5 MP4 Learn page still works. YouTube uses same `useAttentionPipeline` + event logger + WebSocket adaptive path.
