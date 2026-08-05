"""Image helpers — placeholders for future OpenCV / base64 decode."""

import base64
from typing import Any


def decode_base64_image(data: str) -> bytes:
    """Decode a data-URL or raw base64 string to bytes."""
    if "," in data and data.strip().startswith("data:"):
        data = data.split(",", 1)[1]
    return base64.b64decode(data)


def encode_base64_image(raw: bytes, mime: str = "image/jpeg") -> str:
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


def validate_frame_payload(image_base64: str | None) -> dict[str, Any]:
    """Light validation used by routers before calling services."""
    if not image_base64:
        return {"present": False, "size_bytes": 0}
    try:
        raw = decode_base64_image(image_base64)
        return {"present": True, "size_bytes": len(raw)}
    except Exception:
        return {"present": True, "size_bytes": -1, "error": "invalid_base64"}
