'use client'

import { useCallback, useState } from 'react'
import { atributosCarrusel, indiceAnterior, indiceSiguiente, leerOpcionesCarrusel } from '@/lib/carrusel/opcionesCarrusel'
import { useAutoplayCarrusel, useDeslizar } from '@/lib/carrusel/useCarrusel'

/** Claves de content que este componente lee (F0.6 — manifiesto editor ↔ sitio). */
export const CONTENT_KEYS = ['title', 'images', 'autoplay', 'interval_ms', 'loop', 'pause_on_hover', 'show_arrows', 'show_dots', 'enable_swipe'] as const

interface GalleryCarouselProps {
  content: Record<string, any>
  primaryColor?: string
}

/**
 * Lo que hacía la galería «Carrusel» antes de leer los interruptores: sin avance automático,
 * flechas que dan la vuelta, miniaturas debajo (son su paginación) y sin deslizar con el dedo.
 * Con la clave ausente se mantiene.
 */
const HOY = { autoplay: false, intervaloMs: 5000, bucle: true, pausarAlPasar: true, flechas: true, puntos: true, deslizar: false }

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

export function GalleryCarousel({ content, primaryColor = '#3B82F6' }: GalleryCarouselProps) {
  const title = content.title
  // F2.2: fallback content.items para secciones guardadas antes de la migración
  const images = content.images ?? content.items ?? []
  const [current, setCurrent] = useState(0)
  const o = leerOpcionesCarrusel(content, HOY)
  const total = images.length
  const anterior = indiceAnterior(current, total, o.bucle)
  const siguiente = indiceSiguiente(current, total, o.bucle)

  const irSiguiente = useCallback(() => {
    const n = indiceSiguiente(current, total, o.bucle)
    if (n === null) return false
    setCurrent(n)
    return true
  }, [current, total, o.bucle])
  const irAnterior = useCallback(() => {
    const n = indiceAnterior(current, total, o.bucle)
    if (n !== null) setCurrent(n)
  }, [current, total, o.bucle])

  const autoplay = useAutoplayCarrusel({ activo: o.autoplay && total > 1, intervaloMs: o.intervaloMs, pausarAlPasar: o.pausarAlPasar, avanzar: irSiguiente })
  const deslizar = useDeslizar({ activo: o.deslizar && total > 1, alSiguiente: irSiguiente, alAnterior: irAnterior })

  if (images.length === 0) return null

  return (
    <section className="py-16 px-4" aria-roledescription="carrusel" {...atributosCarrusel(o)} {...autoplay}>
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div
          className={`relative rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-700${o.deslizar ? ' touch-pan-y' : ''}`}
          {...deslizar}
        >
          <img src={images[current]?.url} alt={images[current]?.alt || ''} className="w-full h-full object-cover" />
          {images[current]?.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-3 text-sm">{images[current].caption}</div>
          )}
          {images.length > 1 && o.flechas && (
            <>
              <button type="button" aria-label="Foto anterior" disabled={anterior === null} onClick={irAnterior} className={`absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-40 ${FOCO}`}>‹</button>
              <button type="button" aria-label="Foto siguiente" disabled={siguiente === null} onClick={irSiguiente} className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-40 ${FOCO}`}>›</button>
            </>
          )}
        </div>
        {/* Las miniaturas son la paginación de esta variante: «Mostrar puntos» las muestra u oculta. */}
        {images.length > 1 && o.puntos && (
          <div className="flex gap-2 justify-center mt-4" data-carrusel-puntos="">
            {images.map((_: any, i: number) => (
              <button key={i} type="button" aria-label={`Ver foto ${i + 1} de ${total}`} aria-current={i === current ? 'true' : undefined} onClick={() => setCurrent(i)} className={`w-16 h-12 rounded overflow-hidden border-2 transition-all ${FOCO}`} style={{ borderColor: i === current ? primaryColor : 'transparent' }}>
                <img src={images[i]?.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
