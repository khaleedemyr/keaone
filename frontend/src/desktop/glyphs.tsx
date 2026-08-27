import type { AppId } from './DesktopContext'

export function AppGlyph({ id, className = 'h-7 w-7' }: { id: AppId; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    className,
  }

  if (id === 'insight') {
    return (
      <svg {...common}>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    )
  }
  if (id === 'pos') {
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </svg>
    )
  }
  if (id === 'master') {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h10" />
        <circle cx="18" cy="17" r="2" />
      </svg>
    )
  }
  if (id === 'sales') {
    return (
      <svg {...common}>
        <path d="M4 16 9 11l4 4 7-8" />
        <path d="M4 20h16" />
      </svg>
    )
  }
  if (id === 'purchase') {
    return (
      <svg {...common}>
        <path d="M4 7h16v12H4z" />
        <path d="M8 7V5h8v2M8 12h8M8 16h5" />
      </svg>
    )
  }
  if (id === 'admin') {
    return (
      <svg {...common}>
        <path d="M12 3 5 7v6c0 5 3.5 7.5 7 9 3.5-1.5 7-4 7-9V7l-7-4Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    )
  }
  if (id === 'overview') {
    return (
      <svg {...common}>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    )
  }
  if (id === 'tenants') {
    return (
      <svg {...common}>
        <path d="M4 20V8l6-4 6 4v12" />
        <path d="M10 20v-6h4v6M20 20V11" />
      </svg>
    )
  }
  if (id === 'billing') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    )
  }
  if (id === 'blog') {
    return (
      <svg {...common}>
        <path d="M5 4h11a2 2 0 0 1 2 2v14l-3.5-2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="M7 9h8M7 13h6" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4" />
    </svg>
  )
}

export const APP_TILE: Record<AppId, string> = {
  insight: 'from-cyan-300 to-violet',
  pos: 'from-mint to-teal-400',
  master: 'from-violet to-indigo-400',
  sales: 'from-gold to-amber-400',
  purchase: 'from-emerald-300 to-teal-500',
  admin: 'from-rose-400 to-orange-400',
  settings: 'from-slate-300 to-slate-500',
  overview: 'from-cyan-300 to-violet',
  tenants: 'from-gold to-orange-400',
  billing: 'from-mint to-emerald-400',
  blog: 'from-cyan-300 to-mint',
}
