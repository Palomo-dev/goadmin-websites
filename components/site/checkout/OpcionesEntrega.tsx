'use client'

/**
 * «¿Cómo quieres recibirlo?» del checkout v2 (Figma «16 Sitio web» › Checkout v2, A1 y B1): una fila
 * por opción con el radio a la izquierda, ícono en un cuadro, título, una línea (quién lo lleva y
 * cuándo llega) y el precio a la derecha. Mismas opciones y mismas reglas que `OrderTypeSelector`
 * (Domicilio y Transportadora con tiempo y precio, Recoger, Comer aquí); solo cambia el dibujo.
 */

import { Package, Store, Truck, UtensilsCrossed } from 'lucide-react'
import type { GrupoEnvio } from '@/lib/shipping/opcionesDomicilio'
import type { OpcionDomicilio, OrderType } from '@/components/site/OrderTypeSelector'

interface Fila {
  clave: string
  tipo: OrderType
  grupo?: GrupoEnvio
  titulo: string
  detalle: string
  precio: string | null
  icono: typeof Truck
}

export function OpcionesEntrega({
  value,
  onChange,
  primaryColor,
  enableDelivery = true,
  enablePickup = true,
  enableDineIn = false,
  opcionesDomicilio,
  grupoDomicilio,
  onGrupoDomicilio,
  detalleRecoger,
}: {
  value: OrderType
  onChange: (t: OrderType) => void
  primaryColor: string
  enableDelivery?: boolean
  enablePickup?: boolean
  enableDineIn?: boolean
  opcionesDomicilio?: OpcionDomicilio[]
  grupoDomicilio?: GrupoEnvio
  onGrupoDomicilio?: (g: GrupoEnvio) => void
  /** «Sede Centro · Cra 10 # 20-30». */
  detalleRecoger?: string | null
}) {
  const filas: Fila[] = []
  if (enableDelivery) {
    if (opcionesDomicilio && opcionesDomicilio.length > 0) {
      for (const o of opcionesDomicilio) {
        filas.push({
          clave: `delivery:${o.grupo}`,
          tipo: 'delivery',
          grupo: o.grupo,
          titulo: o.titulo,
          detalle: [o.detalle, o.tiempo].filter(Boolean).join(' · '),
          precio: o.precio,
          icono: o.grupo === 'third_party' ? Package : Truck,
        })
      }
    } else {
      filas.push({ clave: 'delivery', tipo: 'delivery', titulo: 'Domicilio', detalle: 'Te lo llevamos a tu dirección', precio: null, icono: Truck })
    }
  }
  if (enablePickup) {
    filas.push({ clave: 'pickup', tipo: 'pickup', titulo: 'Recoger en tienda', detalle: detalleRecoger || 'Recógelo en el local', precio: 'Gratis', icono: Store })
  }
  if (enableDineIn) {
    filas.push({ clave: 'dine_in', tipo: 'dine_in', titulo: 'Comer aquí', detalle: 'Te lo llevamos a tu mesa', precio: null, icono: UtensilsCrossed })
  }
  if (filas.length <= 1) return null

  return (
    <div className="space-y-2.5" role="radiogroup" aria-label="Cómo quieres recibirlo">
      {filas.map((f) => {
        const elegida = value === f.tipo && (!f.grupo || !grupoDomicilio || f.grupo === grupoDomicilio)
        const Icono = f.icono
        return (
          <button
            key={f.clave}
            type="button"
            role="radio"
            aria-checked={elegida}
            data-opcion-entrega={f.clave}
            onClick={() => {
              onChange(f.tipo)
              if (f.grupo) onGrupoDomicilio?.(f.grupo)
            }}
            className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors sm:p-4"
            style={elegida ? { borderColor: primaryColor, backgroundColor: `color-mix(in srgb, ${primaryColor} 6%, white)` } : { borderColor: '#E5E7EB' }}
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
              style={{ borderColor: elegida ? primaryColor : '#D1D5DB' }}
            >
              {elegida && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
            </span>
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, white)`, color: primaryColor }}>
              <Icono className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900">{f.titulo}</span>
              <span className="block text-xs text-gray-500">{f.detalle}</span>
            </span>
            {f.precio ? <span className="flex-shrink-0 text-sm font-semibold text-gray-900">{f.precio}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Costo y hora del envío en cuanto hay barrio o municipio (Figma A1: «Domicilio a Chapinero:
 * $ 9.000 · Llega hoy entre…»). Mientras cotiza: «Calculando el envío…» (C7b). Sin dirección todavía:
 * la pista de qué escribir. Solo pinta; el cobro lo decide /api/orders.
 */
export function AvisoCostoEnvio({
  calculando,
  titulo,
  detalle,
  pista,
}: {
  calculando: boolean
  /** «Domicilio a Chapinero: $ 9.000». null = aún no hay con qué cotizar. */
  titulo: string | null
  detalle?: string | null
  /** Sin dirección: «Escribe el barrio y te decimos el costo exacto y la hora de llegada». */
  pista?: string | null
}) {
  if (calculando) {
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600" data-aviso-envio="calculando">
        <Truck className="h-4 w-4 animate-pulse" aria-hidden="true" />
        Calculando el envío…
      </p>
    )
  }
  if (titulo) {
    return (
      <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-800" data-aviso-envio="listo">
        <Truck className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>
          <span className="block font-semibold">{titulo}</span>
          {detalle ? <span className="block">{detalle}</span> : null}
        </span>
      </div>
    )
  }
  if (pista) {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500" data-aviso-envio="pista">
        <Truck className="h-4 w-4" aria-hidden="true" />
        {pista}
      </p>
    )
  }
  return null
}
