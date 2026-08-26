import { useId } from 'react'

type LogoProps = {
  className?: string
  glow?: boolean
  variant?: 'mark' | 'wordmark'
}

/** Stem is a "1" (mint flag + bar). Arms make it a K — one vertical, not IK. */
function MarkK1({
  kStroke,
  oneStroke = '#3EE8C5',
  sw = 6.5,
}: {
  kStroke: string
  oneStroke?: string
  sw?: number
}) {
  return (
    <>
      <path
        d="M16.5 22.5 24 15v34"
        stroke={oneStroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <g stroke={kStroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M29.5 32 47 16" />
        <path d="M29.5 32 47 48" />
      </g>
    </>
  )
}

function WordmarkKEA() {
  return (
    <>
      <path
        d="M12 23 20 14v38"
        stroke="#3EE8C5"
        strokeWidth="6.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <g
        stroke="currentColor"
        strokeWidth="6.3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      >
        <path d="M26 32 46 14.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 32 46 49.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M60 14.5v37" />
        <path d="M60 14.5h21" />
        <path d="M60 33h17" />
        <path d="M60 51.5h21" />
        <path d="M96 51.5 110 14.5 124 51.5" />
        <path d="M102.4 36.5h15.2" />
      </g>
    </>
  )
}

export function Logo({ className, glow = false, variant = 'mark' }: LogoProps) {
  const uid = useId().replace(/:/g, '')
  const isWordmark = variant === 'wordmark'

  return (
    <div
      className={`relative shrink-0 ${className ?? (isWordmark ? 'h-14 w-[132px]' : 'h-11 w-11')}`}
    >
      {glow ? (
        <div
          className={
            isWordmark
              ? 'absolute inset-x-3 inset-y-1 rounded-full bg-mint/28 blur-xl'
              : 'absolute inset-0 rounded-[22%] bg-gradient-to-br from-mint to-violet opacity-70 blur-[7px]'
          }
        />
      ) : null}
      {isWordmark ? (
        <svg
          className="relative h-full w-full"
          viewBox="0 0 132 64"
          fill="none"
          role="img"
          aria-label="KEA"
        >
          <WordmarkKEA />
        </svg>
      ) : (
        <svg className="relative h-full w-full" viewBox="0 0 64 64" fill="none" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-k`} x1="20" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4F7FB" />
              <stop offset="1" stopColor="#C5D0E8" />
            </linearGradient>
            <linearGradient id={`${uid}-edge`} x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3EE8C5" stopOpacity=".75" />
              <stop offset="1" stopColor="#8B6CFF" stopOpacity=".55" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="#05070C" />
          <rect x="1" y="1" width="62" height="62" rx="15" stroke={`url(#${uid}-edge)`} strokeWidth="1.25" />
          <MarkK1 kStroke={`url(#${uid}-k)`} />
        </svg>
      )}
    </div>
  )
}

export function BrandLockup({
  size = 'md',
  subtitle,
}: {
  size?: 'sm' | 'md' | 'lg'
  subtitle?: string
}) {
  const logoClass = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const titleClass =
    size === 'lg'
      ? 'font-display text-2xl font-bold leading-none'
      : size === 'sm'
        ? 'font-display text-sm font-bold leading-none'
        : 'font-display text-lg font-bold leading-none'

  return (
    <div className="flex items-center gap-3">
      <Logo className={logoClass} glow={size !== 'sm'} />
      <div>
        <div className={titleClass}>KEA One</div>
        {subtitle ? (
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-mint/80">{subtitle}</div>
        ) : null}
      </div>
    </div>
  )
}
