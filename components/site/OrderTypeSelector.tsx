'use client'

import { Clock, Package, Truck, Store, UtensilsCrossed } from 'lucide-react'
import type { GrupoEnvio } from '@/lib/shipping/opcionesDomicilio'

export type OrderType = 'delivery' | 'pickup' | 'dine_in'

/**
 * Tarjeta de un tipo de domicilio (Figma «16 Sitio web» 2686:57152): «Domicilio» o
 * «Transportadora», con su tiempo estimado y su precio ya formateado.
 */
export interface OpcionDomicilio {
  grupo: GrupoEnvio
  titulo: string
  detalle: string
  precio: string
  tiempo: string | null
}

interface OrderTypeSelectorProps {
  value: OrderType
  onChange: (type: OrderType) => void
  primaryColor: string
  enableDelivery?: boolean
  enablePickup?: boolean
  enableDineIn?: boolean
  /** Con tarjetas de domicilio, reemplazan a la de «Domicilio» y muestran tiempo y precio. */
  opcionesDomicilio?: OpcionDomicilio[]
  grupoDomicilio?: GrupoEnvio
  onGrupoDomicilio?: (grupo: GrupoEnvio) => void
}

interface Tarjeta {
  clave: string
  tipo: OrderType
  grupo?: GrupoEnvio
  label: string
  description: string
  icon: typeof Truck
  precio?: string
  tiempo?: string | null
}

const ORDER_TYPES: { id: OrderType; label: string; description: string; icon: typeof Truck }[] = [
  { id: 'delivery', label: 'Domicilio', description: 'Te lo llevamos a tu dirección', icon: Truck },
  { id: 'pickup', label: 'Recoger', description: 'Recógelo en el local', icon: Store },
  { id: 'dine_in', label: 'Comer aquí', description: 'Te lo llevamos a tu mesa', icon: UtensilsCrossed },
]

export function OrderTypeSelector({
  value, onChange, primaryColor,
  enableDelivery = true, enablePickup = true, enableDineIn = true,
  opcionesDomicilio, grupoDomicilio, onGrupoDomicilio,
}: OrderTypeSelectorProps) {
  const conPrecios = !!opcionesDomicilio && opcionesDomicilio.length > 0
  const tarjetas: Tarjeta[] = []
  for (const t of ORDER_TYPES) {
    if (t.id === 'delivery') {
      if (!enableDelivery) continue
      if (conPrecios) {
        for (const o of opcionesDomicilio!) {
          tarjetas.push({
            clave: `delivery:${o.grupo}`, tipo: 'delivery', grupo: o.grupo, label: o.titulo, description: o.detalle,
            icon: o.grupo === 'third_party' ? Package : Truck, precio: o.precio, tiempo: o.tiempo,
          })
        }
      } else {
        tarjetas.push({ clave: 'delivery', tipo: 'delivery', label: t.label, description: t.description, icon: t.icon })
      }
    } else if ((t.id === 'pickup' && enablePickup) || (t.id === 'dine_in' && enableDineIn)) {
      tarjetas.push({
        clave: t.id, tipo: t.id, label: t.label, description: t.description, icon: t.icon,
        ...(conPrecios && t.id === 'pickup' ? { precio: 'Gratis' } : {}),
      })
    }
  }

  if (tarjetas.length <= 1) return null

  const columnas = tarjetas.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700" id="tipo-pedido-titulo">Tipo de pedido</h3>
      <div className={`grid grid-cols-1 ${columnas} gap-3`} role="radiogroup" aria-labelledby="tipo-pedido-titulo">
        {tarjetas.map((t) => {
          const isSelected = value === t.tipo && (!t.grupo || !grupoDomicilio || t.grupo === grupoDomicilio)
          const Icon = t.icon
          return (
            <button
              key={t.clave}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                onChange(t.tipo)
                if (t.grupo) onGrupoDomicilio?.(t.grupo)
              }}
              className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-current shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={isSelected ? { borderColor: primaryColor, backgroundColor: `color-mix(in srgb, ${primaryColor} 6%, white)` } : {}}
              data-opcion-entrega={t.clave}
            >
              <Icon
                aria-hidden="true"
                className="h-6 w-6 mb-2"
                style={{ color: isSelected ? primaryColor : '#9CA3AF' }}
              />
              <p className={`font-semibold text-sm ${isSelected ? '' : 'text-gray-700'}`}
                style={isSelected ? { color: primaryColor } : {}}
              >
                {t.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
              {t.precio !== undefined && (
                <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                    {t.tiempo && (
                      <>
                        <Clock aria-hidden="true" className="h-3.5 w-3.5 text-gray-500" />
                        {t.tiempo}
                      </>
                    )}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{t.precio}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
