/**
 * Sección `marquee` (Figma Marquee 146:7064): franja en movimiento.
 *
 * Variantes:
 *  - `text`:   frases en mayúsculas sobre el color primario, 30 s.
 *  - `photos`: fotos del contenido, 40 s en dirección opuesta.
 *
 * Movimiento solo con CSS (notas 149:7386 y 149:7464): pista duplicada con
 * translateX(-50 %), pausa en hover y en foco, la copia lleva aria-hidden.
 * prefers-reduced-motion (4-nov): la franja de texto sigue corriendo, el doble de lenta y
 * recortada (sin barra de scroll); con `respect_reduced_motion: true` queda quieta, como antes.
 * La de fotos: scroll horizontal manual. Sin JS: no hace falta 'use client'.
 *
 * Texto (4-nov): `size` 'sm' | 'md' | 'lg' (ausente = 'lg', la franja de siempre) y
 * `separator_color` 'secondary' | 'primary' | '#hex' (ausente = el color del texto).
 */

import { cn } from '@/lib/utils'
import { cardVisual, items, lines, oneOf, str, type Content } from '@/lib/restaurant/secciones'
import { SiteImage } from './SiteImage'
import { EditorHint } from './EditorHint'
import m from './motion.module.css'

export const CONTENT_KEYS = ['phrases', 'separator', 'separator_color', 'images', 'speed', 'size', 'label', 'respect_reduced_motion'] as const

type MarqueeVariant = 'text' | 'photos'
const VARIANTS: readonly MarqueeVariant[] = ['text', 'photos']
const SPEEDS = ['slow', 'normal', 'fast'] as const
const SIZES = ['sm', 'md', 'lg'] as const
type MarqueeSize = (typeof SIZES)[number]

/** Clases de la franja de texto por tamaño. `lg` es la de siempre (las tiendas de hoy no cambian). */
const TEXT_SIZE: Record<MarqueeSize, { section: string; track: string; gap: string }> = {
  sm: {
    section: 'py-2',
    track: 'gap-6 pr-6 text-[13px] font-semibold uppercase tracking-[0.12em] [font-family:var(--font-body)] md:text-sm',
    gap: 'gap-6',
  },
  md: {
    section: 'py-3 md:py-4',
    track: 'gap-6 pr-6 text-lg font-bold uppercase leading-7 [font-family:var(--font-heading)] md:gap-8 md:pr-8 md:text-2xl md:leading-8',
    gap: 'gap-6 md:gap-8',
  },
  lg: {
    section: 'py-4 md:py-6',
    track: 'gap-6 pr-6 text-2xl font-bold uppercase leading-8 [font-family:var(--font-heading)] md:gap-10 md:pr-10 md:text-4xl md:leading-10',
    gap: 'gap-6 md:gap-10',
  },
}

/** Color del separador: secundario o primario del sitio, o un hex. Otro valor: el del texto (hoy). */
export function colorSeparador(value: unknown): string | undefined {
  if (value === 'secondary') return 'var(--secondary-color)'
  if (value === 'primary') return 'var(--primary-color)'
  if (typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())) return value.trim()
  return undefined
}

interface MarqueeProps {
  content: Content
  sectionVariant?: string
}

/** Repite la lista hasta un mínimo para que una copia cubra pantallas anchas. */
function fill<T>(list: T[], min: number): T[] {
  if (list.length === 0) return list
  const out: T[] = []
  while (out.length < min) out.push(...list)
  return out
}

export function Marquee({ content, sectionVariant }: MarqueeProps) {
  const variant = oneOf(sectionVariant, VARIANTS, 'text')
  const speed = oneOf(content.speed, SPEEDS, 'normal')
  const factor = speed === 'slow' ? 1.5 : speed === 'fast' ? 0.6 : 1
  const label = str(content.label) ?? (variant === 'text' ? 'Lo que nos define' : 'Fotos del lugar')

  if (variant === 'photos') {
    const photos = items(content.images)
      .map((img) => ({ url: str(img.url), alt: str(img.alt) ?? '' }))
      .filter((p): p is { url: string; alt: string } => p.url !== null)
    if (photos.length === 0) {
      return <EditorHint title="Franja de fotos sin imágenes">Agrega fotos en «Imágenes» para mostrar la franja.</EditorHint>
    }
    const copy = fill(photos, 8)
    const { media } = cardVisual(content)
    const duration = `${Math.round(40 * factor)}s`
    return (
      <section aria-label={label} className={cn(m.marqueeViewport, 'py-4 md:py-6')}>
        <div className={m.marqueeTrack} data-direction="right" style={{ '--marquee-duration': duration } as React.CSSProperties}>
          {[0, 1].map((n) => (
            <ul
              key={n}
              className={cn('flex shrink-0 gap-4 pr-4', n === 1 && m.marqueeClone)}
              aria-hidden={n === 1 ? true : undefined}
            >
              {copy.map((p, i) => (
                <li key={i} className="relative h-[120px] w-[168px] shrink-0 overflow-hidden rounded-xl bg-muted md:h-[200px] md:w-[280px]" style={media}>
                  <SiteImage src={p.url} alt={n === 1 || i >= photos.length ? '' : p.alt} sizes="(min-width: 768px) 280px, 168px" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>
    )
  }

  const phrases = lines(content.phrases)
  if (phrases.length === 0) {
    return <EditorHint title="Franja sin frases">Escribe una frase por línea en «Frases».</EditorHint>
  }
  const separator = str(content.separator) ?? '✦'
  const copy = fill(phrases, 6)
  const duration = `${Math.round(30 * factor)}s`
  const size = TEXT_SIZE[oneOf(content.size, SIZES, 'lg')]
  const sepColor = colorSeparador(content.separator_color)

  return (
    <section
      aria-label={label}
      className={cn(m.marqueeViewport, m.marqueeText, size.section, 'text-white')}
      style={{ backgroundColor: 'var(--primary-color)' }}
      // Solo `true` la detiene con «reducir movimiento»; ausente o false: corre más lenta.
      data-respetar-movimiento={content.respect_reduced_motion === true ? 'true' : undefined}
    >
      {/* Texto completo para lectores de pantalla, una sola vez. */}
      <p className="sr-only">{phrases.join(' · ')}</p>
      <div className={m.marqueeTrack} style={{ '--marquee-duration': duration } as React.CSSProperties} aria-hidden="true">
        {[0, 1].map((n) => (
          <div
            key={n}
            className={cn(
              'flex shrink-0 items-center whitespace-nowrap',
              size.track,
              n === 1 && m.marqueeClone,
            )}
          >
            {copy.map((phrase, i) => (
              <span key={i} className={cn('flex items-center', size.gap)}>
                <span>{phrase}</span>
                <span style={sepColor ? { color: sepColor } : undefined}>{separator}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

Marquee.CONTENT_KEYS = CONTENT_KEYS
