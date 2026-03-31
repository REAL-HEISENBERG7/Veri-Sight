# 🛡️ VeriSight — AI Document Tampering Detection Platform

<div align="center">

![VeriSight Banner](https://img.shields.io/badge/VeriSight-AI%20Forensics-00ff88?style=for-the-badge&logo=shield&logoColor=white)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square&logo=python)](https://python.org)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.9-5C3EE8?style=flat-square&logo=opencv)](https://opencv.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**An advanced AI-powered document forensics platform that detects tampering, forgery, and manipulation in images and PDFs.**

[Features](#-features) • [Demo](#-demo) • [Tech Stack](#-tech-stack) • [Setup](#-setup) • [API](#-api-reference) • [How It Works](#-how-it-works)

</div>

---

## 🎯 What is VeriSight?

VeriSight is a full-stack web application that uses computer vision and AI to analyse documents for signs of digital tampering. Upload any JPG, PNG, or PDF and get an instant forensic report with a **Trust Score (0–100)**, visual anomaly highlighting, OCR text extraction, and metadata analysis.

Built for hackathons, cybersecurity demos, and real-world document verification workflows.

---

## ✨ Features

- 📄 **Drag-and-drop upload** — supports JPG, PNG, and PDF (up to 20 MB)
- 🔍 **OCR Text Extraction** — powered by Tesseract, extracts and validates document text
- 🧠 **5-layer AI Tampering Detection:**
  - Edge Inconsistency Detection (OpenCV Canny)
  - Noise Variance Analysis (high-pass filter)
  - Copy-Move Forgery Detection (ORB keypoint matching)
  - Region Colour Anomaly Detection (statistical z-scores)
  - Compression Artifact Analysis (DCT block energy)
- 📊 **Metadata Analysis** — EXIF, PDF XMP, filesystem timestamps, editing software detection
- ⚡ **Trust Score Engine** — weighted penalty system producing a 0–100 authenticity score
- 🔴 **Visual Highlighting** — annotated image with colour-coded bounding boxes on suspicious regions
- 🌙 **Cybersecurity UI** — dark theme, neon accents, glassmorphism, animated particle grid

---

## 🖥️ Demo

| Upload Screen | Analysing | Results Dashboard |
|---|---|---|
| Drag & drop with animated zone | Live progress with stage log | Trust score + annotated document |

**Risk Labels:**
| Score | Label | Meaning |
|---|---|---|
| 70–100 | 🟢 Likely Genuine | Document appears authentic |
| 40–70 | 🟠 Suspicious | Possible tampering detected |
| 0–40 | 🔴 Likely Tampered | Strong evidence of manipulation |

---

## 🔧 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework & build tool |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations & transitions |
| Axios | API communication |
| React Dropzone | File upload handling |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.11 | Core language |
| FastAPI | REST API framework |
| OpenCV | Image analysis & tampering detection |
| Tesseract + pytesseract | OCR text extraction |
| PyMuPDF (fitz) | PDF processing |
| Pillow | Image handling |
| NumPy | Numerical analysis |

---

## 📁 Project Structure

```
veri/
├── backend/
│   ├── main.py               # FastAPI app + all routes
│   ├── ocr.py                # Tesseract OCR extraction
│   ├── tamper_detection.py   # OpenCV 5-layer detection pipeline
│   ├── metadata.py           # EXIF / PDF metadata analysis
│   ├── scoring.py            # Weighted trust score engine
│   ├── requirements.txt      # Python dependencies
│   ├── uploads/              # (auto-created) uploaded files
│   └── results/              # (auto-created) annotated images
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── App.jsx                      # Main app + state machine
        ├── api.js                       # Axios API client
        ├── main.jsx                     # React entry point
        ├── index.css                    # Global styles + design tokens
        └── components/
            ├── UploadZone.jsx           # Drag-and-drop upload UI
            ├── AnalysisView.jsx         # Results dashboard (4 tabs)
            └── ParticleGrid.jsx         # Animated canvas background
```

---

## ⚙️ Setup

### Prerequisites

| Requirement | Version | Download |
|---|---|---|
| Python | 3.11+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| Tesseract OCR | 5.x | See below |

**Install Tesseract:**

**Windows:** Download from https://github.com/UB-Mannheim/tesseract/wiki and check "Add to PATH" during install.

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt install tesseract-ocr
```

---

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/veri.git
cd veri
```

### 2. Run the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

✅ Backend running at: `http://localhost:8000`

### 3. Run the Frontend

Open a **new terminal:**

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend running at: `http://localhost:5173`

### 4. Open the app

Go to **http://localhost:5173** in your browser and drop a document to analyse it.

> **Windows note:** If OCR shows no text, add this line to `backend/ocr.py` after `import pytesseract`:
> ```python
> pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
> ```

---

## 🔬 How It Works

```
Document Upload
      │
      ├──► OCR (Tesseract)
      │         Extract text, word count, confidence score
      │
      ├──► Tampering Detection (OpenCV)
      │         ├── Edge inconsistency  →  Canny + 4×4 grid variance
      │         ├── Noise variance      →  High-pass filter tile analysis
      │         ├── Copy-move           →  ORB keypoint self-matching
      │         ├── Region anomaly      →  Colour stats z-score outliers
      │         └── Compression         →  DCT block energy variance
      │
      ├──► Metadata Analysis
      │         ├── EXIF: software, dates, GPS, thumbnail
      │         └── PDF: creator, producer, font consistency
      │
      └──► Scoring Engine
                ├── Each signal (0.0–1.0) × weight → penalty points
                ├── Metadata flags × 5 pts (max 30)
                ├── OCR confidence penalty (max 10)
                └── Trust Score = 100 − Σ(penalties)
```

### Scoring Weights

| Signal | Max Penalty |
|---|---|
| Copy-Move Forgery | −25 pts |
| Edge Inconsistency | −20 pts |
| Noise Variance | −15 pts |
| Region Colour Anomaly | −10 pts |
| Compression Artifacts | −10 pts |
| Metadata Anomalies | −5 pts each (max −30) |
| OCR Confidence | −10 pts |

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/upload` | Upload document → returns `session_id` |
| `POST` | `/analyze/{session_id}` | Run full AI pipeline |
| `GET` | `/result/image/{session_id}` | Get annotated result image |

**Example:**
```bash
# Upload
curl -X POST http://localhost:8000/upload -F "file=@document.jpg"

# Analyze
curl -X POST http://localhost:8000/analyze/{session_id}
```

Interactive API docs available at: `http://localhost:8000/docs`

---

## 🚀 Deployment

### Docker

```bash
# Build and run both services
docker-compose up --build
```

### Cloud Platforms

| Platform | Service |
|---|---|
| Railway | Deploy backend as Python service |
| Render | Web service (Python) + Static site |
| Vercel | Frontend static deployment |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — free for commercial and personal use.

---

## 👨‍💻 Author

Built by team **UNCUT GEMS**

---

<div align="center">
<strong>VeriSight — Trust, but Verify.</strong>
</div>
