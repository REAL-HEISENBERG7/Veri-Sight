import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import UploadZone from './components/UploadZone'
import AnalysisView from './components/AnalysisView'
import ParticleGrid from './components/ParticleGrid'
import { analyzeDocument, uploadDocument } from './api'

export default function App() {
  const [phase, setPhase] = useState('upload')   // upload | analyzing | results
  const [sessionId, setSessionId] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  const handleFileAccepted = useCallback(async (file) => {
    setError(null)
    setPreviewUrl(URL.createObjectURL(file))
    setFileName(file.name)
    setPhase('analyzing')
    setProgress(10)

    try {
      // Step 1 – Upload
      const uploadRes = await uploadDocument(file)
      const sid = uploadRes.session_id
      setSessionId(sid)
      setProgress(35)

      // Simulate gradual progress while backend runs
      const tick = setInterval(() => {
        setProgress(p => (p < 85 ? p + Math.random() * 6 : p))
      }, 400)

      // Step 2 – Analyze
      const analysisRes = await analyzeDocument(sid)
      clearInterval(tick)
      setProgress(100)

      setTimeout(() => {
        setResult(analysisRes)
        setPhase('results')
      }, 500)

    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Analysis failed')
      setPhase('upload')
      setProgress(0)
    }
  }, [])

  const handleReset = useCallback(() => {
    setPhase('upload')
    setSessionId(null)
    setPreviewUrl(null)
    setFileName('')
    setResult(null)
    setError(null)
    setProgress(0)
  }, [])

  return (
    <div className="relative min-h-screen grid-bg" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Background effects */}
      <ParticleGrid />

      {/* Ambient glow spots */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,255,136,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,255,136,0.04) 0%, transparent 70%)' }} />
      </div>

      <Navbar />

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        <AnimatePresence mode="wait">

          {/* ── Upload phase ─────────────────────────────────────── */}
          {phase === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Hero />
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 glass rounded-xl px-5 py-4 flex items-center gap-3"
                  style={{ borderColor: 'rgba(255,59,48,0.4)', background: 'rgba(255,59,48,0.06)' }}
                >
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm" style={{ color: '#ff3b30' }}>{error}</p>
                </motion.div>
              )}
              <UploadZone onFileAccepted={handleFileAccepted} />
              <Features />
            </motion.div>
          )}

          {/* ── Analyzing phase ──────────────────────────────────── */}
          {phase === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
            >
              <AnalyzingScreen fileName={fileName} progress={progress} previewUrl={previewUrl} />
            </motion.div>
          )}

          {/* ── Results phase ────────────────────────────────────── */}
          {phase === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <AnalysisView
                result={result}
                previewUrl={previewUrl}
                fileName={fileName}
                onReset={handleReset}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}


// ── Sub-components ───────────────────────────────────────────────────────────

function Hero() {
  return (
    <div className="text-center mb-12 pt-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
        style={{
          background: 'rgba(0,255,136,0.07)',
          border: '1px solid rgba(0,255,136,0.2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--neon)',
          letterSpacing: '0.1em',
        }}
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
        SYSTEM ONLINE · AI PIPELINE READY
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ fontFamily: 'var(--font-head)', fontSize: 'clamp(2.2rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1 }}
      >
        <span style={{ color: 'var(--text)' }}>Detect Document</span>
        <br />
        <span className="neon-text">Tampering Instantly</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mt-4 text-lg max-w-xl mx-auto"
        style={{ color: 'var(--text-muted)', fontWeight: 300 }}
      >
        VeriSight uses multi-layer AI analysis — edge detection, noise profiling,
        copy-move forensics, and metadata inspection — to verify document authenticity.
      </motion.p>
    </div>
  )
}

function Features() {
  const features = [
    { icon: '🔬', title: 'Edge Forensics', desc: 'OpenCV edge-inconsistency maps reveal splice boundaries' },
    { icon: '🧬', title: 'Noise Analysis', desc: 'Sensor noise profiling detects patched regions' },
    { icon: '📋', title: 'OCR + Text Intel', desc: 'Tesseract extracts & validates text authenticity' },
    { icon: '🔐', title: 'Metadata Audit', desc: 'EXIF & XMP metadata reveal edit history' },
    { icon: '🔍', title: 'Copy-Move Detection', desc: 'ORB keypoint matching finds duplicated regions' },
    { icon: '⚡', title: 'Trust Score', desc: 'Weighted AI signals produce a 0–100 authenticity score' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10"
    >
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 + i * 0.05 }}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="glass p-5 rounded-2xl group cursor-default"
        >
          <div className="text-2xl mb-3">{f.icon}</div>
          <div className="font-semibold text-sm mb-1 group-hover:text-green-400 transition-colors"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--text)' }}>
            {f.title}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</div>
        </motion.div>
      ))}
    </motion.div>
  )
}

const STAGES = [
  'Loading document into memory...',
  'Running OCR text extraction...',
  'Detecting edge inconsistencies...',
  'Profiling noise distribution...',
  'Running copy-move detection...',
  'Analysing metadata signatures...',
  'Computing trust score...',
  'Generating annotated report...',
]

function AnalyzingScreen({ fileName, progress, previewUrl }) {
  const stageIdx = Math.min(Math.floor((progress / 100) * STAGES.length), STAGES.length - 1)

  return (
    <>
      {/* Preview thumbnail */}
      {previewUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-52 h-64 rounded-xl overflow-hidden scanlines"
          style={{ border: '1px solid rgba(0,255,136,0.25)' }}
        >
          <img src={previewUrl} alt="doc" className="w-full h-full object-cover" />
          {/* Scanning line */}
          <motion.div
            className="absolute left-0 right-0 h-0.5"
            style={{ background: 'linear-gradient(90deg, transparent, #00ff88, transparent)', boxShadow: '0 0 12px #00ff88' }}
            animate={{ y: [0, 256, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(6,11,20,0.8))' }} />
        </motion.div>
      )}

      <div className="w-full max-w-md glass p-8 rounded-2xl">
        {/* Progress ring */}
        <div className="relative flex items-center justify-center mb-6">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,255,136,0.08)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="#00ff88"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
              style={{ filter: 'drop-shadow(0 0 6px #00ff88)' }}
              transition={{ duration: 0.4 }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-2xl font-bold neon-text" style={{ fontFamily: 'var(--font-mono)' }}>
              {Math.round(progress)}%
            </div>
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="font-semibold mb-1" style={{ fontFamily: 'var(--font-head)' }}>Analysing Document</div>
          <div className="text-sm truncate max-w-xs mx-auto" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {fileName}
          </div>
        </div>

        {/* Stage indicator */}
        <div className="space-y-2">
          {STAGES.map((stage, i) => (
            <motion.div
              key={stage}
              className="flex items-center gap-3 text-xs rounded-lg px-3 py-2"
              style={{
                fontFamily: 'var(--font-mono)',
                background: i === stageIdx ? 'rgba(0,255,136,0.08)' : 'transparent',
                color: i < stageIdx ? 'var(--neon)' : i === stageIdx ? 'var(--text)' : 'rgba(107,127,163,0.4)',
                transition: 'all 0.3s',
              }}
            >
              <span>{i < stageIdx ? '✓' : i === stageIdx ? '▶' : '○'}</span>
              <span>{stage}</span>
              {i === stageIdx && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ color: 'var(--neon)', marginLeft: 'auto' }}
                >
                  ●
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}

function Navbar() {
  return (
    <nav className="relative z-20 border-b" style={{ borderColor: 'rgba(0,255,136,0.08)' }}>
      <div className="container mx-auto px-4 max-w-6xl h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)' }}>
            <span className="text-base">🛡</span>
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
            Veri<span className="neon-text">Sight</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-xs hidden sm:block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            AI-POWERED FORENSICS
          </span>
          <div className="flex items-center gap-2 text-xs px-3 py-1 rounded-full"
            style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', color: 'var(--neon)', fontFamily: 'var(--font-mono)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            v1.0
          </div>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="relative z-10 mt-20 border-t text-center py-8"
      style={{ borderColor: 'rgba(0,255,136,0.06)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
      VERISIGHT · AI DOCUMENT FORENSICS · ALL ANALYSIS IS PERFORMED LOCALLY · NO DATA IS STORED
    </footer>
  )
}