'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseFavoritesOptions {
  customerId?: string | null
  organizationId?: number | null
  initialFavorites?: number[]
}

/**
 * Hook client-side para gestionar favoritos del cliente autenticado.
 * - Persiste en /api/favorites (customers.metadata.favorites)
 * - Actualización optimista
 * - Fallback a localStorage si no hay cliente autenticado
 *
 * Uso:
 *   const { favorites, isFavorite, toggleFavorite } = useFavorites({ customerId, organizationId })
 */
export function useFavorites({ customerId, organizationId, initialFavorites = [] }: UseFavoritesOptions = {}) {
  const [favorites, setFavorites] = useState<Set<number>>(new Set(initialFavorites))
  const [loading, setLoading] = useState(false)

  // Cargar favoritos del servidor si hay cliente autenticado
  useEffect(() => {
    if (!customerId || !organizationId) {
      // Sin cliente: cargar de localStorage
      try {
        const stored = localStorage.getItem('guest_favorites')
        if (stored) {
          const ids = JSON.parse(stored) as number[]
          setFavorites(new Set(ids))
        }
      } catch {
        // ignore
      }
      return
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/favorites?customerId=${customerId}&organizationId=${organizationId}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && Array.isArray(data.favorites)) {
            setFavorites(new Set(data.favorites))
          }
        }
      } catch {
        // ignore
      }
    })()

    return () => { cancelled = true }
  }, [customerId, organizationId])

  const isFavorite = useCallback((productId: number) => favorites.has(productId), [favorites])

  const toggleFavorite = useCallback(async (productId: number) => {
    const isFav = favorites.has(productId)
    const action = isFav ? 'remove' : 'add'

    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev)
      isFav ? next.delete(productId) : next.add(productId)
      return next
    })

    // Si hay cliente autenticado, persistir en servidor
    if (customerId && organizationId) {
      try {
        setLoading(true)
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, organizationId, productId, action }),
        })
      } catch {
        // Revert on error
        setFavorites(prev => {
          const next = new Set(prev)
          isFav ? next.add(productId) : next.delete(productId)
          return next
        })
      } finally {
        setLoading(false)
      }
    } else {
      // Sin cliente: guardar en localStorage
      try {
        setFavorites(prev => {
          localStorage.setItem('guest_favorites', JSON.stringify([...prev]))
          return prev
        })
      } catch {
        // ignore
      }
    }
  }, [favorites, customerId, organizationId])

  return { favorites, isFavorite, toggleFavorite, loading }
}
