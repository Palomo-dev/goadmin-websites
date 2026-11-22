'use client'

import { useEffect, useState } from 'react'
import type { FichaFavorito } from '@/lib/favoritos/logica'
import type { FuenteSugerenciasFavoritos } from '@/lib/website/v2/cabeceraTienda'

interface Respuesta {
  fichas: FichaFavorito[]
  sugerencias: FichaFavorito[]
}

/** Última respuesta por consulta: el panel y la página no vuelven a pedir lo mismo al reabrir. */
const cache = new Map<string, Respuesta>()

/**
 * Fichas de los favoritos (y sugerencias) desde /api/favorites/productos. `activo = false` no pide
 * nada (panel cerrado). Mientras llega, devuelve lo último que tenía para esa consulta.
 */
export function useFichasFavoritos(
  ids: readonly number[],
  opciones: { sede?: number | null; sugerencias?: FuenteSugerenciasFavoritos | null; activo?: boolean } = {},
): { fichas: FichaFavorito[]; sugerencias: FichaFavorito[]; cargando: boolean } {
  const { sede = null, sugerencias = null, activo = true } = opciones
  const clave = `${[...ids].sort((a, b) => a - b).join(',')}|${sede ?? ''}|${sugerencias ?? ''}`
  const [datos, setDatos] = useState<Respuesta | null>(() => cache.get(clave) ?? null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!activo) return
    if (ids.length === 0 && !sugerencias) {
      setDatos({ fichas: [], sugerencias: [] })
      return
    }
    const guardado = cache.get(clave)
    if (guardado) setDatos(guardado)
    let vivo = true
    setCargando(true)
    const params = new URLSearchParams()
    if (ids.length > 0) params.set('ids', ids.join(','))
    if (sede) params.set('sede', String(sede))
    if (sugerencias) params.set('sugerencias', sugerencias)
    fetch(`/api/favorites/productos?${params.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((r: Respuesta | null) => {
        if (!vivo || !r) return
        const limpio = { fichas: Array.isArray(r.fichas) ? r.fichas : [], sugerencias: Array.isArray(r.sugerencias) ? r.sugerencias : [] }
        cache.set(clave, limpio)
        setDatos(limpio)
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
    // `clave` resume ids, sede y sugerencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo])

  // Al quitar un favorito, la ficha se va de inmediato (sin esperar la respuesta).
  const presentes = new Set(ids)
  const fichas = (datos?.fichas ?? []).filter((f) => presentes.has(f.id))
  return { fichas, sugerencias: datos?.sugerencias ?? [], cargando: cargando && !datos }
}
