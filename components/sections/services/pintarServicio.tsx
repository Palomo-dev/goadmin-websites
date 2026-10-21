import { DynamicLucideIcon } from '@/components/sections/products/DynamicLucideIcon'

/** Nombre PascalCase de Lucide, o un emoji / texto corto guardado a mano. */
export function IconoServicio({ name, className }: { name?: string | null; className?: string }) {
  const limpio = (name ?? '').trim()
  if (!limpio) return null
  const esLucide = /^[A-Z][A-Za-z0-9]+$/.test(limpio)
  if (esLucide) return <DynamicLucideIcon name={limpio} className={className ?? 'h-6 w-6'} fallback="Sparkles" />
  return <span className={className}>{limpio}</span>
}

export function srcFotoServicio(url: string | null | undefined): string | null {
  const src = urlSegura(url)
  if (!src || !(src.startsWith('/') || /^https?:/i.test(src))) return null
  return src
}

function urlSegura(url: string | null | undefined): string | null {
  const href = (url ?? '').trim()
  if (!href || href.startsWith('//') || /^javascript:/i.test(href)) return null
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?') || /^(https?:|mailto:|tel:)/i.test(href)) return href
  return null
}

export function FotoServicio({ url, alt, compact = false }: { url?: string | null; alt: string; compact?: boolean }) {
  const src = srcFotoServicio(url)
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      className={compact ? 'h-16 w-16 flex-shrink-0 rounded-lg object-cover' : 'mb-3 h-32 w-full rounded-lg object-cover'}
      loading="lazy"
    />
  )
}

export function EnlaceServicio({ texto, url, color }: { texto?: string | null; url?: string | null; color: string }) {
  const href = urlSegura(url)
  const etiqueta = (texto ?? '').trim()
  if (!href || !etiqueta) return null
  const externo = /^https?:/i.test(href)
  return (
    <a
      href={href}
      className="mt-3 inline-block text-sm font-semibold"
      style={{ color }}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {etiqueta}
    </a>
  )
}
