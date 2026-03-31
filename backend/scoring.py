"""
scoring.py — Trust Score Computation Engine

Combines all AI signals into a single "Trust Score" (0–100):

┌─────────────────────────────────────┬──────────┬──────────┐
│ Signal                              │ Max Pen. │ Weight   │
├─────────────────────────────────────┼──────────┼──────────┤
│ Edge inconsistency (OpenCV)         │ -20 pts  │ High     │
│ Noise variance anomaly              │ -15 pts  │ Medium   │
│ Copy-move forgery                   │ -25 pts  │ High     │
│ Region colour anomaly               │ -10 pts  │ Medium   │
│ Compression double-save artefacts   │ -10 pts  │ Low      │
│ Metadata flags (each flag)          │ -5 pts   │ Variable │
│ Low OCR confidence                  │ -10 pts  │ Medium   │
└─────────────────────────────────────┴──────────┴──────────┘

Risk Labels:
  0 – 40  →  HIGH RISK       (Likely Tampered)
  40 – 70 →  SUSPICIOUS      (Possible Tampering)
  70 – 100 → LIKELY GENUINE  (Appears Authentic)
"""

from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# Scoring Weights
# Each signal maps to a max-penalty in trust-score points (out of 100).
# The raw signal value (0.0–1.0) is multiplied by the weight.
# ─────────────────────────────────────────────────────────────────────────────

SIGNAL_WEIGHTS = {
    "edge_inconsistency":    20,   # High — edge splicing is a strong indicator
    "copy_move":             25,   # Highest — copy-move is near-definitive
    "noise_variance":        15,   # Medium — noise can vary naturally
    "region_anomaly":        10,   # Medium — colour stats can vary with lighting
    "compression_artifacts": 10,   # Low — many legitimate docs are re-saved
}

MAX_METADATA_PENALTY = 30    # Cap total metadata penalty
PER_FLAG_PENALTY      = 5    # Points deducted per metadata flag
OCR_PENALTY_MAX       = 10   # Max penalty for low OCR confidence
OCR_CONFIDENCE_FLOOR  = 40   # Below this threshold, max OCR penalty applied

# Risk thresholds
HIGH_RISK_THRESHOLD   = 40
SUSPICIOUS_THRESHOLD  = 70


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def compute_trust_score(
    tamper_signals: dict,
    metadata_flags: list,
    ocr_confidence: float = 100.0,
) -> dict:
    """
    Compute a weighted trust score from all detection signals.

    Args:
        tamper_signals:  dict of signal_name → float (0.0–1.0)
        metadata_flags:  list of anomaly flag strings
        ocr_confidence:  Tesseract average confidence (0–100)

    Returns:
        {
          "score": int,                # 0–100
          "label": str,                # "High Risk" | "Suspicious" | "Likely Genuine"
          "risk_level": str,           # "high" | "medium" | "low"
          "color": str,                # hex colour for UI
          "breakdown": list,           # per-signal penalty explanation
          "recommendation": str,       # human-readable recommendation
        }
    """
    score = 100
    breakdown = []

    # ── 1. Tampering Detection Signals ───────────────────────────────────
    for signal_name, max_penalty in SIGNAL_WEIGHTS.items():
        raw = tamper_signals.get(signal_name, 0.0)
        penalty = round(raw * max_penalty, 1)
        score -= penalty

        breakdown.append({
            "signal": signal_name.replace("_", " ").title(),
            "raw_value": raw,
            "penalty": penalty,
            "max_penalty": max_penalty,
            "triggered": raw > 0.1,
            "description": _signal_description(signal_name, raw),
        })

    # ── 2. Metadata Flags ────────────────────────────────────────────────
    meta_penalty = min(len(metadata_flags) * PER_FLAG_PENALTY, MAX_METADATA_PENALTY)
    score -= meta_penalty
    breakdown.append({
        "signal": "Metadata Anomalies",
        "raw_value": len(metadata_flags) / max(MAX_METADATA_PENALTY / PER_FLAG_PENALTY, 1),
        "penalty": meta_penalty,
        "max_penalty": MAX_METADATA_PENALTY,
        "triggered": len(metadata_flags) > 0,
        "description": (
            f"{len(metadata_flags)} metadata anomal{'y' if len(metadata_flags)==1 else 'ies'} found"
            if metadata_flags
            else "No metadata anomalies detected"
        ),
    })

    # ── 3. OCR Confidence Penalty ────────────────────────────────────────
    ocr_penalty = 0.0
    if ocr_confidence < OCR_CONFIDENCE_FLOOR:
        # Linear: 0 penalty at 100, max penalty at OCR_CONFIDENCE_FLOOR
        ratio = 1.0 - (ocr_confidence / OCR_CONFIDENCE_FLOOR)
        ocr_penalty = round(ratio * OCR_PENALTY_MAX, 1)
        score -= ocr_penalty

    breakdown.append({
        "signal": "OCR Confidence",
        "raw_value": ocr_confidence / 100,
        "penalty": ocr_penalty,
        "max_penalty": OCR_PENALTY_MAX,
        "triggered": ocr_confidence < OCR_CONFIDENCE_FLOOR,
        "description": (
            f"OCR confidence {ocr_confidence:.0f}% — "
            + ("normal" if ocr_confidence >= OCR_CONFIDENCE_FLOOR else "low, may indicate altered text")
        ),
    })

    # ── Clamp & Label ────────────────────────────────────────────────────
    score = max(0, min(100, round(score)))
    label, risk_level, color, recommendation = _classify(score)

    return {
        "score": score,
        "label": label,
        "risk_level": risk_level,
        "color": color,
        "breakdown": breakdown,
        "recommendation": recommendation,
        "total_penalty": 100 - score,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _classify(score: int) -> tuple:
    """Returns (label, risk_level, hex_color, recommendation)."""
    if score <= HIGH_RISK_THRESHOLD:
        return (
            "Likely Tampered",
            "high",
            "#ff3b30",
            "This document shows strong signs of tampering. "
            "Do NOT accept it without independent verification from the original source.",
        )
    elif score <= SUSPICIOUS_THRESHOLD:
        return (
            "Suspicious",
            "medium",
            "#ff9500",
            "This document has suspicious characteristics. "
            "Request the original document or additional corroborating evidence before proceeding.",
        )
    else:
        return (
            "Likely Genuine",
            "low",
            "#34c759",
            "This document appears authentic based on automated analysis. "
            "Standard verification procedures are still recommended for high-value transactions.",
        )


def _signal_description(signal: str, value: float) -> str:
    """Returns a human-readable explanation for each signal value."""
    descs = {
        "edge_inconsistency": [
            "Edge gradients are consistent throughout the document.",
            "Minor edge inconsistencies detected — possibly JPEG compression.",
            "Significant edge anomalies detected — potential region splicing.",
            "Severe edge discontinuities — strong indicator of content insertion.",
        ],
        "noise_variance": [
            "Noise distribution is uniform across the document.",
            "Slight noise variation — could be natural sensor noise.",
            "Noticeable noise inconsistency — possible patch insertion.",
            "Highly inconsistent noise map — strong tampering indicator.",
        ],
        "copy_move": [
            "No repeated pixel regions detected.",
            "Few matching keypoints — likely natural image similarity.",
            "Suspicious keypoint clustering — possible copy-move forgery.",
            "High confidence copy-move forgery detected.",
        ],
        "region_anomaly": [
            "Colour statistics are consistent across all regions.",
            "Minor regional colour variation — normal for mixed-lighting photos.",
            "Abnormal colour regions detected — possible compositing.",
            "Multiple colour anomalies — strong evidence of region manipulation.",
        ],
        "compression_artifacts": [
            "Compression pattern is consistent — single save.",
            "Slight DCT irregularity — common in shared/forwarded images.",
            "Double-compression artifacts detected — file may have been re-saved after editing.",
            "Severe double-compression — document was likely edited and re-exported.",
        ],
    }

    levels = descs.get(signal, ["No data."])
    idx = min(int(value * len(levels)), len(levels) - 1)
    return levels[idx]
