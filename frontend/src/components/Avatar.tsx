export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const box =
    size === 'lg' ? 'h-20 w-20 text-xl' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-11 w-11 text-sm'
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '?'

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-line`}
      />
    )
  }

  return (
    <div
      className={`${box} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-mint to-violet font-semibold text-ink ring-1 ring-line`}
    >
      {initials}
    </div>
  )
}
