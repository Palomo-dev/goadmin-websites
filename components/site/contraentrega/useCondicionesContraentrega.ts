'use client'

import { useEffect, useState } from 'react'
import type { RespuestaCondicionesContraentrega } from '@/lib/contraentrega/textosContraentrega'

/**
 * Condiciones de contraentrega de la sede para los avisos del carrito lateral y de la ficha
 * (`GET /api/contraentrega/condiciones`). Una petición por URL cada dos minutos y por pestaña: el
 * carrito y la ficha comparten la misma respuesta, y abrir y cerrar el cajón no vuelve a pedir.
 *
 * Primero se pide la URL base (igual para todos los visitantes: la sirve el CDN). Solo si la sede
 * tiene condiciones POR PRODUCTO y hay productos se pide de nuevo con `productos=` para saber
 * cuáles no aplican. Cualquier error = `{ conCondiciones: false }`: sin aviso, como hoy.
 */

const COMO_HOY: RespuestaCondicionesContraentrega = { conCondiciones: false }
const VIGENCIA_MS = 2 * 60 * 1000
const guardadas = new Map<string, { hasta: number; promesa: Promise<RespuestaCondicionesContraentrega> }>()

function pedir(url: string): Promise<RespuestaCondicionesContraentrega> {
  const ahora = Date.now()
  const previa = guardadas.get(url)
  if (previa && previa.hasta > ahora) return previa.promesa
  const promesa = fetch(url, { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<RespuestaCondicionesContraentrega>) : COMO_HOY))
    .then((d) => (d && d.conCondiciones === true ? d : COMO_HOY))
    .catch(() => COMO_HOY)
  guardadas.set(url, { hasta: ahora + VIGENCIA_MS, promesa })
  return promesa
}

/**
 * `null` mientras carga la primera vez. `productoIds` = ids del carrito (orden y repetidos no importan); sin ellos
 * (la ficha) no se pide la lista de excluidos. `activo = false` no pide nada.
 */
export function useCondicionesContraentrega(
  branchId: number | null | undefined,
  productoIds: readonly number[] | null,
  activo = true,
): RespuestaCondicionesContraentrega | null {
  const sede = typeof branchId === 'number' && Number.isInteger(branchId) && branchId > 0 ? branchId : null
  const ids = productoIds ? Array.from(new Set(productoIds.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b) : null
  const claveIds = ids ? ids.join(',') : null
  const [estado, setEstado] = useState<{ clave: string; valor: RespuestaCondicionesContraentrega } | null>(null)
  const clave = `${sede ?? ''}|${claveIds ?? ''}`

  useEffect(() => {
    if (!activo) return
    let vigente = true
    const base = `/api/contraentrega/condiciones${sede !== null ? `?branchId=${sede}` : ''}`
    pedir(base)
      .then((r) => {
        if (r.conCondiciones && r.productos.modo !== 'todos' && claveIds) {
          return pedir(`${base}${sede !== null ? '&' : '?'}productos=${claveIds}`)
        }
        return r
      })
      .then((r) => {
        if (vigente) setEstado({ clave, valor: r })
      })
    return () => {
      vigente = false
    }
  }, [activo, sede, claveIds, clave])

  if (!activo || !estado) return null
  // Mientras llega la respuesta de un carrito que cambió, la anterior (sin parpadeo); quien la usa
  // cruza los excluidos con lo que hay hoy en el carrito.
  return estado.valor
}
