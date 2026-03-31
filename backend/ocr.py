"""
ocr.py — Text Extraction Module
Uses pytesseract + Pillow to extract text from images and PDFs.
"""

import os
import re
from pathlib import Path

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


def _pdf_to_image(pdf_path: str):
    """Converts first page of PDF to a PIL Image (no temp file saved to disk)."""
    try:
        doc = fitz.open(pdf_path)
        page = doc.load_page(0)
        pix = page.get_pixmap(dpi=200)
        doc.close()

        # Convert pixmap directly to PIL Image — no temp file needed
        import io
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))
        img.load()  # force load into memory so the BytesIO can be closed
        return img
    except Exception as e:
        print(f"[OCR] PDF conversion failed: {e}")
        return None


def extract_text(file_path: str) -> dict:
    """
    Runs Tesseract OCR on the document.
    """
    if not OCR_AVAILABLE:
        return _mock_ocr()

    try:
        ext = Path(file_path).suffix.lower()

        # Load image
        if ext == ".pdf":
            if not PDF_AVAILABLE:
                return _mock_ocr()
            img = _pdf_to_image(file_path)
            if img is None:
                return _mock_ocr()
        else:
            img = Image.open(file_path)

        # Run Tesseract
        data = pytesseract.image_to_data(
            img,
            output_type=pytesseract.Output.DICT,
            config="--psm 6",
        )

        valid_idx = [i for i, c in enumerate(data["conf"]) if int(c) > 0]
        words = [data["text"][i].strip() for i in valid_idx if data["text"][i].strip()]
        confidences = [int(data["conf"][i]) for i in valid_idx]

        full_text = pytesseract.image_to_string(img, config="--psm 6")
        avg_conf = (sum(confidences) / len(confidences)) if confidences else 0.0

        anomalies = _detect_text_anomalies(full_text)

        return {
            "text": full_text.strip(),
            "word_count": len(words),
            "confidence": round(avg_conf, 2),
            "anomalies": anomalies,
        }

    except Exception as e:
        return {
            "text": "",
            "word_count": 0,
            "confidence": 0.0,
            "anomalies": [],
            "error": str(e),
        }


def _detect_text_anomalies(text: str) -> list:
    anomalies = []

    dates = re.findall(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text)
    if len(set(dates)) > 3:
        anomalies.append("Multiple conflicting date formats detected")

    if len(text) > 100:
        unique_chars = len(set(text.replace(" ", "").replace("\n", "")))
        if unique_chars < 10:
            anomalies.append("Unusually low character diversity in text")

    amounts = re.findall(r"\$[\d,]+\.?\d*", text)
    if len(amounts) > 5:
        anomalies.append(f"High density of monetary values ({len(amounts)} found)")

    lines = [l.strip() for l in text.split("\n") if l.strip()]
    seen = set()
    for line in lines:
        if line in seen and len(line) > 10:
            anomalies.append(f"Repeated text block detected: '{line[:40]}...'")
            break
        seen.add(line)

    return anomalies


def _mock_ocr() -> dict:
    return {
        "text": "[OCR unavailable — install pytesseract and tesseract-ocr]",
        "word_count": 0,
        "confidence": 0.0,
        "anomalies": [],
    }