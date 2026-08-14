"""YouTube Data API client — server-side only (YOUTUBE_API_KEY never leaves the API)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from app.core.config import get_settings
from app.domain.exceptions import AppException, NotFoundError, ValidationError

ISO8601_DURATION = re.compile(
    r"PT(?:(?P<h>\d+)H)?(?:(?P<m>\d+)M)?(?:(?P<s>\d+)S)?"
)


def parse_iso8601_duration(value: str | None) -> int:
    if not value:
        return 0
    m = ISO8601_DURATION.fullmatch(value)
    if not m:
        return 0
    hours = int(m.group("h") or 0)
    minutes = int(m.group("m") or 0)
    seconds = int(m.group("s") or 0)
    return hours * 3600 + minutes * 60 + seconds


@dataclass(frozen=True)
class YouTubeVideoDTO:
    youtube_video_id: str
    title: str
    description: str
    thumbnail_url: str | None
    duration_seconds: int
    channel_title: str | None
    published_at: datetime | None


class YouTubeAPIError(AppException):
    def __init__(self, message: str, code: str = "youtube_api_error", status_code: int = 502):
        super().__init__(message=message, code=code, status_code=status_code)


class YouTubeQuotaExceededError(YouTubeAPIError):
    def __init__(self, message: str = "YouTube API quota exceeded"):
        super().__init__(message=message, code="youtube_quota_exceeded", status_code=429)


class YouTubeService:
    """Thin wrapper around YouTube Data API v3."""

    def __init__(self, api_key: str | None = None, timeout: float | None = None):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.youtube_api_key
        self.base = settings.youtube_api_base.rstrip("/")
        self.timeout = timeout if timeout is not None else settings.youtube_http_timeout

    def _require_key(self) -> None:
        if not self.api_key:
            raise YouTubeAPIError(
                "YOUTUBE_API_KEY is not configured on the server",
                code="youtube_not_configured",
                status_code=503,
            )

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        self._require_key()
        query = {**params, "key": self.api_key}
        url = f"{self.base}/{path.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=query)
        except httpx.TimeoutException as e:
            raise YouTubeAPIError("YouTube API request timed out", code="youtube_timeout") from e
        except httpx.HTTPError as e:
            raise YouTubeAPIError("YouTube API network error", code="youtube_network") from e

        if resp.status_code == 403:
            body = resp.text.lower()
            if "quota" in body:
                raise YouTubeQuotaExceededError()
            raise YouTubeAPIError("YouTube API forbidden", code="youtube_forbidden", status_code=403)
        if resp.status_code >= 400:
            raise YouTubeAPIError(
                f"YouTube API error ({resp.status_code})",
                code="youtube_http_error",
                status_code=502,
            )

        data = resp.json()
        # Never log or return the API key
        return data

    @staticmethod
    def map_search_item(item: dict[str, Any]) -> dict[str, Any]:
        snippet = item.get("snippet") or {}
        thumbs = snippet.get("thumbnails") or {}
        thumb = (
            (thumbs.get("high") or {}).get("url")
            or (thumbs.get("medium") or {}).get("url")
            or (thumbs.get("default") or {}).get("url")
        )
        vid = (item.get("id") or {}).get("videoId") or item.get("id")
        return {
            "youtube_video_id": vid,
            "title": snippet.get("title") or "",
            "description": snippet.get("description") or "",
            "thumbnail_url": thumb,
            "channel_title": snippet.get("channelTitle"),
        }

    @staticmethod
    def map_video_item(item: dict[str, Any]) -> YouTubeVideoDTO:
        snippet = item.get("snippet") or {}
        content = item.get("contentDetails") or {}
        status = item.get("status") or {}
        privacy = status.get("privacyStatus")
        if privacy and privacy != "public":
            # unlisted may still be playable; private/deleted handled by empty results
            if privacy == "private":
                raise ValidationError("Video is private and cannot be imported")

        thumbs = snippet.get("thumbnails") or {}
        thumb = (
            (thumbs.get("high") or {}).get("url")
            or (thumbs.get("medium") or {}).get("url")
            or (thumbs.get("default") or {}).get("url")
        )
        published_raw = snippet.get("publishedAt")
        published_at = None
        if published_raw:
            try:
                published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
            except ValueError:
                published_at = None

        return YouTubeVideoDTO(
            youtube_video_id=item.get("id") or "",
            title=snippet.get("title") or "Untitled",
            description=snippet.get("description") or "",
            thumbnail_url=thumb,
            duration_seconds=parse_iso8601_duration(content.get("duration")),
            channel_title=snippet.get("channelTitle"),
            published_at=published_at,
        )

    async def search_videos(
        self, q: str, *, max_results: int = 10, page_token: str | None = None
    ) -> dict[str, Any]:
        q = (q or "").strip()
        if len(q) < 2:
            raise ValidationError("Search query must be at least 2 characters")
        if len(q) > 100:
            raise ValidationError("Search query too long")
        max_results = max(1, min(int(max_results), 25))

        params: dict[str, Any] = {
            "part": "snippet",
            "type": "video",
            "q": q,
            "maxResults": max_results,
            "safeSearch": "moderate",
        }
        if page_token:
            params["pageToken"] = page_token

        data = await self._get("search", params)
        items = [self.map_search_item(i) for i in data.get("items") or [] if i]
        items = [i for i in items if i.get("youtube_video_id")]
        return {
            "items": items,
            "next_page_token": data.get("nextPageToken"),
            "total_results": (data.get("pageInfo") or {}).get("totalResults"),
        }

    async def get_video(self, youtube_video_id: str) -> YouTubeVideoDTO:
        youtube_video_id = (youtube_video_id or "").strip()
        if not youtube_video_id or len(youtube_video_id) > 32:
            raise ValidationError("Invalid youtube_video_id")

        data = await self._get(
            "videos",
            {
                "part": "snippet,contentDetails,status",
                "id": youtube_video_id,
            },
        )
        items = data.get("items") or []
        if not items:
            raise NotFoundError("YouTube video", youtube_video_id)
        return self.map_video_item(items[0])

    async def get_videos(self, youtube_video_ids: list[str]) -> list[YouTubeVideoDTO]:
        ids = [i.strip() for i in youtube_video_ids if i and i.strip()]
        if not ids:
            return []
        data = await self._get(
            "videos",
            {
                "part": "snippet,contentDetails,status",
                "id": ",".join(ids[:50]),
            },
        )
        return [self.map_video_item(i) for i in data.get("items") or []]

    async def get_video_duration(self, youtube_video_id: str) -> int:
        dto = await self.get_video(youtube_video_id)
        return dto.duration_seconds
