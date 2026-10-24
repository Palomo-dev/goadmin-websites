'use client'

import { useEffect, useState } from 'react'
import { getCartKey } from '@/lib/utils'
import { getAvailableStock, type StockTrackable } from '@/lib/stock'
import { usePersonasViendo } from '@/lib/hooks/usePersonasViendo'
import { avisoStock, contadoresEn, type ConversionSitio, type UbicacionStock } from '@/lib/website/conversion'
import { ContadoresDe } from './ContadorPublico'
import { useAjustesVivosPreview } from './useAjustesVivosPreview'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { conPrefijo } from '@/lib/outlet/rutaSitio'

interface AjustesUrgencia { conversion?: ConversionSitio | null; conversionFines?: Record<string, string | null> | null }

/** Números reales: stock del servidor y presencia efímera de la ruta actual. */
export function UrgenciaDe({ settings, ubicacion, primaryColor, product, organizationSubdomain = '', branchId = null, usarAjustesVivos = true, prefijoSede }: {
  settings?: object | null
  ubicacion: UbicacionStock
  primaryColor: string
  prefijoSede?: string
  usarAjustesVivos?: boolean
  product?: StockTrackable
  organizationSubdomain?: string
  branchId?: number | null
}) {
  const vivos = useAjustesVivosPreview()
  const { prefijo } = useRutaSitio()
  const prefijoStock = prefijoSede ?? prefijo
  const efectivos = usarAjustesVivos && vivos ? { ...(settings ?? {}), ...vivos.ajustes } as AjustesUrgencia : settings as AjustesUrgencia | null | undefined
  const conversion = efectivos?.conversion
  const stock = conversion?.urgencia.stockBajo
  const mostrarStock = !!stock?.activo && stock.ubicaciones.includes(ubicacion)
  const viewers = conversion?.urgencia.personasViendo
  const total = usePersonasViendo(!!viewers?.activo && (viewers.ubicaciones ?? ['producto', 'carrito', 'checkout']).includes(ubicacion))
  const [existencias, setExistencias] = useState<Record<string, number | null>>({})
  useEffect(() => {
    if (!mostrarStock || product || ubicacion === 'producto') return
    const controller = new AbortController()
    const actualizar = async () => {
      try {
        const carrito: Array<{ productId?: unknown; id?: unknown }> = JSON.parse(localStorage.getItem(getCartKey(organizationSubdomain, branchId)) || '[]')
        const ids = [...new Set(carrito.map((item) => Number(item.productId ?? item.id)).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
        if (!ids.length) { setExistencias({}); return }
        const response = await fetch(`${conPrefijo('/api/products/stock', prefijoStock)}?productIds=${ids.join(',')}`, { signal: controller.signal, cache: 'no-store' })
        const resultado: { data?: Record<string, number | null> } = response.ok ? await response.json() : {}
        if (!controller.signal.aborted) setExistencias(resultado.data ?? {})
      } catch { if (!controller.signal.aborted) setExistencias({}) }
    }
    void actualizar()
    window.addEventListener('cart-updated', actualizar)
    return () => { controller.abort(); window.removeEventListener('cart-updated', actualizar) }
  }, [mostrarStock, product, ubicacion, organizationSubdomain, branchId, prefijoStock])
  const cantidades = product ? [getAvailableStock(product)] : Object.values(existencias)
  const mensajes = mostrarStock && stock ? [...new Set(cantidades.map((n) => avisoStock(n, stock.umbral, stock.plantilla)).filter((s): s is string => !!s))] : []
  if (!conversion) return null
  if (!contadoresEn(conversion, ubicacion)?.length && !mensajes.length && total === null) return null
  return (
    <div className="space-y-3" data-urgencia-ubicacion={ubicacion}>
      <ContadoresDe settings={efectivos} ubicacion={ubicacion} primaryColor={primaryColor} variante="inline" />
      {mensajes.map((mensaje) => <p key={mensaje} className="text-sm font-medium" style={{ color: primaryColor }}>{mensaje}</p>)}
      {total !== null && total > 0 && <p className="text-sm" style={{ color: primaryColor }}>{(viewers?.plantilla ?? '{n} personas viendo').replaceAll('{n}', String(total))}</p>}
    </div>
  )
}
