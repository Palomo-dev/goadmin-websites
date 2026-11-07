'use client'

/**
 * `gallery · carousel` con `stagger: true` (plantilla Marea; PLANO §3): fila deslizable de fotos
 * a alturas alternas, con su pie debajo y flechas que desplazan la fila. La monta GalleryCarousel
 * SOLO con la clave; sin ella, el carrusel de siempre.
 *
 * Las fotos son las mismas de la galería (`images[]` con `url`, `alt`, `caption`).
 */
import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface FotoGaleria {
  url?: string
  alt?: string
  caption?: string
}

/** Desfase vertical y proporción por posición: se repite cada 4 fotos. */
const ESCALONES = [
  'mt-8 aspect-[3/4]',
  'mt-0 aspect-[3/4.4]',
  'mt-12 aspect-[3/3.6]',
  'mt-4 aspect-[3/4.2]',
] as const

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current'

export function GaleriaEscalonada({ title, images }: { title?: string; images: FotoGaleria[] }) {
  const fila = useRef<HTMLUListElement>(null)
  const fotos = images.filter((f) => typeof f?.url === 'string' && f.url)
  if (fotos.length === 0) return null
  const mover = (sentido: 1 | -1) => {
    const el = fila.current
    if (!el) return
    el.scrollBy({ left: sentido * Math.max(240, el.clientWidth * 0.6), behavior: 'smooth' })
  }
  return (
    <div data-galeria="stagger">
      <div className="mb-8 flex items-end justify-between gap-4">
        {title ? <h2 className="text-3xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2> : <span />}
        {fotos.length > 1 && (
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label="Fotos anteriores" onClick={() => mover(-1)} className={`flex h-9 w-9 items-center justify-center rounded-full border border-black/20 dark:border-white/30 ${FOCO}`}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Fotos siguientes" onClick={() => mover(1)} className={`flex h-9 w-9 items-center justify-center rounded-full border border-black/20 dark:border-white/30 ${FOCO}`}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <ul ref={fila} className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 md:gap-4">
        {fotos.map((f, i) => (
          <li key={`${f.url}-${i}`} className="w-[62%] shrink-0 snap-start sm:w-[38%] lg:w-[22%]">
            <div className={`overflow-hidden bg-black/5 ${ESCALONES[i % ESCALONES.length]}`}>
              <img src={f.url} alt={f.alt || ''} className="h-full w-full object-cover" loading="lazy" />
            </div>
            {f.caption && <p className="mt-2 text-sm">{f.caption}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
