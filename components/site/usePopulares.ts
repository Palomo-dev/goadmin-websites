'use client'

import { useEffect, useState } from 'react'

let memoria: { at: number; terms: string[] } | null = null
const TTL = 10 * 60 * 1000

function urlPopulares(): string {
  if (typeof window === 'undefined' || !window.location.hostname.includes('localhost')) {
    return '/api/products/popular'
  }
  const params = new URLSearchParams()
  const pagina = new URLSearchParams(window.location.search)
  for (const nombre of ['subdomain', 'outlet']) {
    const valor = pagina.get(nombre)
    if (valor) params.set(nombre, valor)
  }
  const q = params.toString()
  return q ? `/api/products/popular?${q}` : '/api/products/popular'
}

/** Nombres de la organización. Vacío hasta que respondan, y si no hay ventas ni categorías. */
export function usePopulares(): string[] {
  const [terms, setTerms] = useState<string[]>(() => (memoria && Date.now() - memoria.at < TTL ? memoria.terms : []))
  useEffect(() => {
    if (memoria && Date.now() - memoria.at < TTL) {
      setTerms(memoria.terms)
      return
    }
    let vivo = true
    fetch(urlPopulares())
      .then((res) => (res.ok ? res.json() : { terms: [] }))
      .then((data: { terms?: unknown }) => {
        const lista = Array.isArray(data.terms)
          ? data.terms.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 6)
          : []
        memoria = { at: Date.now(), terms: lista }
        if (vivo) setTerms(lista)
      })
      .catch(() => {
        if (vivo) setTerms([])
      })
    return () => {
      vivo = false
    }
  }, [])
  return terms
}
