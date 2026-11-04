'use client'

/**
 * Comportamiento común del buscador del encabezado (barra `SearchBarInput` y panel de la lupa
 * `ProductSearch`). Cada encabezado decide DÓNDE va el buscador; CÓMO funciona vive aquí:
 * - Resultados en vivo desde 2 caracteres, con «buscando» inmediato y respuestas viejas descartadas.
 * - Búsquedas recientes (localStorage, 5).
 * - Cierre por clic afuera y por Escape (en todo el documento, no solo con el foco en el campo).
 * - Posición del desplegable: ancho propio (mínimo 360px, nunca el del input) y dentro de la pantalla.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { urlBusquedaProductos } from '@/lib/products/urlBusqueda'

export interface ResultadoBusqueda {
  id: number
  uuid: string
  name: string
  price?: number | null
  comparePrice?: number | null
  imageUrl?: string | null
  category?: string | null
  tag?: string | null
}

/** Sugerencias en vivo solo desde 2 caracteres; Enter y «Buscar» no dependen de esto. */
export const MINIMO_SUGERENCIAS = 2

/** Resultados en vivo de `query` (con categoría opcional). */
export function useResultadosBusqueda(query: string, categoriaSlug?: string) {
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [cargando, setCargando] = useState(false)
  const sugiere = query.trim().length >= MINIMO_SUGERENCIAS
  useEffect(() => {
    if (!sugiere) {
      setResultados([])
      setCargando(false)
      return
    }
    // «Buscando…» desde que cambia el texto (no solo tras la espera de 300 ms), y se descartan las
    // respuestas viejas: una respuesta tardía mostraba «No se encontraron productos».
    let vigente = true
    const control = new AbortController()
    setCargando(true)
    const espera = setTimeout(async () => {
      try {
        const res = await fetch(urlBusquedaProductos(query, categoriaSlug), { signal: control.signal })
        if (!vigente) return
        if (res.ok) {
          const data = await res.json()
          if (!vigente) return
          setResultados(data.products || [])
        }
      } catch {
        if (!vigente) return
        setResultados([])
      }
      setCargando(false)
    }, 300)
    return () => {
      vigente = false
      control.abort()
      clearTimeout(espera)
    }
  }, [query, categoriaSlug, sugiere])
  return { resultados, cargando, sugiere }
}

const CLAVE_RECIENTES = 'recent_searches'

/** Búsquedas recientes: se leen al abrir y se guardan al buscar o elegir un resultado. */
export function useBusquedasRecientes(abierto: boolean) {
  const [recientes, setRecientes] = useState<string[]>([])
  useEffect(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || '[]')
      setRecientes(Array.isArray(guardadas) ? guardadas.slice(0, 5) : [])
    } catch {}
  }, [abierto])
  const guardar = (termino: string) => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || '[]')
      const lista = [termino, ...(Array.isArray(guardadas) ? guardadas : []).filter((s: string) => s !== termino)].slice(0, 5)
      localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista))
    } catch {}
  }
  return { recientes, guardar }
}

/** Cierra con clic afuera de `zonas` (botón, campo, panel, portal) o con Escape. */
export function useCerrarBuscador(abierto: boolean, cerrar: () => void, zonas: RefObject<HTMLElement | null>[]) {
  const cerrarRef = useRef(cerrar)
  cerrarRef.current = cerrar
  const zonasRef = useRef(zonas)
  zonasRef.current = zonas
  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e: MouseEvent) => {
      const objetivo = e.target as Node
      if (zonasRef.current.some((z) => z.current?.contains(objetivo))) return
      cerrarRef.current()
    }
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarRef.current()
    }
    document.addEventListener('mousedown', alPresionar)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alPresionar)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])
}

export { ANCHO_MINIMO_PANEL, posicionPanel } from '@/lib/website/posicionPanelBuscador'
import { posicionPanel } from '@/lib/website/posicionPanelBuscador'

/** `posicionPanel` medida sobre `anclaRef` mientras el panel está abierto (y al cambiar el tamaño). */
export function usePosicionPanel(
  abierto: boolean,
  anclaRef: RefObject<HTMLElement | null>,
  opciones: { minimo?: number; ancho?: number; alinear?: 'izquierda' | 'derecha' } = {},
) {
  const [posicion, setPosicion] = useState<{ left: number; width: number } | null>(null)
  const { minimo, ancho, alinear } = opciones
  // useLayoutEffect: se mide antes de pintar, sin un cuadro con el ancho del input.
  const usarEfecto = typeof window === 'undefined' ? useEffect : useLayoutEffect
  usarEfecto(() => {
    if (!abierto) {
      setPosicion(null)
      return
    }
    const medir = () => {
      const el = anclaRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPosicion(posicionPanel({ left: r.left, right: r.right, width: r.width }, document.documentElement.clientWidth, { minimo, ancho, alinear }))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [abierto, minimo, ancho, alinear])
  return posicion
}
