import { useEffect, useRef } from 'react'

export default function ParticleGrid() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Sparse node grid
    const COLS = 16, ROWS = 10
    const nodes = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        nodes.push({
          x: (c / (COLS - 1)) * canvas.width,
          y: (r / (ROWS - 1)) * canvas.height,
          ox: (c / (COLS - 1)) * canvas.width,
          oy: (r / (ROWS - 1)) * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
        })
      }
    }

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.003

      nodes.forEach(n => {
        n.x = n.ox + Math.sin(t + n.oy * 0.005) * 18
        n.y = n.oy + Math.cos(t + n.ox * 0.005) * 12
      })

      // Draw edges
      nodes.forEach((a, i) => {
        nodes.forEach((b, j) => {
          if (j <= i) return
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < canvas.width / COLS * 1.6) {
            const alpha = (1 - dist / (canvas.width / COLS * 1.6)) * 0.08
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(0,255,136,${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,255,136,0.25)'
        ctx.fill()
      })

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}
