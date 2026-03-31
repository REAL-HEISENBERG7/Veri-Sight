"""
tamper_detection.py — AI Image Tampering Detection Module

Implements five detection techniques:
  1. Edge Inconsistency Detection  — abrupt edge gradients suggest splicing
  2. Noise Variance Analysis       — inconsistent noise patterns across regions
  3. Copy-Move Forgery Detection   — repeated pixel blocks (keypoint matching)
  4. Region Anomaly Detection      — statistical outlier regions via clustering
  5. Compression Artifact Analysis — JPEG double-compression artefacts

Each technique contributes a penalty signal (0.0–1.0) to the final score.
"""

import os
from pathlib import Path
from typing import Optional

try:
    import cv2
    import numpy as np
    CV_AVAILABLE = True
except ImportError:
    CV_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def analyze_tampering(file_path: str, session_id: str, result_dir: str) -> dict:
    """
    Run all tampering detectors on the document.

    Returns:
        {
          "signals": dict,           # per-technique penalty scores (0.0–1.0)
          "regions": list,           # suspicious bounding boxes [{x,y,w,h,type}]
          "annotated_image": str,    # path to annotated output image
        }
    """
    if not CV_AVAILABLE:
        return _mock_result(session_id, result_dir)

    img = _load_as_image(file_path)
    if img is None:
        return _mock_result(session_id, result_dir)

    regions = []
    signals = {}

    # ── 1. Edge Inconsistency ─────────────────────────────────────────────
    edge_score, edge_regions = _detect_edge_inconsistency(img)
    signals["edge_inconsistency"] = edge_score
    regions.extend(edge_regions)

    # ── 2. Noise Variance ────────────────────────────────────────────────
    noise_score, noise_regions = _detect_noise_variance(img)
    signals["noise_variance"] = noise_score
    regions.extend(noise_regions)

    # ── 3. Copy-Move ─────────────────────────────────────────────────────
    copy_score, copy_regions = _detect_copy_move(img)
    signals["copy_move"] = copy_score
    regions.extend(copy_regions)

    # ── 4. Region Anomaly ────────────────────────────────────────────────
    anomaly_score, anomaly_regions = _detect_region_anomaly(img)
    signals["region_anomaly"] = anomaly_score
    regions.extend(anomaly_regions)

    # ── 5. Compression Artifacts ─────────────────────────────────────────
    compress_score = _detect_compression_artifacts(img)
    signals["compression_artifacts"] = compress_score

    # ── Annotate & Save ──────────────────────────────────────────────────
    annotated_path = _annotate_image(img, regions, session_id, result_dir)

    return {
        "signals": signals,
        "regions": regions,
        "annotated_image": annotated_path,
        "region_count": len(regions),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Detection Techniques
# ─────────────────────────────────────────────────────────────────────────────

def _detect_edge_inconsistency(img: "np.ndarray") -> tuple:
    """
    Uses Canny edge detection + gradient magnitude variance.
    Abrupt localized edge spikes suggest pasted regions.

    Penalty: 0.0 (none) → 1.0 (severe)
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    # Divide image into a 4×4 grid; measure edge density per cell
    h, w = edges.shape
    cell_h, cell_w = h // 4, w // 4
    densities = []
    suspicious_regions = []

    for row in range(4):
        for col in range(4):
            cell = edges[row*cell_h:(row+1)*cell_h, col*cell_w:(col+1)*cell_w]
            density = np.sum(cell) / (cell_h * cell_w * 255)
            densities.append(density)

    if not densities:
        return 0.0, []

    mean_d = np.mean(densities)
    std_d = np.std(densities)

    # Flag cells that are statistical outliers (> 2σ from mean)
    for idx, d in enumerate(densities):
        if std_d > 0 and abs(d - mean_d) > 2 * std_d and d > mean_d:
            row, col = divmod(idx, 4)
            suspicious_regions.append({
                "x": col * cell_w,
                "y": row * cell_h,
                "w": cell_w,
                "h": cell_h,
                "type": "edge_anomaly",
                "confidence": min((abs(d - mean_d) / std_d) / 4, 1.0),
            })

    # Normalize penalty: coefficient of variation of edge densities
    cv_edges = (std_d / mean_d) if mean_d > 0 else 0
    score = min(cv_edges * 1.5, 1.0)

    return round(score, 3), suspicious_regions


def _detect_noise_variance(img: "np.ndarray") -> tuple:
    """
    Estimates local noise using a high-pass filter.
    Inconsistent noise levels across regions → tampering signal.

    Penalty: 0.0 → 1.0
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # High-pass filter: subtract blurred version
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    noise_map = np.abs(gray - blurred)

    h, w = noise_map.shape
    tile = 32  # analyse in 32×32 tiles
    variances = []

    for y in range(0, h - tile, tile):
        for x in range(0, w - tile, tile):
            patch = noise_map[y:y+tile, x:x+tile]
            variances.append(np.var(patch))

    if not variances:
        return 0.0, []

    variances = np.array(variances)
    mean_v = np.mean(variances)
    std_v = np.std(variances)

    suspicious = []
    for idx, v in enumerate(variances):
        if std_v > 0 and v > mean_v + 2.5 * std_v:
            cols_per_row = (w - tile) // tile
            row = idx // max(cols_per_row, 1)
            col = idx % max(cols_per_row, 1)
            suspicious.append({
                "x": col * tile,
                "y": row * tile,
                "w": tile * 2,
                "h": tile * 2,
                "type": "noise_anomaly",
                "confidence": min((v - mean_v) / (std_v * 4), 1.0),
            })

    score = min(std_v / (mean_v + 1e-6) * 0.5, 1.0)
    return round(float(score), 3), suspicious[:6]  # cap regions


def _detect_copy_move(img: "np.ndarray") -> tuple:
    """
    Detects copy-move forgeries using ORB keypoint matching.
    Clusters of matched keypoints within the same image → repeated regions.

    Penalty: 0.0 → 1.0
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ORB detector — fast and licence-free
    orb = cv2.ORB_create(nfeatures=500)
    kps, descs = orb.detectAndCompute(gray, None)

    if descs is None or len(descs) < 10:
        return 0.0, []

    # Self-match: match descriptors against themselves
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches = bf.knnMatch(descs, descs, k=3)

    suspicious_pairs = []
    MIN_DIST = 20  # pixels — must be spatially separated

    for m_group in matches:
        for m in m_group[1:]:  # skip self-match (distance=0)
            pt1 = np.array(kps[m.queryIdx].pt)
            pt2 = np.array(kps[m.trainIdx].pt)
            dist = np.linalg.norm(pt1 - pt2)
            if dist > MIN_DIST and m.distance < 30:
                suspicious_pairs.append((pt1, pt2, m.distance))

    score = min(len(suspicious_pairs) / 50, 1.0)

    regions = []
    for pt1, pt2, _ in suspicious_pairs[:4]:
        regions.append({
            "x": int(pt1[0]) - 15,
            "y": int(pt1[1]) - 15,
            "w": 30,
            "h": 30,
            "type": "copy_move",
            "confidence": 0.7,
        })

    return round(score, 3), regions


def _detect_region_anomaly(img: "np.ndarray") -> tuple:
    """
    Statistical anomaly detection across colour channels.
    Regions with abnormal colour statistics may indicate compositing.

    Penalty: 0.0 → 1.0
    """
    h, w = img.shape[:2]
    PATCH = 64
    patch_stats = []
    coords = []

    for y in range(0, h - PATCH, PATCH):
        for x in range(0, w - PATCH, PATCH):
            patch = img[y:y+PATCH, x:x+PATCH].astype(np.float32)
            mean = patch.mean(axis=(0, 1))       # [B, G, R]
            std  = patch.std(axis=(0, 1))
            patch_stats.append(np.concatenate([mean, std]))
            coords.append((x, y))

    if len(patch_stats) < 4:
        return 0.0, []

    patch_stats = np.array(patch_stats)
    global_mean = patch_stats.mean(axis=0)
    global_std  = patch_stats.std(axis=0) + 1e-6

    z_scores = np.abs((patch_stats - global_mean) / global_std)
    outlier_scores = z_scores.mean(axis=1)

    threshold = np.percentile(outlier_scores, 90)
    suspicious = []

    for idx, score in enumerate(outlier_scores):
        if score > threshold and score > 2.5:
            x, y = coords[idx]
            suspicious.append({
                "x": x,
                "y": y,
                "w": PATCH,
                "h": PATCH,
                "type": "colour_anomaly",
                "confidence": min(float(score) / 5.0, 1.0),
            })

    aggregate_score = min(len(suspicious) / max(len(patch_stats) * 0.1, 1), 1.0)
    return round(aggregate_score, 3), suspicious[:8]


def _detect_compression_artifacts(img: "np.ndarray") -> float:
    """
    Estimates double-compression via DCT block analysis.
    Re-saved JPEG documents often show secondary 8×8 grid artefacts.

    Penalty: 0.0 → 1.0
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    h, w = gray.shape

    block_variances = []
    BLOCK = 8

    for y in range(0, h - BLOCK, BLOCK):
        for x in range(0, w - BLOCK, BLOCK):
            block = gray[y:y+BLOCK, x:x+BLOCK]
            dct_block = cv2.dct(block)
            # High-frequency components indicate compression artefacts
            hf_energy = np.sum(np.abs(dct_block[4:, 4:]))
            block_variances.append(hf_energy)

    if not block_variances:
        return 0.0

    bv = np.array(block_variances)
    # High coefficient of variation in DCT energy → double compression
    score = min(float(np.std(bv) / (np.mean(bv) + 1e-6)) * 0.3, 1.0)
    return round(score, 3)


# ─────────────────────────────────────────────────────────────────────────────
# Annotation
# ─────────────────────────────────────────────────────────────────────────────

REGION_COLORS = {
    "edge_anomaly":    (0, 255, 100),   # neon green
    "noise_anomaly":   (0, 200, 255),   # cyan
    "copy_move":       (255, 50, 50),   # red
    "colour_anomaly":  (255, 165, 0),   # orange
}

def _annotate_image(img: "np.ndarray", regions: list, session_id: str, result_dir: str) -> str:
    """Draws bounding boxes on suspicious regions and saves the result."""
    annotated = img.copy()
    overlay = annotated.copy()

    for r in regions:
        x, y, w, h = r["x"], r["y"], r["w"], r["h"]
        color = REGION_COLORS.get(r.get("type", ""), (255, 255, 0))

        # Filled semi-transparent rect
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1)
        # Solid border
        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)

        # Label
        label = r.get("type", "anomaly").replace("_", " ").upper()
        cv2.putText(
            annotated, label, (x + 2, max(y - 6, 12)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA
        )

    # Blend overlay for transparency effect
    cv2.addWeighted(overlay, 0.15, annotated, 0.85, 0, annotated)

    output_path = os.path.join(result_dir, f"{session_id}_annotated.jpg")
    cv2.imwrite(output_path, annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    return output_path


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_as_image(file_path: str):
    """Loads JPG/PNG directly, converts first PDF page via PyMuPDF."""
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        if not PDF_AVAILABLE:
            return None
        try:
            doc = fitz.open(file_path)
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=150)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8)
            img = img_array.reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            elif pix.n == 3:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            return img
        except Exception as e:
            print(f"[TamperDetect] PDF load failed: {e}")
            return None
    else:
        img = cv2.imread(file_path)
        return img


def _mock_result(session_id: str, result_dir: str) -> dict:
    """Fallback when OpenCV is unavailable."""
    return {
        "signals": {
            "edge_inconsistency": 0.0,
            "noise_variance": 0.0,
            "copy_move": 0.0,
            "region_anomaly": 0.0,
            "compression_artifacts": 0.0,
        },
        "regions": [],
        "annotated_image": None,
        "region_count": 0,
        "note": "Install opencv-python: pip install opencv-python-headless",
    }
