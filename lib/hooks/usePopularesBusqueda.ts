'use client'

import { useEffect, useState } from 'react'

/** Carga al abrir el buscador. No consulta ventas ni catálogo en el navegador. */
export function usePopularesBusqueda(activo: boolean): string[] {
  const [populares, setPopulares] = useState<string[]>([])
  useEffect(() => {
    if (!activo) return
    let vigente = true
    const pagina = new URLSearchParams(window.location.search)
    const params = new URLSearchParams()
    if (window.location.hostname.includes('localhost')) {
      for (const clave of ['subdomain', 'outlet']) {
        const valor = pagina.get(clave)
        if (valor) params.set(clave, valor)
      }
    }
    fetch(`/api/products/popular?${params.toString()}`)
      .then((res) => res.ok ? res.json() : { suggestions: [] })
      .then((data: { suggestions?: unknown }) => {
        if (vigente && Array.isArray(data.suggestions)) setPopulares(data.suggestions.filter((v): v is string => typeof v === 'string').slice(0, 5))
      })
      .catch(() => { if (vigente) setPopulares([]) })
    return () => { vigente = false }
  }, [activo])
  return populares
}
