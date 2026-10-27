'use client'

import { useEffect, useRef, useState } from 'react'

const PAGINA = 500
/** Freno de seguridad: nunca más de 20 páginas (10 000 productos) en el navegador. */
const MAX_PAGINAS = 20

/**
 * Carga incremental del listado general (paquete 5-nov E, QA 27-oct): el servidor pinta la
 * primera página (500) y el total real (count exact); aquí se piden las siguientes a
 * /api/catalogo/productos hasta tener todo. Sin total o con todo cargado, no hace nada.
 */
export function useCatalogoCompleto<T extends { id?: unknown }>(iniciales: T[], total: number | null | undefined, activo = true) {
  const [productos, setProductos] = useState<T[]>(iniciales)
  const [cargando, setCargando] = useState(false)
  const base = useRef(iniciales)

  useEffect(() => {
    if (base.current !== iniciales) {
      base.current = iniciales
      setProductos(iniciales)
    }
  }, [iniciales])

  useEffect(() => {
    if (!activo || total == null || iniciales.length < PAGINA || total <= iniciales.length) return
    let cancelado = false
    ;(async () => {
      setCargando(true)
      const vistos = new Set(iniciales.map((p) => p.id))
      let acumulado = [...iniciales]
      for (let pagina = 1; pagina < MAX_PAGINAS && !cancelado; pagina++) {
        const desde = pagina * PAGINA
        if (desde >= total) break
        try {
          const res = await fetch(`/api/catalogo/productos?desde=${desde}`)
          if (!res.ok) break
          const json = (await res.json()) as { products?: T[] }
          const nuevos = (json.products ?? []).filter((p) => !vistos.has(p.id))
          nuevos.forEach((p) => vistos.add(p.id))
          acumulado = [...acumulado, ...nuevos]
          if (!cancelado) setProductos(acumulado)
          if ((json.products ?? []).length < PAGINA) break
        } catch {
          break
        }
      }
      if (!cancelado) setCargando(false)
    })()
    return () => {
      cancelado = true
    }
  }, [iniciales, total, activo])

  return { productos, cargando }
}
