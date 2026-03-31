import { useState } from 'react'
import { motion } from 'framer-motion'
import { getAnnotatedImageUrl } from '../api'

export default function AnalysisView({ result, previewUrl, fileName, onReset }) {
  const { scoring, ocr, metadata, tampering } = result
  const [activeTab, setActiveTab] = useState('overview')

  const scoreColor = scoring.color
  const riskBg = {
    high:   'rgba(255,59,48,0.08)',
    medium: 'rgba(255,149,0,0.08)',
    low:    'rgba(52,199,89,0.08)',
  }[scoring.risk_level]
  const riskBorder = {
    high:   'rgba(255,59,48,0.3)',
    medium: 'rgba(255,149,0,0.3)',
    low:    'rgba(52,199,89,0.3)',
  }[scoring.risk_level]
  const riskIcon = { high: '🔴', medium: '🟠', low: '🟢' }[scoring.risk_level]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            ANALYSIS COMPLETE · {fileName}
          </div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-head)' }}>
            Forensic Report
          </h2>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        >
          ← New Analysis
        </button>
      </div>

      {/* ── Top row: Score + Document ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Trust Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass p-6 rounded-2xl col-span-1"
          style={{ background: riskBg, borderColor: riskBorder }}
        >
          <div className="text-xs mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            TRUST SCORE
          </div>

          {/* Score ring */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative">
              <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <motion.circle
                  cx="70" cy="70" r="60"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - scoring.score / 100) }}
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                  style={{ filter: `drop-shadow(0 0 8px ${scoreColor})` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-4xl font-black"
                  style={{ fontFamily: 'var(--font-head)', color: scoreColor }}
                >
                  {scoring.score}
                </motion.span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ 100</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-4">
            <div className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-head)', color: scoreColor }}>
              {riskIcon} {scoring.label}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {scoring.recommendation}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Stat label="Regions Flagged" value={tampering.region_count} />
            <Stat label="Metadata Flags" value={metadata.flag_count} />
            <Stat label="OCR Words" value={ocr.word_count} />
            <Stat label="Penalty Pts" value={`-${scoring.total_penalty}`} valueColor="#ff3b30" />
          </div>
        </motion.div>

        {/* Document Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="glass p-4 rounded-2xl col-span-2"
        >
          <div className="text-xs mb-3 flex items-center justify-between"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <span>DOCUMENT · ANNOTATED VIEW</span>
            <span style={{ color: 'var(--neon)' }}>
              {tampering.region_count > 0 ? `${tampering.region_count} ANOMAL${tampering.region_count === 1 ? 'Y' : 'IES'} MARKED` : '✓ NO ANOMALIES'}
            </span>
          </div>
          <div className="relative rounded-xl overflow-hidden" style={{ background: '#0a0f1a', minHeight: '320px' }}>
            {result.annotated_image ? (
              <img
                src={getAnnotatedImageUrl(result.session_id)}
                alt="Annotated document"
                className="w-full h-full object-contain"
                style={{ maxHeight: '420px' }}
              />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Document preview"
                className="w-full h-full object-contain"
                style={{ maxHeight: '420px' }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--text-muted)' }}>
                No preview available
              </div>
            )}
            {/* Legend */}
            {tampering.region_count > 0 && (
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                {[
                  { label: 'Edge Anomaly', color: '#00ff64' },
                  { label: 'Noise', color: '#00e5ff' },
                  { label: 'Copy-Move', color: '#ff3b30' },
                  { label: 'Colour', color: '#ff9500' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                    style={{ background: 'rgba(6,11,20,0.85)', fontFamily: 'var(--font-mono)' }}>
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: l.color }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {['overview', 'breakdown', 'metadata', 'ocr'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={{
              fontFamily: 'var(--font-head)',
              background: activeTab === tab ? 'rgba(0,255,136,0.12)' : 'transparent',
              color: activeTab === tab ? 'var(--neon)' : 'var(--text-muted)',
              border: activeTab === tab ? '1px solid rgba(0,255,136,0.25)' : '1px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {activeTab === 'overview' && <OverviewTab tampering={tampering} scoring={scoring} />}
        {activeTab === 'breakdown' && <BreakdownTab breakdown={scoring.breakdown} />}
        {activeTab === 'metadata' && <MetadataTab metadata={metadata} />}
        {activeTab === 'ocr' && <OcrTab ocr={ocr} />}
      </motion.div>
    </div>
  )
}


// ── Tab Components ─────────────────────────────────────────────────────────

function OverviewTab({ tampering, scoring }) {
  const signals = tampering.signals || {}
  const items = [
    { key: 'edge_inconsistency',    label: 'Edge Inconsistency',     icon: '⬡' },
    { key: 'noise_variance',        label: 'Noise Variance',          icon: '〰' },
    { key: 'copy_move',             label: 'Copy-Move Forgery',       icon: '⊕' },
    { key: 'region_anomaly',        label: 'Region Colour Anomaly',   icon: '◈' },
    { key: 'compression_artifacts', label: 'Compression Artifacts',   icon: '◻' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, i) => {
        const val = signals[item.key] ?? 0
        const pct = Math.round(val * 100)
        const severity = val > 0.6 ? 'high' : val > 0.25 ? 'medium' : 'low'
        const clr = { high: '#ff3b30', medium: '#ff9500', low: '#34c759' }[severity]

        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass p-5 rounded-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{item.icon}</span>
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-head)' }}>{item.label}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: `${clr}18`,
                  color: clr,
                  fontFamily: 'var(--font-mono)',
                  border: `1px solid ${clr}40`,
                }}>
                {severity.toUpperCase()}
              </span>
            </div>
            <div className="trust-bar mb-2">
              <motion.div
                className="trust-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.07 }}
                style={{ background: `linear-gradient(90deg, ${clr}99, ${clr})` }}
              />
            </div>
            <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              <span>Score: {val.toFixed(3)}</span>
              <span style={{ color: clr }}>{pct}% anomalous</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function BreakdownTab({ breakdown }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <h3 className="font-semibold" style={{ fontFamily: 'var(--font-head)' }}>Scoring Breakdown</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Each signal contributes a weighted penalty to the 100-point trust score.
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {breakdown.map((item, i) => {
          const pct = item.max_penalty > 0 ? (item.penalty / item.max_penalty) * 100 : 0
          return (
            <motion.div
              key={item.signal}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="breakdown-row"
            >
              <div>
                <div className="text-sm font-medium mb-0.5">{item.signal}</div>
                <div className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {item.description}
                </div>
                <div className="trust-bar mt-2" style={{ width: '100%', maxWidth: '240px' }}>
                  <motion.div
                    className="trust-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.05 }}
                    style={{
                      background: item.triggered
                        ? 'linear-gradient(90deg, #ff3b3088, #ff3b30)'
                        : 'linear-gradient(90deg, #34c75988, #34c759)',
                    }}
                  />
                </div>
              </div>
              <div className="text-right text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <div>max: -{item.max_penalty}</div>
                <div style={{ color: item.penalty > 0 ? '#ff3b30' : '#34c759', fontWeight: 600 }}>
                  -{item.penalty}
                </div>
              </div>
              <div className="w-6 text-center text-lg">
                {item.triggered ? '⚠️' : '✅'}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function MetadataTab({ metadata }) {
  const { raw = {}, flags = [], file_info = {} } = metadata

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Flags */}
      <div className="glass p-5 rounded-2xl">
        <div className="text-xs mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          ANOMALY FLAGS ({flags.length})
        </div>
        {flags.length === 0 ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: '#34c759' }}>
            <span>✅</span> No metadata anomalies detected
          </div>
        ) : (
          <div className="space-y-2">
            {flags.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3 text-sm p-3 rounded-lg"
                style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)' }}
              >
                <span className="mt-0.5 flex-shrink-0">⚠️</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{f}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* File info */}
      <div className="glass p-5 rounded-2xl">
        <div className="text-xs mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          FILE SYSTEM INFO
        </div>
        <div className="space-y-2">
          {Object.entries(file_info).filter(([k]) => k !== 'error').map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs py-1.5 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.04)', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</span>
              <span className="text-right max-w-xs truncate" style={{ color: 'var(--text)' }}>{String(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Raw metadata */}
      {Object.keys(raw).length > 0 && (
        <div className="glass p-5 rounded-2xl md:col-span-2">
          <div className="text-xs mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            RAW METADATA
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            {Object.entries(raw).slice(0, 30).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs py-1 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.04)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="text-right max-w-48 truncate" style={{ color: 'var(--text)' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OcrTab({ ocr }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass p-5 rounded-2xl md:col-span-2">
        <div className="text-xs mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          EXTRACTED TEXT
        </div>
        <pre className="text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto"
          style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>
          {ocr.text || '[No text extracted]'}
        </pre>
      </div>
      <div className="space-y-4">
        <div className="glass p-5 rounded-2xl">
          <div className="text-xs mb-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>OCR METRICS</div>
          <Stat label="Word Count" value={ocr.word_count} large />
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              <span>Confidence</span>
              <span style={{ color: ocr.confidence > 70 ? '#34c759' : '#ff9500' }}>{ocr.confidence?.toFixed(1)}%</span>
            </div>
            <div className="trust-bar">
              <motion.div
                className="trust-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${ocr.confidence ?? 0}%` }}
                transition={{ duration: 1 }}
                style={{
                  background: ocr.confidence > 70
                    ? 'linear-gradient(90deg, #34c75988, #34c759)'
                    : 'linear-gradient(90deg, #ff950088, #ff9500)',
                }}
              />
            </div>
          </div>
        </div>
        {ocr.anomalies?.length > 0 && (
          <div className="glass p-5 rounded-2xl">
            <div className="text-xs mb-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>TEXT ANOMALIES</div>
            <div className="space-y-2">
              {ocr.anomalies.map((a, i) => (
                <div key={i} className="text-xs p-2 rounded-lg" style={{ background: 'rgba(255,149,0,0.08)', color: '#ff9500' }}>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, valueColor, large }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span
        className={large ? 'text-2xl font-bold' : 'text-sm font-semibold'}
        style={{ fontFamily: 'var(--font-head)', color: valueColor || 'var(--text)' }}
      >
        {value}
      </span>
    </div>
  )
}
