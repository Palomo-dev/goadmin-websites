'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { claveScroll, type ParcialCarrusel, type ParcialPaginacion } from '@/lib/website/v2/paginacionCarrusel'

const Ctx = createContext<{ paginacion: ParcialPaginacion | null; carrusel: ParcialCarrusel | null }>({
  paginacion: null,
  carrusel: null,
})

export function ProveedorListaCarrusel({
  paginacion,
  carrusel,
  children,
}: {
  paginacion: ParcialPaginacion | null
  carrusel: ParcialCarrusel | null
  children: ReactNode
}) {
  return <Ctx.Provider value={{ paginacion, carrusel }}>{children}</Ctx.Provider>
}

export function useListaCarrusel() {
  return useContext(Ctx)
}

export function useEsMovilLista() {
  const [movil, setMovil] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const aplicar = () => setMovil(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [])
  return movil
}

/**
 * Página de un listado que ya tiene los ítems en memoria.
 * Sin ajuste activo conserva el estado local (la URL no cambia, como hoy).
 * Con ajuste, `?page=N` es la fuente: se puede abrir, rastrear y volver atrás.
 */
export function usePaginaLista(activo: boolean, totalPaginas: number) {
  const pathname = usePathname() || '/'
  const params = useSearchParams()
  const search = params?.toString() ?? ''
  const desdeUrl = Math.max(1, Number(params?.get('page')) || 1)
  const [local, setLocal] = useState(1)
  const [url, setUrl] = useState(desdeUrl)
  const pagina = Math.min(activo ? url : local, Math.max(1, totalPaginas))

  useEffect(() => {
    if (!activo) return
    const restaurar = () => {
      const n = Math.max(1, Number(new URLSearchParams(window.location.search).get('page')) || 1)
      setUrl(n)
      try {
        const y = sessionStorage.getItem(claveScroll(window.location.pathname + window.location.search))
        if (y) window.scrollTo(0, Number(y))
      } catch {
        /* modo privado */
      }
    }
    window.addEventListener('popstate', restaurar)
    restaurar()
    return () => window.removeEventListener('popstate', restaurar)
  }, [activo])

  const ir = (n: number) => {
    const destino = Math.min(Math.max(1, n), Math.max(1, totalPaginas))
    if (!activo) {
      setLocal(destino)
      return
    }
    const qs = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : search)
    if (destino <= 1) qs.delete('page')
    else qs.set('page', String(destino))
    const siguiente = qs.toString()
    const href = siguiente ? `${pathname}?${siguiente}` : pathname
    window.history.pushState(null, '', href)
    setUrl(destino)
  }

  return { pagina, ir, pathname, search }
}
