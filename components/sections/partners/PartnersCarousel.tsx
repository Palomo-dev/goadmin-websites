'use client'

import { useCallback, useState } from 'react'
import { atributosCarrusel, indiceAnterior, indiceSiguiente, leerOpcionesCarrusel } from '@/lib/carrusel/opcionesCarrusel'
import { useAutoplayCarrusel, useDeslizar } from '@/lib/carrusel/useCarrusel'
import { FlechaCarrusel, PuntosCarrusel } from '@/components/site/carrusel/ControlesCarrusel'

interface PartnersCarouselProps {
  content: Record<string, any>
  primaryColor?: string
}

/** Logos a la vista a la vez. */
const VISIBLES = 5

/**
 * Lo que hacía «Aliados · Carrusel» antes de leer los interruptores: con más de 4 logos avanzaba
 * solo cada 3 s, daba la vuelta, sin pausa, sin flechas, sin puntos y sin deslizar.
 */
const HOY = { autoplay: true, intervaloMs: 3000, bucle: true, pausarAlPasar: false, flechas: false, puntos: false, deslizar: false }

export function PartnersCarousel({ content, primaryColor = '#3B82F6' }: PartnersCarouselProps) {
  const title = content.title || 'Nuestros Aliados'
  const items = content.items || []
  const [offset, setOffset] = useState(0)
  const o = leerOpcionesCarrusel(content, HOY)
  // Con bucle, cada logo es una posición (como siempre); sin bucle, hasta que el último queda a la vista.
  const posiciones = items.length > 4 ? (o.bucle ? items.length : Math.max(1, items.length - (VISIBLES - 1))) : 1
  const movible = posiciones > 1

  const irSiguiente = useCallback(() => {
    const n = indiceSiguiente(offset, posiciones, o.bucle)
    if (n === null) return false
    setOffset(n)
    return true
  }, [offset, posiciones, o.bucle])
  const irAnterior = useCallback(() => {
    const n = indiceAnterior(offset, posiciones, o.bucle)
    if (n !== null) setOffset(n)
  }, [offset, posiciones, o.bucle])

  const autoplay = useAutoplayCarrusel({ activo: o.autoplay && movible, intervaloMs: o.intervaloMs, pausarAlPasar: o.pausarAlPasar, avanzar: irSiguiente })
  const deslizar = useDeslizar({ activo: o.deslizar && movible, alSiguiente: irSiguiente, alAnterior: irAnterior })
  const flechas = o.flechas && movible

  const logos = (
    <div className={`flex gap-8 items-center justify-center overflow-hidden${flechas ? ' flex-1 min-w-0' : ''}${o.deslizar ? ' touch-pan-y' : ''}`} {...deslizar}>
      {items.slice(offset, offset + VISIBLES).map((item: any, i: number) => (
        <div key={i} className="flex-shrink-0">
          {item.logo_url ? (
            <img src={item.logo_url} alt={item.name} className="h-12 object-contain grayscale hover:grayscale-0 transition-all" />
          ) : (
            <span className="text-gray-400 font-medium">{item.name}</span>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <section className="py-12 px-4" aria-roledescription="carrusel" {...atributosCarrusel(o)} {...autoplay}>
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        {flechas ? (
          <div className="flex items-center gap-4">
            <FlechaCarrusel direccion="anterior" etiqueta="Aliados anteriores" onClick={irAnterior} disabled={indiceAnterior(offset, posiciones, o.bucle) === null} color={primaryColor} className="flex-shrink-0" />
            {logos}
            <FlechaCarrusel direccion="siguiente" etiqueta="Más aliados" onClick={irSiguiente} disabled={indiceSiguiente(offset, posiciones, o.bucle) === null} color={primaryColor} className="flex-shrink-0" />
          </div>
        ) : (
          logos
        )}
        {o.puntos && movible && (
          <PuntosCarrusel total={posiciones} actual={offset} onSelect={setOffset} color={primaryColor} etiqueta={(i) => `Ir a la posición ${i + 1} de ${posiciones}`} className="mt-6" />
        )}
      </div>
    </section>
  )
}
