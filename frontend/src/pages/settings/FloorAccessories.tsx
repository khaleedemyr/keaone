import type { FloorObjectKind } from '../../types'

export const ACCESSORY_SIZE: Partial<Record<FloorObjectKind, { w: number; h: number }>> = {
  counter: { w: 208, h: 76 },
  plant: { w: 52, h: 52 },
  pos: { w: 58, h: 50 },
  cashier: { w: 104, h: 122 },
  label: { w: 120, h: 32 },
}

export function defaultAccessoryLabel(kind: FloorObjectKind, areaLabel: string): string | null {
  if (kind === 'counter') return 'Bar'
  if (kind === 'cashier') return 'Kasir'
  if (kind === 'pos') return 'POS'
  if (kind === 'label') return areaLabel
  return null
}

export function AccessoryGlyph({
  kind,
  w,
  h,
  label,
}: {
  kind: FloorObjectKind
  w: number
  h: number
  label?: string | null
}) {
  if (kind === 'counter') return <CounterTop w={w} h={h} label={label} />
  if (kind === 'plant') return <PlantTop w={w} h={h} />
  if (kind === 'pos') return <PosTop w={w} h={h} />
  if (kind === 'cashier') return <CashierTop w={w} h={h} label={label} />
  return null
}

function CounterTop({ w, h, label }: { w: number; h: number; label?: string | null }) {
  return (
    <svg className="floor-acc-svg" width={w} height={h} viewBox="0 0 208 76" preserveAspectRatio="none" aria-hidden>
      <rect x="2" y="4" width="204" height="68" rx="10" fill="#b88958" stroke="#6d4424" strokeWidth="2.4" />
      <rect x="10" y="12" width="188" height="36" rx="7" fill="#8a5a32" />
      <rect x="16" y="16" width="176" height="12" rx="4" fill="#c9a06a" opacity="0.35" />
      <circle cx="36" cy="48" r="5" fill="#ead2a8" opacity="0.85" />
      <circle cx="56" cy="48" r="5" fill="#ead2a8" opacity="0.7" />
      <circle cx="172" cy="48" r="5" fill="#d7e8ef" opacity="0.8" />
      <text x="104" y="66" textAnchor="middle" fill="#3b2412" fontSize="11" fontWeight="700" style={{ fontFamily: 'Outfit, sans-serif' }}>
        {label || 'Bar'}
      </text>
    </svg>
  )
}

function PlantTop({ w, h }: { w: number; h: number }) {
  return (
    <svg className="floor-acc-svg" width={w} height={h} viewBox="0 0 52 52" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <ellipse cx="26" cy="30" rx="15" ry="15" fill="#2f7a4a" />
      <ellipse cx="16" cy="24" rx="10" ry="11" fill="#3c9a5c" transform="rotate(-28 16 24)" />
      <ellipse cx="36" cy="23" rx="10" ry="11" fill="#348a52" transform="rotate(26 36 23)" />
      <ellipse cx="26" cy="16" rx="8" ry="10" fill="#4caf68" />
      <ellipse cx="21" cy="22" rx="6" ry="7" fill="#67c57d" transform="rotate(-18 21 22)" />
      <circle cx="26" cy="38" r="9" fill="#c46a3a" stroke="#8a3f1f" strokeWidth="1.6" />
      <circle cx="26" cy="38" r="5.5" fill="#5c3a24" />
    </svg>
  )
}

function PosTop({ w, h }: { w: number; h: number }) {
  return (
    <svg className="floor-acc-svg" width={w} height={h} viewBox="0 0 58 50" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="6" y="18" width="46" height="26" rx="5" fill="#2a3340" stroke="#121820" strokeWidth="1.6" />
      <rect x="12" y="6" width="34" height="20" rx="3" fill="#1c2430" stroke="#121820" strokeWidth="1.4" />
      <rect x="15" y="9" width="28" height="14" rx="2" fill="#3ee8c5" opacity="0.85" />
      <rect x="17" y="12" width="12" height="2" rx="1" fill="#0b3d34" opacity="0.35" />
      <rect x="17" y="16" width="18" height="2" rx="1" fill="#0b3d34" opacity="0.28" />
      <circle cx="18" cy="36" r="2.1" fill="#8b97ad" />
      <circle cx="26" cy="36" r="2.1" fill="#8b97ad" />
      <circle cx="34" cy="36" r="2.1" fill="#8b97ad" />
      <rect x="40" y="33" width="7" height="6" rx="1.2" fill="#e7c07a" />
    </svg>
  )
}

function CashierTop({ w, h, label }: { w: number; h: number; label?: string | null }) {
  return (
    <svg className="floor-acc-svg" width={w} height={h} viewBox="0 0 104 122" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="8" y="8" width="88" height="58" rx="9" fill="#c8a36d" stroke="#7a4e28" strokeWidth="2.2" />
      <rect x="14" y="14" width="76" height="18" rx="4" fill="#ead2a8" opacity="0.45" />
      <rect x="18" y="16" width="28" height="16" rx="2.5" fill="#1c2430" />
      <rect x="21" y="18.5" width="22" height="11" rx="1.5" fill="#3ee8c5" opacity="0.8" />
      <rect x="52" y="18" width="22" height="14" rx="3" fill="#2a3340" />
      <circle cx="58" cy="25" r="1.6" fill="#8b97ad" />
      <circle cx="64" cy="25" r="1.6" fill="#8b97ad" />
      <circle cx="70" cy="25" r="1.6" fill="#8b97ad" />
      <text x="52" y="54" textAnchor="middle" fill="#3b2412" fontSize="11" fontWeight="700" style={{ fontFamily: 'Outfit, sans-serif' }}>
        {label || 'Kasir'}
      </text>
      <rect x="34" y="78" width="36" height="12" rx="5" fill="#3f4a58" stroke="#1c242e" strokeWidth="1.2" />
      <rect x="36" y="92" width="32" height="24" rx="7" fill="#6e7a8a" stroke="#1c242e" strokeWidth="1.2" />
      <rect x="40" y="96" width="24" height="16" rx="5" fill="#98a3b3" />
    </svg>
  )
}
