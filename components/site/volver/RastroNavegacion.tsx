'use client'

/**
 * Lleva el rastro de la pestaña (las páginas de la tienda que visitó el cliente) para que el ←
 * vuelva a donde venía: la categoría con sus filtros, la búsqueda o el inicio. Va una sola vez,
 * en el layout raíz; no pinta nada.
 *
 * `document.referrer` no cambia en las navegaciones internas de Next, por eso el rastro se lleva
 * aquí: cada cambio de ruta o de búsqueda se agrega con `avanzarRastro` (lib/navegacion/volver).
 */
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { avanzarRastro, rutaReferente } from '@/lib/navegacion/volver'
import { EVENTO_RASTRO, guardarRastro, leerRastro, registrarTitulo } from './rastro'

/** Atrás/adelante del navegador: lo marca `popstate` antes de que Next pinte la ruta. */
let ultimoFuePop = false
let escuchandoPop = false

function tipoDeCarga(): string {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav?.type ?? 'navigate'
  } catch {
    return 'navigate'
  }
}

export function RastroNavegacion() {
  const pathname = usePathname()
  const busqueda = useSearchParams()
  const primera = useRef(true)

  useEffect(() => {
    if (escuchandoPop) return
    escuchandoPop = true
    window.addEventListener('popstate', () => {
      ultimoFuePop = true
    })
  }, [])

  const qs = busqueda?.toString() ?? ''
  useEffect(() => {
    if (!pathname) return
    const path = window.location.pathname
    const url = `${path}${window.location.search}`
    const esPrimera = primera.current
    primera.current = false
    const pop = esPrimera ? tipoDeCarga() === 'back_forward' : ultimoFuePop
    ultimoFuePop = false
    const rastro = leerRastro()
    const pila = avanzarRastro(rastro.pila, {
      path,
      url,
      pop,
      primera: esPrimera,
      referente: esPrimera ? rutaReferente(document.referrer, window.location.origin) : null,
    })
    guardarRastro({ ...rastro, pila })
    window.dispatchEvent(new Event(EVENTO_RASTRO))
    // El título de la página nueva llega después del pintado: se guarda un momento más tarde.
    const t = window.setTimeout(() => registrarTitulo(path, document.title), 400)
    return () => window.clearTimeout(t)
  }, [pathname, qs])

  return null
}
