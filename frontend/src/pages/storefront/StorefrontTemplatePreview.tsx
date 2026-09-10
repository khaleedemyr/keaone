import type { CSSProperties } from 'react'

type PreviewProps = {
  templateKey: string
  title: string
  tagline: string
  primary?: string
  accent?: string
}

function Swatch({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={className} style={style} />
}

/** Mini wireframe preview for storefront templates (admin picker). */
export function StorefrontTemplatePreview({ templateKey, title, tagline, primary = '#0f766e', accent = '#f59e0b' }: PreviewProps) {
  const brand = title.trim() || 'Brand'
  const line = tagline.trim() || 'Tagline singkat usaha Anda'

  if (templateKey === 'landing_ellipse') {
    const ink = primary || '#272727'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-[#272727] shadow-sm">
        <div className="flex min-h-[120px]">
          <div className="flex w-[52px] shrink-0 flex-col border-r border-black/5 bg-white px-1.5 py-2">
            <div className="mb-2 text-[7px] font-extrabold" style={{ color: ink }}>
              {brand.slice(0, 6)}
            </div>
            <div className="mt-auto space-y-1">
              {['About', 'Award', 'Gall', 'Svc'].map((label, i) => (
                <div key={label} className="flex items-center gap-0.5">
                  <Swatch className="h-px w-2" style={{ background: ink }} />
                  <span className="text-[5px]" style={{ color: i === 0 ? ink : '#8a8a8a' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative px-2 py-3" style={{ background: `linear-gradient(120deg, ${ink}0d, #fff)` }}>
              <div className="text-[12px] leading-[1.05]" style={{ color: ink }}>
                Hello.
                <br />I call me
                <br />
                {brand.slice(0, 8)}
              </div>
            </div>
            <div className="flex items-end gap-1 px-2 py-1.5">
              {[0, 1, 2].map((i) => (
                <Swatch
                  key={i}
                  className="flex-1"
                  style={{
                    height: 28 + i * 8,
                    borderRadius: 999,
                    background: i % 2 ? accent + '55' : ink + '28',
                  }}
                />
              ))}
              <div className="ml-1 flex-1 space-y-0.5">
                <div className="h-1 w-full rounded bg-slate-200" />
                <div className="h-1 w-3/4 rounded bg-slate-200" />
                <Swatch className="mt-1 h-2 w-10" style={{ background: ink }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (templateKey === 'landing_structura') {
    const ink = primary || '#272727'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-[#272727] shadow-sm">
        <div className="flex min-h-[118px]">
          {/* Left vertical side menu */}
          <div className="flex w-14 shrink-0 flex-col justify-center gap-1.5 border-r border-black/5 bg-[#fafafa] px-1.5 py-2">
            {['Home', 'Svc', 'Skill', 'Team', 'Port', 'Cnt'].map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <Swatch className="h-[2px]" style={{ width: i === 0 ? 10 : 5, background: ink }} />
                <span className="text-[5px] font-semibold" style={{ color: i === 0 ? ink : '#8a8a8a' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative px-2 py-2.5" style={{ background: `linear-gradient(135deg, ${ink}08, #fff)` }}>
              <div className="text-[11px] font-normal leading-[1.05]" style={{ fontFamily: 'Georgia, serif', color: ink }}>
                Do things
                <br />
                that matter
              </div>
              <div className="mt-1 max-w-[85%] text-[5px] leading-tight text-[#8a8a8a]">{line.slice(0, 48)}</div>
              <Swatch className="mt-1.5 h-3 w-14 border" style={{ borderColor: ink }} />
            </div>
            <div className="flex gap-1 px-2 py-1">
              {[0, 1, 2].map((i) => (
                <Swatch
                  key={i}
                  className="aspect-square flex-1"
                  style={{ background: i % 2 ? accent + '44' : ink + '22', boxShadow: `2px 2px 0 ${ink}` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1 border-t px-2 py-1.5">
              <div className="col-span-1" />
              <Swatch className="col-span-1 aspect-square border bg-white" style={{ borderColor: ink + '22' }} />
              <Swatch className="col-span-1 h-3 self-end" style={{ background: ink }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (templateKey === 'landing_medidove') {
    const pink = primary || '#e12454'
    const dark = '#223645'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-[#223645] shadow-sm">
        <div className="flex items-center justify-between border-b px-2 py-1 text-[6px] text-slate-500">
          <span>+1 800…</span>
          <span style={{ color: pink }}>Appointment</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] font-extrabold" style={{ color: dark }}>
            {brand.slice(0, 8)}
            <span style={{ color: pink }}>.</span>
          </span>
          <Swatch className="h-4 w-14 rounded-sm" style={{ background: pink }} />
        </div>
        <div className="relative h-16 overflow-hidden" style={{ background: dark }}>
          <Swatch className="absolute inset-0 opacity-40" style={{ background: `linear-gradient(120deg, ${pink}55, ${dark})` }} />
          <div className="relative z-10 flex h-full flex-col justify-center px-2 text-white">
            <div className="text-[6px]" style={{ color: pink }}>
              We are here for your care
            </div>
            <div className="mt-0.5 max-w-[90%] text-[9px] font-bold leading-tight">{line}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-[#f4f9ff] p-1.5">
          {[0, 1, 2].map((i) => (
            <Swatch key={i} className="aspect-[5/3]" style={{ background: i % 2 ? '#e8eef5' : '#dbeafe' }} />
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'landing_oneex') {
    return (
      <div className="overflow-hidden rounded-xl border bg-black text-[10px] text-white shadow-sm">
        <div className="relative h-[118px] overflow-hidden">
          <Swatch className="absolute inset-0 opacity-70" style={{ background: 'linear-gradient(135deg,#1a1a1a,#333)' }} />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-2 text-center">
            <div className="text-[5px] uppercase tracking-[0.25em] text-white/80">Ex Nihilo&apos;s</div>
            <div className="mt-1 text-[16px] font-bold uppercase leading-none tracking-tight">{brand.slice(0, 8) || 'Oneex'}</div>
            <div className="mt-2 flex items-center gap-1.5 text-[5px] uppercase tracking-[0.2em] text-white/85">
              <span className="h-px w-3 bg-white/70" />
              Live demos
              <span className="h-px w-3 bg-white/70" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (templateKey === 'landing_prompt') {
    const blue = primary || '#335EEA'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] shadow-sm">
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <span className="text-[11px] font-extrabold" style={{ color: blue }}>
            {brand.slice(0, 8)}
          </span>
          <Swatch className="h-4 w-10 rounded-md" style={{ background: blue }} />
        </div>
        <div className="relative h-[72px] overflow-hidden" style={{ background: `linear-gradient(135deg, ${blue}22, #f8fafc 50%, #0EA5E922)` }}>
          <div className="relative z-10 flex h-full flex-col justify-center px-2">
            <div className="text-[5px] font-semibold uppercase tracking-wider" style={{ color: blue }}>
              SaaS Platform
            </div>
            <div className="mt-0.5 max-w-[85%] text-[9px] font-bold leading-tight text-slate-900">{line}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5">
          {[0, 1, 2].map((i) => (
            <Swatch key={i} className="aspect-[5/3] rounded-sm" style={{ background: i === 1 ? `${blue}33` : '#e2e8f0' }} />
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'landing_canun') {
    const gold = primary || '#C9A227'
    const navy = accent || '#1B2336'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] shadow-sm">
        <div className="flex items-center justify-between px-2 py-1 text-[5px] text-white" style={{ background: navy }}>
          <span className="opacity-80">Call 24/7</span>
          <span style={{ color: gold }}>Consult</span>
        </div>
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <span className="text-[11px] font-bold" style={{ color: navy, fontFamily: 'Georgia, serif' }}>
            {brand.slice(0, 8)}
            <span style={{ color: gold }}>.</span>
          </span>
          <Swatch className="h-4 w-12" style={{ background: gold }} />
        </div>
        <div className="relative h-[70px] overflow-hidden" style={{ background: navy }}>
          <div className="absolute inset-0 opacity-40" style={{ background: `linear-gradient(90deg, ${navy}, transparent)` }} />
          <div className="relative z-10 flex h-full flex-col justify-center px-2 text-white">
            <div className="text-[5px] font-semibold uppercase tracking-[0.18em]" style={{ color: gold }}>
              We Fight For Justice
            </div>
            <div className="mt-0.5 max-w-[90%] text-[9px] font-semibold leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
              {line}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 bg-[#F5F3EE] p-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Swatch key={i} className="aspect-[4/3]" style={{ background: i === 0 ? `${gold}55` : '#e8e4dc' }} />
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_nexora') {
    const blue = primary || '#2158f5'
    const gold = accent || '#f5c518'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-slate-700 shadow-sm">
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-white" style={{ background: blue }}>
          <span className="font-extrabold tracking-wide uppercase">{brand.slice(0, 10)}</span>
          <div className="h-3.5 flex-1 rounded bg-white/95" />
          <Swatch className="h-3 w-3 rounded-full" style={{ background: gold }} />
        </div>
        <div className="flex gap-2 border-b px-2 py-1 text-[8px] text-slate-500">
          <span className="font-semibold text-slate-800">Categories</span>
          <span>Home</span>
          <span>Shop</span>
          <span className="ml-auto">Top Deals</span>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-[#eef1f4] p-2">
          <div className="space-y-1 py-2">
            <div className="text-[7px] uppercase tracking-wider text-slate-400">Home tech</div>
            <div className="text-[10px] font-bold leading-tight text-slate-900">{line}</div>
            <Swatch className="mt-1 h-4 w-14 rounded" style={{ background: blue }} />
          </div>
          <Swatch className="aspect-[5/4] rounded bg-white" style={{ background: blue + '22' }} />
        </div>
        <div className="grid grid-cols-4 gap-1 p-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden border bg-white p-0.5">
              <Swatch className="aspect-square" style={{ background: i % 2 ? gold + '33' : '#e2e8f0' }} />
              <div className="mt-0.5 h-1 w-full rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_editorial') {
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-neutral-800 shadow-sm">
        <div className="relative h-20 overflow-hidden bg-neutral-700 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-600 to-neutral-800" />
          <div className="absolute inset-x-0 top-0 flex justify-between px-2 py-1 text-[7px] text-white/80">
            <span>{brand}</span>
            <span>Cart 0</span>
          </div>
          <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold">{brand}</div>
          <div className="absolute inset-x-0 bottom-1 flex justify-between px-2 text-[6px] text-white/70">
            <span>New</span>
            <span>FW</span>
          </div>
        </div>
        <div className="grid grid-cols-2">
          <Swatch className="aspect-[4/5] bg-[#c8b8a8]" />
          <Swatch className="aspect-[4/5] bg-[#8a8580]" />
        </div>
        <div className="grid grid-cols-4 gap-0.5 p-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Swatch key={i} className="aspect-[3/4]" style={{ background: i % 2 ? '#d7d0c8' : '#ebe6e0' }} />
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_hypermarket') {
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-slate-700 shadow-sm">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-2 py-2">
          <span className="text-[9px] tracking-wide text-slate-700">[ H / M ]</span>
          <div className="hidden justify-center gap-2 text-[7px] uppercase tracking-wider text-slate-400 sm:flex">
            <span style={{ color: primary || '#6ba8c4' }}>Home</span>
            <span>Shop</span>
            <span>Pages</span>
          </div>
          <div className="flex justify-end gap-1.5 text-slate-400">
            <span>○</span>
            <span>□</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white p-1.5">
          {[
            ['Kitchen', '#f0e6d8'],
            ['Books', '#ececec'],
            ['Office', '#e8dcc8'],
            ['Play', '#ebe4da'],
          ].map(([label, tone]) => (
            <div key={label} className="relative min-h-[44px] overflow-hidden bg-[#f6f6f6] p-1.5">
              <div className="text-[8px] font-light text-slate-700">{label}</div>
              <div className="text-[6px] text-slate-400">from …</div>
              <Swatch className="absolute bottom-1 right-1 h-7 w-8 rounded-sm" style={{ background: tone }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_capsule') {
    return (
      <div className="overflow-hidden rounded-xl border bg-[#f4f4f4] text-[10px] text-neutral-800 shadow-sm">
        <div className="relative h-20 bg-neutral-900 text-white">
          <div className="flex items-center justify-between px-2 py-1.5 text-[7px] text-white/90">
            <span className="font-semibold tracking-wide uppercase">{brand}</span>
            <div className="flex gap-2">
              <span>Shop</span>
              <span>0</span>
            </div>
          </div>
          <div className="absolute inset-x-2 bottom-2">
            <div className="text-[8px] font-medium uppercase leading-tight">Minimal by Design, Strong by Nature</div>
            <div className="mt-1 flex gap-1">
              <span className="bg-white px-1 py-0.5 text-[5px] font-bold uppercase text-black">Shop</span>
              <span className="border border-white px-1 py-0.5 text-[5px] font-bold uppercase">View</span>
            </div>
          </div>
        </div>
        <div className="flex gap-[1px] p-0">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Swatch key={i} className="aspect-[3/4] flex-1" style={{ background: i % 2 ? '#e8e4de' : '#ececec' }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-[1px] pt-[1px]">
          {['Tops', 'Bottoms', 'Acc'].map((label) => (
            <div key={label} className="relative aspect-[4/5] bg-neutral-700">
              <span className="absolute bottom-1 left-1 text-[6px] text-white">{label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_sophia') {
    const peach = primary || '#954e26'
    const deep = '#f7daca'
    return (
      <div className="overflow-hidden rounded-xl border bg-[#fdf6f2] text-[10px] text-[#0d0d0d] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#EEDCD0] px-2 py-1.5">
          <span className="text-[11px] font-semibold" style={{ color: peach }}>
            {brand}
          </span>
          <div className="flex gap-1.5 text-[7px] text-[#686868]">
            <span>Shop</span>
            <span className="rounded-full px-1.5 py-0.5 text-white" style={{ background: accent || '#da5d04' }}>
              Book
            </span>
          </div>
        </div>
        <div className="px-2 pt-3 text-center" style={{ background: deep }}>
          <div className="text-[6px] uppercase tracking-wide text-[#010101]/70">★★★★★ ratings</div>
          <div className="mx-auto mt-1 max-w-[90%] text-[9px] font-bold leading-tight">{line}</div>
          <div className="mt-1.5 flex justify-center gap-1">
            <span className="rounded-full border px-2 py-0.5 text-[5px]" style={{ borderColor: peach }}>
              Consult
            </span>
            <span className="text-[5px] underline">Book</span>
          </div>
          <div className="relative mx-auto mt-2 w-[70%]">
            <Swatch
              className="aspect-[2/1] w-full"
              style={{
                background: `linear-gradient(160deg, ${accent || '#f8caaf'}, ${peach})`,
                borderTopLeftRadius: 999,
                borderTopRightRadius: 999,
              }}
            />
            <Swatch className="absolute -left-1 top-0 h-4 w-4 rounded-full" style={{ background: peach + '99' }} />
            <Swatch className="absolute -right-0.5 -top-1 h-3.5 w-3.5 rounded-full" style={{ background: '#f8caaf' }} />
            <Swatch className="absolute -right-1 bottom-1 h-4 w-4 rounded-full" style={{ background: peach + '77' }} />
          </div>
        </div>
        <div className="flex justify-center gap-2 bg-[#fbede5] px-2 py-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-1 flex-1 rounded bg-white/80" />
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_mizu') {
    const ink = primary || '#232323'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-[#232323] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eee] px-2 py-1.5">
          <div className="flex gap-1.5 text-[6px] text-[#7a7a7a]">
            <span>New</span>
            <span>Women</span>
          </div>
          <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: ink }}>
            {brand.slice(0, 8)}
          </span>
          <div className="flex gap-1.5 text-[6px] text-[#7a7a7a]">
            <span>Login</span>
            <span>0</span>
          </div>
        </div>
        <Swatch className="h-16 w-full" style={{ background: `linear-gradient(135deg, ${ink}33, #bbb)` }} />
        <div className="px-2 py-1.5">
          <div className="text-[8px] font-medium leading-tight">{line}</div>
          <div className="mt-0.5 text-[6px] text-[#7a7a7a]">Designed to inspire</div>
        </div>
        <div className="flex gap-0.5 px-1 pb-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Swatch key={i} className="aspect-[3/4] flex-1" style={{ background: i % 2 ? '#e8e8e8' : '#f3f3f3' }} />
          ))}
        </div>
      </div>
    )
  }

  if (templateKey === 'shop_avalon') {
    const red = primary || '#da3f3f'
    return (
      <div className="overflow-hidden rounded-xl border bg-white text-[10px] text-black shadow-sm">
        <div className="bg-black px-2 py-0.5 text-center text-[5px] text-white">Free Delivery · Don’t miss it</div>
        <div className="flex items-center justify-between border-b border-[#eee] px-2 py-1.5">
          <span className="text-[11px] font-bold lowercase">{brand.slice(0, 8)}</span>
          <div className="flex gap-1.5 text-[6px] text-[#4c4c4c]">
            <span>Shop</span>
            <span>0</span>
          </div>
        </div>
        <div className="relative h-14 overflow-hidden bg-neutral-800">
          <Swatch className="absolute inset-0" style={{ background: `linear-gradient(120deg, #111, ${red}66)` }} />
          <div className="relative z-10 flex h-full flex-col justify-center px-2 text-white">
            <div className="flex items-end gap-1">
              <span className="text-[9px] font-bold leading-none">Winter Sale</span>
              <span className="px-1 text-[6px] font-bold text-white" style={{ background: red }}>
                -40%
              </span>
            </div>
            <div className="mt-1 max-w-[85%] text-[5px] text-white/80">{line}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative">
              <Swatch className="aspect-[3/4] w-full" style={{ background: i % 2 ? '#eee' : '#f5f5f5' }} />
              <span className="absolute left-0.5 top-0.5 px-0.5 text-[4px] text-white" style={{ background: red }}>
                Sale
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // landing_dilabs (default fallback)
  const orange = primary || '#FF5A1F'
  const navy = '#0B0C2A'
  return (
    <div className="overflow-hidden rounded-xl border bg-white text-[10px] shadow-sm">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-[11px] font-extrabold" style={{ color: navy }}>
          {brand.slice(0, 7)}
          <span style={{ color: orange }}>.</span>
        </span>
        <Swatch className="h-4 w-12 rounded-full" style={{ background: orange }} />
      </div>
      <div className="relative h-[72px] overflow-hidden" style={{ background: navy }}>
        <Swatch className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-40" style={{ background: orange }} />
        <div className="relative z-10 flex h-full flex-col justify-center px-2 text-white">
          <div className="text-[5px] uppercase tracking-wider" style={{ color: orange }}>
            Creative agency
          </div>
          <div className="mt-0.5 max-w-[85%] text-[9px] font-bold leading-tight">{line}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 bg-[#F5F3F0] p-1.5">
        {[0, 1, 2].map((i) => (
          <Swatch key={i} className="aspect-[5/3] rounded-sm" style={{ background: i % 2 ? '#e7e2dc' : '#ddd6ce' }} />
        ))}
      </div>
    </div>
  )
}
