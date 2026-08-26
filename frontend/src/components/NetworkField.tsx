import { useEffect, useRef } from 'react'

type Node = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hue: number
}

function theme() {
  const light = document.documentElement.classList.contains('light')
  return light
    ? {
        mint: [15, 118, 110] as const,
        violet: [79, 70, 229] as const,
        node: 0.72,
        line: 0.48,
        helix: 0.42,
        stroke: 1.45,
      }
    : {
        mint: [62, 232, 197] as const,
        violet: [139, 108, 255] as const,
        node: 0.55,
        line: 0.32,
        helix: 0.22,
        stroke: 1.15,
      }
}

function rgba(rgb: readonly [number, number, number], a: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`
}

export function NetworkField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const surface = canvas
    const host = parent
    const gfx = surface.getContext('2d', { alpha: true })
    if (!gfx) return
    const ctx: CanvasRenderingContext2D = gfx

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2)

    let width = 0
    let height = 0
    let nodes: Node[] = []
    let raf = 0
    let running = true
    let t = 0

    function spawn(count: number) {
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 1.1 + Math.random() * 1.4,
        hue: Math.random() > 0.55 ? 0 : 1,
      }))
    }

    function resize() {
      const box = host.getBoundingClientRect()
      width = Math.max(1, box.width)
      height = Math.max(1, box.height)
      const scale = dpr()
      surface.width = Math.floor(width * scale)
      surface.height = Math.floor(height * scale)
      surface.style.width = `${width}px`
      surface.style.height = `${height}px`
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      const next = Math.round(Math.min(72, Math.max(36, (width * height) / 16000)))
      if (Math.abs(next - nodes.length) > 8) spawn(next)
    }

    function drawHelix(palette: ReturnType<typeof theme>) {
      const cx = width * 0.72
      const amp = Math.min(54, width * 0.08)
      const top = height * 0.08
      const bottom = height * 0.92
      const steps = 56
      const phase = t * 0.012

      ctx.lineWidth = palette.stroke
      for (let strand = 0; strand < 2; strand++) {
        ctx.beginPath()
        for (let i = 0; i <= steps; i++) {
          const p = i / steps
          const y = top + (bottom - top) * p
          const a = p * Math.PI * 6 + phase + strand * Math.PI
          const x = cx + Math.cos(a) * amp
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = rgba(strand ? palette.violet : palette.mint, palette.helix)
        ctx.stroke()
      }

      for (let i = 0; i <= steps; i += 2) {
        const p = i / steps
        const y = top + (bottom - top) * p
        const a = p * Math.PI * 6 + phase
        const x1 = cx + Math.cos(a) * amp
        const x2 = cx + Math.cos(a + Math.PI) * amp
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(a * 2 + t * 0.04))
        ctx.beginPath()
        ctx.moveTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.strokeStyle = rgba(palette.mint, palette.helix * 0.9 * pulse)
        ctx.lineWidth = palette.stroke * 0.9
        ctx.stroke()
      }
    }

    function frame() {
      if (!running) return
      const palette = theme()
      ctx.clearRect(0, 0, width, height)
      t += 1

      if (!reduce) {
        for (const node of nodes) {
          node.x += node.vx
          node.y += node.vy
          if (node.x < -12) node.x = width + 12
          if (node.x > width + 12) node.x = -12
          if (node.y < -12) node.y = height + 12
          if (node.y > height + 12) node.y = -12
          node.vx += (Math.random() - 0.5) * 0.012
          node.vy += (Math.random() - 0.5) * 0.012
          const speed = Math.hypot(node.vx, node.vy)
          if (speed > 0.42) {
            node.vx *= 0.42 / speed
            node.vy *= 0.42 / speed
          }
        }
      }

      drawHelix(palette)

      const reach = Math.min(150, Math.max(96, Math.hypot(width, height) * 0.09))
      ctx.lineWidth = palette.stroke

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        let links = 0
        for (let j = i + 1; j < nodes.length; j++) {
          if (links > 4) break
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist > reach) continue
          links += 1
          const fade = 1 - dist / reach
          const rgb = a.hue === b.hue ? (a.hue ? palette.violet : palette.mint) : palette.mint
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = rgba(rgb, palette.line * fade)
          ctx.stroke()

          if (!reduce && fade > 0.55 && (i + j + t) % 180 < 16) {
            const u = ((t * 0.012 + i * 0.07) % 1 + 1) % 1
            ctx.beginPath()
            ctx.arc(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 1.35, 0, Math.PI * 2)
            ctx.fillStyle = rgba(palette.mint, 0.7 * fade)
            ctx.fill()
          }
        }
      }

      for (const node of nodes) {
        const rgb = node.hue ? palette.violet : palette.mint
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r * (palette.stroke > 1.2 ? 1.25 : 1), 0, Math.PI * 2)
        ctx.fillStyle = rgba(rgb, palette.node)
        ctx.fill()
      }

      raf = requestAnimationFrame(frame)
    }

    function onVisibility() {
      running = document.visibilityState !== 'hidden'
      if (running) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(frame)
      }
    }

    resize()
    if (nodes.length === 0) spawn(48)
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      aria-hidden
    />
  )
}
