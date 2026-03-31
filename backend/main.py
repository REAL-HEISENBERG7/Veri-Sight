"""
VeriSight — AI-Powered Document Tampering Detection
FastAPI Backend Entry Point
"""

import os
import uuid
import json
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import uvicorn

from ocr import extract_text
from tamper_detection import analyze_tampering
from metadata import extract_metadata
from scoring import compute_trust_score


# ── NumPy JSON Encoder ───────────────────────────────────────────────────────
# Fixes: "Object of type bool_ is not JSON serializable"
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.bool_): return bool(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super().default(obj)

def numpy_safe(obj):
    return json.loads(json.dumps(obj, cls=NumpyEncoder))


# ── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="VeriSight API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
RESULT_DIR = Path("results")
UPLOAD_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
MAX_FILE_SIZE_MB = 20


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "VeriSight API is running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"File too large ({size_mb:.1f} MB).")

    session_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix.lower() or ".tmp"
    save_path = UPLOAD_DIR / f"{session_id}{ext}"

    with open(save_path, "wb") as f:
        f.write(contents)

    return {"session_id": session_id, "filename": file.filename, "size_mb": round(size_mb, 2)}

@app.post("/analyze/{session_id}")
async def analyze_document(session_id: str):
    matches = list(UPLOAD_DIR.glob(f"{session_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Session not found.")
    file_path = str(matches[0])

    try:
        ocr_result    = extract_text(file_path)
        tamper_result = analyze_tampering(file_path, session_id, str(RESULT_DIR))
        meta_result   = extract_metadata(file_path)
        score_result  = compute_trust_score(
            tamper_signals=tamper_result["signals"],
            metadata_flags=meta_result["flags"],
            ocr_confidence=ocr_result.get("confidence", 100),
        )

        response = {
            "session_id": session_id,
            "file_path": file_path,
            "ocr": ocr_result,
            "tampering": tamper_result,
            "metadata": meta_result,
            "scoring": score_result,
            "annotated_image": tamper_result.get("annotated_image"),
        }

        return JSONResponse(content=numpy_safe(response))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/result/image/{session_id}")
async def get_annotated_image(session_id: str):
    path = RESULT_DIR / f"{session_id}_annotated.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Annotated image not found.")
    return FileResponse(str(path), media_type="image/jpeg")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)