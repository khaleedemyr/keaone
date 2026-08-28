import type { TableShape } from '../../types'

export type ChairPose = { x: number; y: number; rot: number; size: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function chairLayout(seats: number, w: number, h: number, shape: TableShape): ChairPose[] {
  const size = clamp(Math.round(Math.min(w, h) * 0.34), 20, 30)
  const gap = 4

  if (shape === 'round') {
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) / 2 + gap + size / 2
    const start = seats === 2 ? 0 : -Math.PI / 2
    return Array.from({ length: seats }, (_, i) => {
      const a = start + (Math.PI * 2 * i) / seats
      return {
        x: cx + Math.cos(a) * radius - size / 2,
        y: cy + Math.sin(a) * radius - size / 2,
        rot: (a * 180) / Math.PI + 90,
        size,
      }
    })
  }

  const counts = [0, 0, 0, 0]
  const long = w >= h ? [0, 2] : [1, 3]
  const short = w >= h ? [1, 3] : [0, 2]
  const order = seats <= 2 ? long : [long[0], long[1], short[0], short[1]]
  for (let i = 0; i < seats; i += 1) counts[order[i % order.length]] += 1

  const out: ChairPose[] = []
  counts.forEach((count, side) => {
    for (let i = 0; i < count; i += 1) {
      const t = (i + 1) / (count + 1)
      if (side === 0) out.push({ x: w * t - size / 2, y: -size - gap, rot: 0, size })
      if (side === 1) out.push({ x: w + gap, y: h * t - size / 2, rot: 90, size })
      if (side === 2) out.push({ x: w * t - size / 2, y: h + gap, rot: 180, size })
      if (side === 3) out.push({ x: -size - gap, y: h * t - size / 2, rot: 270, size })
    }
  })
  return out
}

export function TableTop({
  shape,
  w,
  h,
  name,
  patternId,
}: {
  shape: TableShape
  w: number
  h: number
  name: string
  patternId: string
}) {
  const rx = shape === 'round' ? Math.min(w, h) / 2 : Math.min(16, Math.min(w, h) / 5)
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2 - 1.2

  return (
    <svg className="floor-table-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="7" height="40">
          <rect width="7" height="40" fill="#c8a36d" />
          <rect x="0" width="2.2" height="40" fill="#ddb883" opacity="0.45" />
          <rect x="4" width="1" height="40" fill="#9a6b3e" opacity="0.28" />
        </pattern>
        <filter id={`${patternId}-sh`} x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.1" floodColor="#000" floodOpacity="0.38" />
        </filter>
      </defs>
      {shape === 'round' ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill={`url(#${patternId})`} filter={`url(#${patternId}-sh)`} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#7a4e28" strokeWidth="3.2" />
          <circle cx={cx} cy={cy} r={Math.max(8, r - 4)} fill="none" stroke="#ead2a8" strokeWidth="1.15" opacity="0.5" />
        </>
      ) : (
        <>
          <rect x="1.2" y="1.2" width={w - 2.4} height={h - 2.4} rx={rx} fill={`url(#${patternId})`} filter={`url(#${patternId}-sh)`} />
          <rect x="1.2" y="1.2" width={w - 2.4} height={h - 2.4} rx={rx} fill="none" stroke="#7a4e28" strokeWidth="3.2" />
          <rect
            x="5"
            y="5"
            width={w - 10}
            height={h - 10}
            rx={Math.max(6, rx - 4)}
            fill="none"
            stroke="#ead2a8"
            strokeWidth="1.1"
            opacity="0.42"
          />
        </>
      )}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#3b2412"
        fontSize={Math.max(9, Math.min(12, Math.min(w, h) / 7.5))}
        fontWeight="700"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {name}
      </text>
    </svg>
  )
}

export function ChairTop() {
  return (
    <svg className="floor-chair-svg" viewBox="0 0 40 40" aria-hidden>
      <rect x="6.5" y="1.5" width="27" height="12" rx="6" fill="#3f4a58" stroke="#1c242e" strokeWidth="1.3" />
      <rect x="10" y="4" width="20" height="7" rx="3.5" fill="#6a7686" />
      <rect x="8" y="15" width="24" height="23" rx="7" fill="#6e7a8a" stroke="#1c242e" strokeWidth="1.3" />
      <rect x="11.5" y="18.5" width="17" height="16" rx="5" fill="#98a3b3" />
      <rect x="4" y="16" width="5.5" height="15" rx="2.6" fill="#3f4a58" stroke="#1c242e" strokeWidth="1.1" />
      <rect x="30.5" y="16" width="5.5" height="15" rx="2.6" fill="#3f4a58" stroke="#1c242e" strokeWidth="1.1" />
    </svg>
  )
}
