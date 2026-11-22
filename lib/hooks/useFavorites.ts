'use client'

import { useCallback, useMemo } from 'react'
import { alternarFavoritoTienda, useFavoritos } from '@/lib/favoritos/almacen'

interface UseFavoritesOptions {
  /** Ya no se usa: el cliente sale de la sesión en el servidor (se acepta por compatibilidad). */
  customerId?: string | null
  /** Ya no se usa: la organización sale del host en el servidor. */
  organizationId?: number | null
  initialFavorites?: number[]
}

/**
 * Favoritos para las tarjetas y la vista rápida (misma firma de siempre). Lee el almacén único de
 * la página (`lib/favoritos/almacen.ts`): sin sesión en el dispositivo, con sesión en la cuenta, y
 * al iniciar sesión se juntan. Antes cada tarjeta pedía /api/favorites por separado.
 *
 * Uso:
 *   const { favorites, isFavorite, toggleFavorite } = useFavorites()
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useFavorites(_opciones: UseFavoritesOptions = {}) {
  const { items, listo } = useFavoritos()
  const favorites = useMemo(() => new Set(items.map((f) => f.productId)), [items])
  const isFavorite = useCallback((productId: number) => favorites.has(productId), [favorites])
  const toggleFavorite = useCallback(async (productId: number, precio?: number | null) => {
    await alternarFavoritoTienda(productId, { precio: precio ?? null })
  }, [])
  return { favorites, isFavorite, toggleFavorite, loading: !listo }
}
