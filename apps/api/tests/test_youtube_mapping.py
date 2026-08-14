"""YouTube DTO mapping + duration parse unit tests."""

from app.infrastructure.external.youtube_service import (
    YouTubeService,
    parse_iso8601_duration,
)


def test_parse_iso8601_duration():
    assert parse_iso8601_duration("PT1H2M3S") == 3723
    assert parse_iso8601_duration("PT15M42S") == 942
    assert parse_iso8601_duration("PT45S") == 45
    assert parse_iso8601_duration(None) == 0
    assert parse_iso8601_duration("") == 0


def test_map_search_item():
    item = {
        "id": {"videoId": "dQw4w9WgXcQ"},
        "snippet": {
            "title": "Sample",
            "description": "Desc",
            "channelTitle": "Channel",
            "thumbnails": {"medium": {"url": "https://i.ytimg.com/vi/x/mq.jpg"}},
        },
    }
    mapped = YouTubeService.map_search_item(item)
    assert mapped["youtube_video_id"] == "dQw4w9WgXcQ"
    assert mapped["title"] == "Sample"
    assert mapped["channel_title"] == "Channel"
    assert "ytimg" in (mapped["thumbnail_url"] or "")


def test_map_video_item():
    item = {
        "id": "abcXYZ12345",
        "snippet": {
            "title": "Neural Nets",
            "description": "Intro",
            "channelTitle": "ML Channel",
            "publishedAt": "2020-01-15T12:00:00Z",
            "thumbnails": {"high": {"url": "https://i.ytimg.com/vi/x/hq.jpg"}},
        },
        "contentDetails": {"duration": "PT13M32S"},
        "status": {"privacyStatus": "public"},
    }
    dto = YouTubeService.map_video_item(item)
    assert dto.youtube_video_id == "abcXYZ12345"
    assert dto.duration_seconds == 812
    assert dto.channel_title == "ML Channel"
