/** Shared sold / rating / review meta for product cards across templates. */
export function ProductSocialMeta({
  soldCount = 0,
  avgRating = 0,
  reviewCount = 0,
  className = '',
}: {
  soldCount?: number | null
  avgRating?: number | null
  reviewCount?: number | null
  className?: string
}) {
  const sold = Math.max(0, Number(soldCount) || 0)
  const rating = Math.max(0, Math.min(5, Number(avgRating) || 0))
  const reviews = Math.max(0, Number(reviewCount) || 0)
  const fullStars = Math.round(rating)

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 ${className}`}>
      <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${rating.toFixed(1)} / 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= fullStars && rating > 0 ? 'opacity-100' : 'opacity-25'}>
            ★
          </span>
        ))}
        <span className="ml-0.5 tabular-nums text-slate-600">{rating > 0 ? rating.toFixed(1) : '—'}</span>
      </span>
      <span className="text-slate-300">·</span>
      <span>{reviews} ulasan</span>
      <span className="text-slate-300">·</span>
      <span>{sold} terjual</span>
    </div>
  )
}
