/** Real product screenshots for marketing (captured from the live app). */
export function ProductShot({
  src,
  alt = '',
  className = '',
}: {
  src: string
  alt?: string
  className?: string
}) {
  return (
    <figure className={`mkt-shot ${className}`.trim()}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </figure>
  )
}
