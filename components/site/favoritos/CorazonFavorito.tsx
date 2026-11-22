'use client'

import { useState, type MouseEvent } from 'react'
import { Heart } from 'lucide-react'
import { alternarFavoritoTienda, useFavoritos } from '@/lib/favoritos/almacen'

/** Rojo del corazón marcado (Figma 2762:61083). */
export const ROJO_FAVORITO = '#EF4444'

/**
 * Corazón de favoritos (Figma 2762:61083): vacío; con el mouse encima se tiñe; marcado, relleno
 * rojo con un pulso (`latido-favorito`, sin movimiento si el visitante lo pidió). Tocarlo no abre la
 * ficha (no propaga el clic a la tarjeta).
 */
export function CorazonFavorito({
  productId,
  precio,
  variante = 'flotante',
  className = '',
}: {
  productId: number
  precio?: number | null
  /** `flotante`: círculo blanco sobre la foto · `plano`: solo el corazón (filas del panel). */
  variante?: 'flotante' | 'plano'
  className?: string
}) {
  const { items } = useFavoritos()
  const marcado = items.some((f) => f.productId === productId)
  const [latido, setLatido] = useState(0)
  const alClic = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!marcado) setLatido((n) => n + 1)
    void alternarFavoritoTienda(productId, { precio: precio ?? null })
  }
  return (
    <button
      type="button"
      onClick={alClic}
      aria-pressed={marcado}
      aria-label={marcado ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      title={marcado ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      data-favorito={marcado ? 'si' : 'no'}
      className={
        variante === 'flotante'
          ? `group flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-colors hover:bg-red-50 ${className}`
          : `group flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-red-50 ${className}`
      }
    >
      <Heart
        key={latido}
        aria-hidden="true"
        className={`h-5 w-5 transition-colors ${latido > 0 && marcado ? 'latido-favorito' : ''} ${marcado ? '' : 'text-gray-700 group-hover:text-red-400'}`}
        style={marcado ? { color: ROJO_FAVORITO, fill: ROJO_FAVORITO } : undefined}
        strokeWidth={2}
      />
    </button>
  )
}
