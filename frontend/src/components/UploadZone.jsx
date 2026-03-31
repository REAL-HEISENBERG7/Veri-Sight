import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'

const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
}

export default function UploadZone({ onFileAccepted }) {
  const [preview, setPreview] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) return
    const file = accepted[0]
    if (!file) return
    setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1), type: file.type })
    setPreview(URL.createObjectURL(file))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept: ACCEPTED,
    maxFiles: 1,
    multiple: false,
  })

  const handleAnalyze = () => {
    if (!fileInfo) return
    // Re-create file from preview URL won't work — we stored file on drop
    // We need to pass the actual file object through
  }

  // Override: pass file directly to parent
  const onDropWithParent = useCallback((accepted) => {
    const file = accepted[0]
    if (!file) return
    setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1), type: file.type })
    setPreview(URL.createObjectURL(file))
    // Trigger parent immediately (could show confirm step too)
    onFileAccepted(file)
  }, [onFileAccepted])

  const { getRootProps: getRootPropsActual, getInputProps: getInputPropsActual, isDragActive: isDA } =
    useDropzone({
      onDrop: onDropWithParent,
      accept: ACCEPTED,
      maxFiles: 1,
      multiple: false,
    })

  const active = isDA

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="max-w-2xl mx-auto"
    >
      <div
        {...getRootPropsActual()}
        className="relative rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 scanlines"
        style={{
          background: active
            ? 'rgba(0,255,136,0.06)'
            : 'rgba(13,22,35,0.6)',
          border: `2px dashed ${active ? 'rgba(0,255,136,0.6)' : 'rgba(0,255,136,0.2)'}`,
          backdropFilter: 'blur(16px)',
          minHeight: '280px',
          boxShadow: active ? '0 0 40px rgba(0,255,136,0.12) inset' : 'none',
        }}
      >
        <input {...getInputPropsActual()} />

        {/* Upload icon */}
        <motion.div
          animate={active ? { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] } : { scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6 relative"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M18 24V12M18 12L12 18M18 12L24 18" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 28a4 4 0 01-4-4v-2a4 4 0 014-4h1" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <path d="M30 28a4 4 0 004-4v-2a4 4 0 00-4-4h-1" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <rect x="4" y="28" width="28" height="3" rx="1.5" stroke="#00ff88" strokeWidth="1.5" opacity="0.3"/>
            </svg>
          </div>
          {active && (
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ border: '2px solid #00ff88', boxShadow: '0 0 20px rgba(0,255,136,0.4)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="drop"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="text-xl font-semibold mb-1 neon-text" style={{ fontFamily: 'var(--font-head)' }}>
                Release to Upload
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>VeriSight will begin analysis immediately</div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--text)' }}>
                Drop a document to analyse
              </div>
              <div className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                or click to browse — JPG, PNG, or PDF (max 20 MB)
              </div>

              {/* File type badges */}
              <div className="flex items-center justify-center gap-2">
                {['.JPG', '.PNG', '.PDF'].map(t => (
                  <span key={t} className="text-xs px-3 py-1 rounded-full"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0,255,136,0.06)',
                      border: '1px solid rgba(0,255,136,0.2)',
                      color: 'var(--neon)',
                    }}>
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Corner decorations */}
        {['tl', 'tr', 'bl', 'br'].map(c => (
          <div key={c} className="absolute w-4 h-4"
            style={{
              [c.includes('t') ? 'top' : 'bottom']: 12,
              [c.includes('l') ? 'left' : 'right']: 12,
              borderTop: c.includes('t') ? '2px solid rgba(0,255,136,0.4)' : undefined,
              borderBottom: c.includes('b') ? '2px solid rgba(0,255,136,0.4)' : undefined,
              borderLeft: c.includes('l') ? '2px solid rgba(0,255,136,0.4)' : undefined,
              borderRight: c.includes('r') ? '2px solid rgba(0,255,136,0.4)' : undefined,
            }}
          />
        ))}
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        <span>🔒</span>
        <span>Files processed locally · Never stored on servers</span>
      </div>
    </motion.div>
  )
}
