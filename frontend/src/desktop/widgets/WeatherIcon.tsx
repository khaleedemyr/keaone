type WeatherIconProps = {
  kind: string
  className?: string
}

/** Animated weather glyph — pure CSS/SVG, no external assets. */
export function WeatherIcon({ kind, className = '' }: WeatherIconProps) {
  if (kind === 'clear' || kind === 'mainlyClear') {
    return (
      <svg className={`wx-icon wx-sun ${className}`} viewBox="0 0 64 64" aria-hidden>
        <circle className="wx-sun-core" cx="32" cy="32" r="10" />
        <g className="wx-sun-rays">
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="32"
              y1="6"
              x2="32"
              y2="14"
              transform={`rotate(${i * 45} 32 32)`}
            />
          ))}
        </g>
      </svg>
    )
  }

  if (kind === 'partly') {
    return (
      <svg className={`wx-icon wx-partly ${className}`} viewBox="0 0 64 64" aria-hidden>
        <g className="wx-sun-rays wx-sun-small">
          <circle className="wx-sun-core" cx="40" cy="22" r="7" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="40" y1="6" x2="40" y2="11" transform={`rotate(${i * 60} 40 22)`} />
          ))}
        </g>
        <ellipse className="wx-cloud wx-cloud-a" cx="28" cy="38" rx="16" ry="10" />
        <ellipse className="wx-cloud wx-cloud-b" cx="40" cy="40" rx="12" ry="8" />
      </svg>
    )
  }

  if (kind === 'overcast' || kind === 'fog') {
    return (
      <svg className={`wx-icon wx-clouded ${className}`} viewBox="0 0 64 64" aria-hidden>
        <ellipse className="wx-cloud wx-cloud-a" cx="30" cy="34" rx="18" ry="11" />
        <ellipse className="wx-cloud wx-cloud-b" cx="42" cy="36" rx="13" ry="9" />
        {kind === 'fog' ? (
          <g className="wx-fog">
            <line x1="14" y1="48" x2="50" y2="48" />
            <line x1="18" y1="54" x2="46" y2="54" />
          </g>
        ) : null}
      </svg>
    )
  }

  if (kind === 'drizzle' || kind === 'rain' || kind === 'thunder') {
    return (
      <svg className={`wx-icon wx-rainy ${className}`} viewBox="0 0 64 64" aria-hidden>
        <ellipse className="wx-cloud wx-cloud-a" cx="30" cy="26" rx="17" ry="10" />
        <ellipse className="wx-cloud wx-cloud-b" cx="42" cy="28" rx="12" ry="8" />
        <g className="wx-drops">
          <line x1="22" y1="40" x2="18" y2="54" />
          <line x1="32" y1="42" x2="28" y2="56" />
          <line x1="42" y1="40" x2="38" y2="54" />
        </g>
        {kind === 'thunder' ? <path className="wx-bolt" d="M34 34 L28 46 H34 L30 56 L42 40 H35 Z" /> : null}
      </svg>
    )
  }

  if (kind === 'snow') {
    return (
      <svg className={`wx-icon wx-snowy ${className}`} viewBox="0 0 64 64" aria-hidden>
        <ellipse className="wx-cloud wx-cloud-a" cx="30" cy="26" rx="17" ry="10" />
        <ellipse className="wx-cloud wx-cloud-b" cx="42" cy="28" rx="12" ry="8" />
        <g className="wx-flakes">
          <circle cx="22" cy="44" r="2" />
          <circle cx="32" cy="50" r="2.2" />
          <circle cx="42" cy="44" r="1.8" />
        </g>
      </svg>
    )
  }

  return (
    <svg className={`wx-icon wx-partly ${className}`} viewBox="0 0 64 64" aria-hidden>
      <ellipse className="wx-cloud wx-cloud-a" cx="32" cy="34" rx="16" ry="10" />
    </svg>
  )
}
