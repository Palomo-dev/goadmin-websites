'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { alternarFavoritoTienda, useFavoritos } from '@/lib/favoritos/almacen'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { ROJO_FAVORITO } from './CorazonFavorito'

/**
 * «Guardar» / «En favoritos» en la ficha del producto, junto a «Agregar al carrito» (Figma
 * 2767:61793, B). Se oculta con Encabezado › Favoritos › «Corazón en la ficha» apagado.
 */
export function BotonGuardarFicha({ productId, precio, className = '' }: { productId: number; precio?: number | null; className?: string }) {
  const { favoritos } = useOpcionesTienda()
  const { items } = useFavoritos()
  const [latido, setLatido] = useState(0)
  if (!favoritos.corazonFicha) return null
  const marcado = items.some((f) => f.productId === productId)
  return (
    <button
      type="button"
      aria-pressed={marcado}
      data-guardar-ficha={marcado ? 'si' : 'no'}
      onClick={() => {
        if (!marcado) setLatido((n) => n + 1)
        void alternarFavoritoTienda(productId, { precio: precio ?? null })
      }}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors ${
        marcado ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white'
      } ${className}`}
    >
      <Heart
        key={latido}
        aria-hidden="true"
        className={`h-5 w-5 ${latido > 0 && marcado ? 'latido-favorito' : ''}`}
        style={marcado ? { color: ROJO_FAVORITO, fill: ROJO_FAVORITO } : undefined}
      />
      {marcado ? 'En favoritos' : 'Guardar'}
    </button>
  )
}
