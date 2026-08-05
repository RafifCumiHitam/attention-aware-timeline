#!/usr/bin/env python3
"""Download the MediaPipe Face Landmarker model bundle.

Usage
-----
    python scripts/download_models.py
    python scripts/download_models.py --output-dir /custom/path

The script places ``face_landmarker.task`` in ``apps/ai/models/`` (or the
directory specified via ``--output-dir``).  This path matches the default
``MODEL_PATH`` env variable expected by the AI service.

Model
-----
MediaPipe Face Landmarker (float16, ~5 MB)
Source: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
License: Apache 2.0
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

MODELS = {
    "face_landmarker": {
        "url": (
            "https://storage.googleapis.com/mediapipe-models/"
            "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
        ),
        "filename": "face_landmarker.task",
        # SHA-256 intentionally omitted — Google rotates the "latest" pointer;
        # verify manually if pinning a specific version.
        "sha256": None,
    },
}

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "models"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url: str, dest: Path) -> None:
    print(f"  Downloading {url}")
    print(f"  → {dest}")

    def _reporthook(count: int, block_size: int, total_size: int) -> None:
        if total_size <= 0:
            return
        pct = count * block_size * 100 // total_size
        bar = "#" * (pct // 5)
        print(f"\r  [{bar:<20}] {pct:3d}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=_reporthook)  # noqa: S310
    print()  # newline after progress bar


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Download MediaPipe model bundles.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to save models (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--model",
        choices=list(MODELS),
        default=None,
        help="Download a specific model only (default: all).",
    )
    args = parser.parse_args()

    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    to_download = {args.model: MODELS[args.model]} if args.model else MODELS

    errors: list[str] = []
    for key, spec in to_download.items():
        dest = output_dir / spec["filename"]

        if dest.exists():
            print(f"[skip] {spec['filename']} already exists at {dest}")
            if spec["sha256"]:
                actual = _sha256(dest)
                if actual != spec["sha256"]:
                    print(f"  ⚠  SHA-256 mismatch! Expected {spec['sha256']}, got {actual}")
            continue

        print(f"\n[download] {key}")
        try:
            _download(spec["url"], dest)
        except Exception as exc:  # noqa: BLE001
            msg = f"  ✗ Failed to download {key}: {exc}"
            print(msg)
            errors.append(msg)
            continue

        if spec["sha256"]:
            actual = _sha256(dest)
            if actual == spec["sha256"]:
                print(f"  ✓ SHA-256 verified")
            else:
                print(f"  ⚠  SHA-256 mismatch! Got {actual}")

        print(f"  ✓ Saved → {dest} ({dest.stat().st_size / 1024:.0f} KB)")

    print("\n--- Summary ---")
    if errors:
        for e in errors:
            print(e)
        sys.exit(1)
    else:
        print(f"All models ready in {output_dir}")


if __name__ == "__main__":
    main()
