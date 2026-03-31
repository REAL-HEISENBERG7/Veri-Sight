"""
metadata.py — Document Metadata Extraction & Anomaly Detection

Extracts EXIF, PDF XMP, and file-system metadata.
Flags suspicious inconsistencies that often accompany tampering:
  • Modification time earlier than creation time
  • Missing or stripped EXIF (common after editing)
  • Software/editor traces (Photoshop, GIMP, etc.)
  • GPS coordinates embedded in sensitive docs
  • Conflicting author/creation tool chains
"""

import os
import stat
import hashlib
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image
    from PIL.ExifTags import TAGS
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import fitz  # PyMuPDF for PDF metadata
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# Editing / Tampering Software Keywords
# ─────────────────────────────────────────────────────────────────────────────
EDITING_TOOLS = [
    "photoshop", "gimp", "lightroom", "affinity", "paint.net",
    "illustrator", "inkscape", "canva", "pixelmator", "acrobat",
    "libreoffice", "openoffice", "foxit", "nitro",
]


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def extract_metadata(file_path: str) -> dict:
    """
    Extracts all available metadata from the file and returns:
        {
          "raw": dict,          # key-value metadata pairs
          "flags": list,        # detected anomaly flags (strings)
          "file_info": dict,    # size, hash, timestamps
        }
    """
    flags = []
    raw = {}

    # ── File-system info ─────────────────────────────────────────────────
    file_info = _get_file_info(file_path)
    flags.extend(_check_filesystem_anomalies(file_info))

    # ── Format-specific metadata ─────────────────────────────────────────
    ext = Path(file_path).suffix.lower()
    if ext in {".jpg", ".jpeg", ".png"}:
        if PIL_AVAILABLE:
            exif_data, exif_flags = _extract_image_exif(file_path)
            raw.update(exif_data)
            flags.extend(exif_flags)
        else:
            raw["exif_note"] = "PIL not installed"

    elif ext == ".pdf":
        if PDF_AVAILABLE:
            pdf_data, pdf_flags = _extract_pdf_metadata(file_path)
            raw.update(pdf_data)
            flags.extend(pdf_flags)
        else:
            raw["pdf_note"] = "PyMuPDF not installed"

    return {
        "raw": raw,
        "flags": list(set(flags)),  # deduplicate
        "file_info": file_info,
        "flag_count": len(set(flags)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# File-System Analysis
# ─────────────────────────────────────────────────────────────────────────────

def _get_file_info(file_path: str) -> dict:
    """Returns size, MD5 hash, and filesystem timestamps."""
    try:
        st = os.stat(file_path)
        with open(file_path, "rb") as f:
            file_hash = hashlib.md5(f.read()).hexdigest()

        ctime = datetime.fromtimestamp(st.st_ctime)
        mtime = datetime.fromtimestamp(st.st_mtime)

        return {
            "size_bytes": st.st_size,
            "size_kb": round(st.st_size / 1024, 1),
            "md5": file_hash,
            "created": ctime.isoformat(),
            "modified": mtime.isoformat(),
            "mtime_before_ctime": mtime < ctime,
        }
    except Exception as e:
        return {"error": str(e)}


def _check_filesystem_anomalies(file_info: dict) -> list:
    """Detects timestamp and size anomalies at the filesystem level."""
    flags = []

    if file_info.get("mtime_before_ctime"):
        flags.append("Modification timestamp predates creation timestamp")

    size_kb = file_info.get("size_kb", 0)
    if size_kb < 1:
        flags.append("Suspiciously small file size (< 1 KB)")
    elif size_kb > 15_000:
        flags.append("Unusually large file (> 15 MB)")

    return flags


# ─────────────────────────────────────────────────────────────────────────────
# Image EXIF Analysis
# ─────────────────────────────────────────────────────────────────────────────

def _extract_image_exif(file_path: str) -> tuple:
    """Extracts EXIF tags from JPEG/PNG and flags editing artefacts."""
    flags = []
    raw = {}

    try:
        img = Image.open(file_path)
        exif_data = img._getexif()

        if exif_data is None:
            flags.append("No EXIF data found — may have been stripped by editing software")
            raw["exif_present"] = False
            return raw, flags

        raw["exif_present"] = True
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            if isinstance(value, bytes):
                try:
                    value = value.decode("utf-8", errors="replace")
                except Exception:
                    value = repr(value)
            raw[str(tag)] = str(value)[:200]  # cap long values

        # Check for editing software
        software = str(raw.get("Software", "")).lower()
        make = str(raw.get("Make", "")).lower()

        for tool in EDITING_TOOLS:
            if tool in software or tool in make:
                flags.append(f"Document processed by editing software: {raw.get('Software', tool)}")
                break

        # Date consistency check
        orig_date = raw.get("DateTimeOriginal", "")
        mod_date = raw.get("DateTime", "")
        if orig_date and mod_date and orig_date != mod_date:
            try:
                fmt = "%Y:%m:%d %H:%M:%S"
                d_orig = datetime.strptime(orig_date, fmt)
                d_mod = datetime.strptime(mod_date, fmt)
                if d_mod > d_orig:
                    flags.append(
                        f"Image was modified after original capture "
                        f"({orig_date} → {mod_date})"
                    )
            except ValueError:
                flags.append("Unparseable EXIF date values detected")

        # GPS in document (unusual for scanned docs)
        if "GPSInfo" in raw:
            flags.append("GPS coordinates embedded in document (unusual for scanned files)")

        # Thumbnail mismatch is a known tamper indicator
        if "ThumbnailImage" in raw:
            flags.append("Embedded thumbnail present — may differ from actual image content")

    except Exception as e:
        flags.append(f"EXIF extraction error: {str(e)[:80]}")

    return raw, flags


# ─────────────────────────────────────────────────────────────────────────────
# PDF Metadata Analysis
# ─────────────────────────────────────────────────────────────────────────────

def _extract_pdf_metadata(file_path: str) -> tuple:
    """Extracts XMP/Info metadata from PDF and flags anomalies."""
    flags = []
    raw = {}

    try:
        doc = fitz.open(file_path)
        meta = doc.metadata or {}

        for key, value in meta.items():
            if value:
                raw[key] = str(value)[:200]

        # Check for editing tools in producer/creator fields
        producer = str(meta.get("producer", "")).lower()
        creator = str(meta.get("creator", "")).lower()

        for tool in EDITING_TOOLS:
            if tool in producer or tool in creator:
                flags.append(
                    f"PDF modified with editing tool: {meta.get('producer', meta.get('creator', tool))}"
                )
                break

        # Creation/modification date check
        creation_date = meta.get("creationDate", "")
        mod_date = meta.get("modDate", "")

        if creation_date and mod_date and creation_date != mod_date:
            flags.append(f"PDF modification date differs from creation date")

        if not creation_date:
            flags.append("PDF missing creation date metadata")

        # Multiple pages with inconsistent fonts can indicate splice
        if doc.page_count > 1:
            fonts_per_page = []
            for page_num in range(min(doc.page_count, 5)):
                page = doc.load_page(page_num)
                fonts = page.get_fonts()
                fonts_per_page.append(set(f[3] for f in fonts))  # font names

            all_fonts = fonts_per_page[0]
            for fp in fonts_per_page[1:]:
                if fp != all_fonts:
                    flags.append("Inconsistent fonts across PDF pages — possible content injection")
                    break

        raw["page_count"] = doc.page_count
        raw["encrypted"] = doc.is_encrypted

        if doc.is_encrypted:
            flags.append("PDF is encrypted — full analysis may be limited")

    except Exception as e:
        flags.append(f"PDF metadata extraction error: {str(e)[:80]}")

    return raw, flags
