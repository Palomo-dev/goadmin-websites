'use client'

import { useEffect, useState } from 'react'

/**
 * Ids del carrito que son productos padre (se compra la variante, no el padre).
 * Se leen en el servidor con la organización del host (/api/checkout/lineas-padre).
 * Conjunto vacío mientras no llegan o si la consulta falla: /api/orders vuelve a
 * rechazarlos al pagar, esto solo avisa antes.
 */
export function usePadresEnCarrito(productIds: number[]): Set<number> {
  const clave = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))]
    .sort((a, b) => a - b)
    .join(',')
  const [estado, setEstado] = useState<{ clave: string; padres: Set<number> } | null>(null)

  useEffect(() => {
    if (!clave) return
    let vivo = true
    fetch('/api/checkout/lineas-padre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: clave.split(',').map(Number) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { padres?: unknown[] } | null) => {
        if (!vivo || !Array.isArray(data?.padres)) return
        setEstado({ clave, padres: new Set(data.padres.map(Number).filter((id) => Number.isInteger(id) && id > 0)) })
      })
      .catch(() => {
        // Sin respuesta, el carrito sigue igual; el servidor rechaza el padre al crear el pedido.
      })
    return () => {
      vivo = false
    }
  }, [clave])

  return estado?.clave === clave ? estado.padres : new Set()
}
