# =============================================================================
# media.py
#
# Shared plumbing for the photos and videos a traveller uploads for a place.
#
# The files themselves live in data/uploads/ (see storage.uploads_dir());
# a place's JSON record only stores their "/media/<name>" URLs, and main.py
# serves them back at GET /media/{filename}.
# =============================================================================

from pathlib import Path
from typing import Iterable, Literal

from fastapi import HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app import storage
from app.storage import new_id

# Cap on a single uploaded file. Big enough for a short phone clip, small
# enough that data/ doesn't fill up during a demo.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
# How many photos/videos one place may carry (any mix).
MAX_MEDIA_ITEMS = 6

_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_VIDEO_EXTS = {".mp4", ".mov", ".webm", ".ogg", ".m4v"}


class MediaItem(BaseModel):
    url: str = Field(min_length=1, max_length=300)
    type: Literal["photo", "video"]
    name: str | None = Field(default=None, max_length=255)


def save_upload(file: UploadFile) -> dict:
    """Validate and store one uploaded photo/video, returning the descriptor
    ({url, type, name}) the frontend keeps in the place's `media` list."""
    content_type = (file.content_type or "").lower()
    is_photo = content_type.startswith("image/")
    is_video = content_type.startswith("video/")
    if not (is_photo or is_video):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image or video files can be uploaded.",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _PHOTO_EXTS and suffix not in _VIDEO_EXTS:
        # Fall back to a sane extension from the content type rather than
        # rejecting an otherwise-valid upload with an odd name.
        suffix = ".jpg" if is_photo else ".mp4"

    data = file.file.read()
    if len(data) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Files must be {MAX_UPLOAD_BYTES // (1024 * 1024)} MB or smaller.",
        )

    stored_name = f"{new_id()}{suffix}"
    (storage.uploads_dir() / stored_name).write_bytes(data)

    return {
        "url": f"/media/{stored_name}",
        "type": "photo" if is_photo else "video",
        "name": file.filename,
    }


def delete_media_files(urls: Iterable[str]) -> None:
    """Best-effort removal of uploaded files a place no longer references
    (after an edit) or that a deleted place owned."""
    for url in urls:
        if not isinstance(url, str) or not url.startswith("/media/"):
            continue
        name = Path(url).name
        if not name:
            continue
        try:
            (storage.uploads_dir() / name).unlink(missing_ok=True)
        except OSError:
            pass


def media_urls(record: dict) -> set[str]:
    """The set of /media/... urls a place record currently points at."""
    return {m.get("url") for m in record.get("media", []) if isinstance(m, dict)}
