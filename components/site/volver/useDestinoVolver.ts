'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { resolverVolver, type DestinoPadre, type DestinoVolver } from '@/lib/navegacion/volver'
import { conPrefijo, quitarPrefijo } from '@/lib/outlet/rutaSitio'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { EVENTO_RASTRO, leerRastro, nombreEntrada } from './rastro'

export interface OpcionesVolver {
  padre: DestinoPadre
  /** Carrito: sin paso anterior, la última categoría vista antes que el padre. */
  preferirUltimaCategoria?: boolean
}

/**
 * Destino del ←: en el servidor y en el primer pintado, la página «madre» (lo que ve quien entra
 * directo); al montar, el paso anterior de la pestaña si es de la tienda. `href` ya lleva el
 * prefijo de la sede. `alPulsar` hace `history.back()` cuando toca.
 */
export function useDestinoVolver({ padre, preferirUltimaCategoria = false }: OpcionesVolver) {
  const { prefijo } = useRutaSitio()
  const inicial: DestinoVolver = { modo: 'enlace', href: padre.href, etiqueta: padre.etiqueta, hrefReal: false }
  const [destino, setDestino] = useState<DestinoVolver>(inicial)

  useEffect(() => {
    const calcular = () => {
      const rastro = leerRastro()
      setDestino(
        resolverVolver({
          pila: rastro.pila,
          actual: window.location.pathname,
          padre: { href: padre.href, etiqueta: padre.etiqueta },
          nombre: nombreEntrada(rastro, prefijo),
          sinPrefijo: (p) => quitarPrefijo(p, prefijo),
          largoHistorial: window.history.length,
          preferirUltimaCategoria,
        }),
      )
    }
    calcular()
    window.addEventListener(EVENTO_RASTRO, calcular)
    return () => window.removeEventListener(EVENTO_RASTRO, calcular)
  }, [padre.href, padre.etiqueta, prefijo, preferirUltimaCategoria])

  const href = destino.hrefReal ? destino.href : conPrefijo(destino.href, prefijo)
  const modo = destino.modo
  const alPulsar = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (modo !== 'historial') return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      window.history.back()
    },
    [modo],
  )
  return { href, etiqueta: destino.etiqueta, modo, alPulsar }
}
