'use client'

import { useCallback, useState } from 'react'
import { atributosCarrusel, indiceAnterior, indiceSiguiente, leerOpcionesCarrusel } from '@/lib/carrusel/opcionesCarrusel'
import { useAutoplayCarrusel, useDeslizar } from '@/lib/carrusel/useCarrusel'
import { FlechaCarrusel } from '@/components/site/carrusel/ControlesCarrusel'

/** Claves de content que este componente lee (F0.6 — manifiesto editor ↔ sitio). */
export const CONTENT_KEYS = ['title', 'images', 'autoplay', 'interval_ms', 'loop', 'pause_on_hover', 'show_arrows', 'show_dots', 'enable_swipe'] as const

interface GalleryFullscreenProps {
  content: Record<string, any>
  primaryColor?: string
}

/**
 * Lo que hacía la galería «Pantalla completa» antes de leer los interruptores: foto grande y tira
 * de miniaturas para elegir (su paginación), sin flechas, sin avance automático ni deslizar.
 */
const HOY = { autoplay: false, intervaloMs: 5000, bucle: true, pausarAlPasar: true, flechas: false, puntos: true, deslizar: false }

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

export function GalleryFullscreen({ content, primaryColor = '#3B82F6' }: GalleryFullscreenProps) {
  const title = content.title
  // F2.2: fallback content.items para secciones guardadas antes de la migración
  const images = content.images ?? content.items ?? []
  const [selected, setSelected] = useState(0)
  const o = leerOpcionesCarrusel(content, HOY)
  const total = images.length

  const irSiguiente = useCallback(() => {
    const n = indiceSiguiente(selected, total, o.bucle)
    if (n === null) return false
    setSelected(n)
    return true
  }, [selected, total, o.bucle])
  const irAnterior = useCallback(() => {
    const n = indiceAnterior(selected, total, o.bucle)
    if (n !== null) setSelected(n)
  }, [selected, total, o.bucle])

  const autoplay = useAutoplayCarrusel({ activo: o.autoplay && total > 1, intervaloMs: o.intervaloMs, pausarAlPasar: o.pausarAlPasar, avanzar: irSiguiente })
  const deslizar = useDeslizar({ activo: o.deslizar && total > 1, alSiguiente: irSiguiente, alAnterior: irAnterior })

  if (images.length === 0) return null

  const conControles = total > 1 && (o.flechas || o.deslizar)

  return (
    <section className="py-16 px-4" aria-roledescription="carrusel" {...atributosCarrusel(o)} {...autoplay}>
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div
          className={`rounded-xl overflow-hidden aspect-[16/9] bg-gray-100 dark:bg-gray-700 mb-4${conControles ? ' relative' : ''}${o.deslizar ? ' touch-pan-y' : ''}`}
          {...deslizar}
        >
          <img src={images[selected]?.url} alt={images[selected]?.alt || ''} className="w-full h-full object-cover" />
          {total > 1 && o.flechas && (
            <>
              <FlechaCarrusel direccion="anterior" etiqueta="Foto anterior" onClick={irAnterior} disabled={indiceAnterior(selected, total, o.bucle) === null} color={primaryColor} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <FlechaCarrusel direccion="siguiente" etiqueta="Foto siguiente" onClick={irSiguiente} disabled={indiceSiguiente(selected, total, o.bucle) === null} color={primaryColor} className="absolute right-3 top-1/2 -translate-y-1/2" />
            </>
          )}
        </div>
        {/* Las miniaturas son la paginación de esta variante: «Mostrar puntos» las muestra u oculta. */}
        {o.puntos && (
          <div className="flex gap-2 overflow-x-auto pb-2" data-carrusel-puntos="">
            {images.map((img: any, i: number) => (
              <button key={i} type="button" aria-label={`Ver foto ${i + 1} de ${total}`} aria-current={i === selected ? 'true' : undefined} onClick={() => setSelected(i)} className={`w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${FOCO}`} style={{ borderColor: i === selected ? primaryColor : 'transparent' }}>
                <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
