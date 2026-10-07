'use client'

/**
 * Flechas y puntos de los carruseles del sitio. Mismas piezas que ya usan los carruseles de
 * productos (`ProductsCarousel`: círculo blanco de 40 px con el chevrón en el color de la marca;
 * puntos en píldora de 8 px, el activo de 24 px en el color de la marca), ahora con nombre
 * accesible, `type="button"` y foco visible.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

export function FlechaCarrusel({
  direccion,
  onClick,
  color,
  disabled,
  etiqueta,
  className = '',
}: {
  direccion: 'anterior' | 'siguiente'
  onClick: () => void
  color?: string
  disabled?: boolean
  /** Nombre accesible; por defecto «Anterior» / «Siguiente». */
  etiqueta?: string
  className?: string
}) {
  const Icono = direccion === 'anterior' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta ?? (direccion === 'anterior' ? 'Anterior' : 'Siguiente')}
      className={`w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed ${FOCO} ${className}`}
      style={{ color }}
    >
      <Icono className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}

export function PuntosCarrusel({
  total,
  actual,
  onSelect,
  color,
  etiqueta = (i) => `Ir a la diapositiva ${i + 1}`,
  className = '',
}: {
  total: number
  actual: number
  onSelect: (i: number) => void
  color?: string
  etiqueta?: (i: number) => string
  className?: string
}) {
  if (total <= 1) return null
  return (
    <div className={`flex justify-center gap-1.5 ${className}`} data-carrusel-puntos="">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={etiqueta(i)}
          aria-current={i === actual ? 'true' : undefined}
          className={`rounded-full transition-all ${FOCO} ${i === actual ? 'w-6 h-2' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'}`}
          style={i === actual ? { backgroundColor: color } : {}}
        />
      ))}
    </div>
  )
}
