/**
 * Sección `marquee` (Figma Marquee 146:7064): franja en movimiento.
 *
 * Variantes:
 *  - `text`:   frases en mayúsculas sobre el color primario, 30 s.
 *  - `photos`: fotos del contenido, 40 s en dirección opuesta.
 *
 * Movimiento solo con CSS (notas 149:7386 y 149:7464): pista duplicada con
 * translateX(-50 %), pausa en hover y en foco, la copia lleva aria-hidden.
 * prefers-reduced-motion: franja estática (texto) o scroll horizontal manual
 * (fotos). Sin JS: no hace falta 'use client'.
 */

import { cn } from '@/lib/utils'
import { cardVisual, items, lines, oneOf, str, type Content } from '@/lib/restaurant/secciones'
import { SiteImage } from './SiteImage'
import { EditorHint } from './EditorHint'
import m from './motion.module.css'

export const CONTENT_KEYS = ['phrases', 'separator', 'images', 'speed', 'label'] as const

type MarqueeVariant = 'text' | 'photos'
const VARIANTS: readonly MarqueeVariant[] = ['text', 'photos']
const SPEEDS = ['slow', 'normal', 'fast'] as const

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

  return (
    <section
      aria-label={label}
      className={cn(m.marqueeViewport, 'py-4 text-white md:py-6')}
      style={{ backgroundColor: 'var(--primary-color)' }}
    >
      {/* Texto completo para lectores de pantalla, una sola vez. */}
      <p className="sr-only">{phrases.join(' · ')}</p>
      <div className={m.marqueeTrack} style={{ '--marquee-duration': duration } as React.CSSProperties} aria-hidden="true">
        {[0, 1].map((n) => (
          <div
            key={n}
            className={cn(
              'flex shrink-0 items-center gap-6 whitespace-nowrap pr-6 text-2xl font-bold uppercase leading-8 [font-family:var(--font-heading)] md:gap-10 md:pr-10 md:text-4xl md:leading-10',
              n === 1 && m.marqueeClone,
            )}
          >
            {copy.map((phrase, i) => (
              <span key={i} className="flex items-center gap-6 md:gap-10">
                <span>{phrase}</span>
                <span>{separator}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

Marquee.CONTENT_KEYS = CONTENT_KEYS
