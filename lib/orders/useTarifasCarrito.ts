'use client'

import { useEffect, useState } from 'react'
import { type TarifaResuelta } from './impuestoProducto'

/**
 * Tarifas de los productos del carrito, leídas en el servidor (organización del
 * host). `null` mientras no llegan o si la consulta falla: en ese caso la vista
 * sigue con la tarifa predeterminada.
 */
export function useTarifasCarrito(productIds: number[]): Map<number, TarifaResuelta> | null {
  const clave = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))]
    .sort((a, b) => a - b)
    .join(',')
  const [estado, setEstado] = useState<{ clave: string; mapa: Map<number, TarifaResuelta> } | null>(null)

  useEffect(() => {
    if (!clave) return
    let vivo = true
    const ids = clave.split(',').map(Number)
    fetch('/api/checkout/impuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tarifas?: Array<TarifaResuelta & { productId: number }> } | null) => {
        if (!vivo || !data?.tarifas) return
        const mapa = new Map<number, TarifaResuelta>()
        for (const t of data.tarifas) {
          mapa.set(Number(t.productId), {
            tasa: Number(t.tasa) || 0,
            incluido: t.incluido === true,
            nombre: t.nombre || 'IVA',
            delProducto: t.delProducto === true,
            componentes: Array.isArray(t.componentes)
              ? t.componentes.map((c) => ({
                  tasa: Number(c.tasa) || 0,
                  incluido: c.incluido === true,
                  nombre: c.nombre || 'IVA',
                }))
              : [],
          })
        }
        setEstado({ clave, mapa })
      })
      .catch(() => {
        // Sin tarifas del producto, la vista conserva la predeterminada.
      })
    return () => {
      vivo = false
    }
  }, [clave])

  if (!clave) return new Map()
  return estado?.clave === clave ? estado.mapa : null
}
