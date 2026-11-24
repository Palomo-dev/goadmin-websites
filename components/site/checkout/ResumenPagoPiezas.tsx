'use client'

/**
 * Piezas del resumen del checkout, versión 1 «Color de la tienda» (Figma «16 Sitio web» 3061:82007,
 * aprobada 2026-11-24). Las decisiones (etiquetas, íconos, qué chips salen) están en
 * ./resumenPago.ts; aquí solo se pintan, sin emojis salvo los que la tienda escribió.
 */

import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  Clock,
  CreditCard,
  Landmark,
  Package,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { chipEntrega, chipsMediosPago, iconoSello, type IconoEntrega, type IconoMedio, type IconoSello, type MetodoResumen, type TipoEntregaResumen } from './resumenPago'

const ICONO_ENTREGA: Record<IconoEntrega, LucideIcon> = { truck: Truck, package: Package, store: Store, utensils: UtensilsCrossed }
const ICONO_SELLO: Record<IconoSello, LucideIcon> = { shield: ShieldCheck, undo: RotateCcw, package: Package, badge: BadgeCheck }
const ICONO_MEDIO: Record<IconoMedio, LucideIcon> = { card: CreditCard, bank: Landmark, phone: Smartphone, cash: Banknote, transfer: ArrowLeftRight, wallet: Wallet }

/** «Domicilio · hoy 5:00 – 7:00 p. m.»: ícono en cuadro del color de la tienda y la hora a la derecha. */
export function ChipEntregaResumen({ tipo, color, momento }: { tipo: TipoEntregaResumen; color: string; momento?: ReactNode }) {
  const { etiqueta, icono } = chipEntrega(tipo)
  const Icono = ICONO_ENTREGA[icono]
  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-lg p-2" style={{ backgroundColor: `${color}14` }} data-chip-entrega={tipo}>
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${color}26`, color }}>
        <Icono className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold text-gray-900">{etiqueta}</span>
      {momento ? (
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {momento}
        </span>
      ) : null}
    </div>
  )
}

/** Sellos de confianza en una fila de 3: ícono de línea en un círculo de color suave y el texto debajo. */
export function SellosConfianza({ sellos, color }: { sellos: readonly { icon: string; text: string }[]; color: string }) {
  if (sellos.length === 0) return null
  return (
    <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3 border-t pt-3" data-sellos-confianza="">
      {sellos.map((s, i) => {
        const ic = iconoSello(s.icon, s.text)
        const Icono = 'linea' in ic ? ICONO_SELLO[ic.linea] : null
        return (
          <li key={i} className="flex flex-col items-center gap-1.5 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1f`, color }}>
              {Icono ? <Icono className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <span className="text-sm" aria-hidden="true">{'emoji' in ic ? ic.emoji : null}</span>}
            </span>
            <span className="text-xs leading-4 text-gray-600">{s.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** «Medios de pago»: chips neutros con ícono (el efectivo en verde), de los métodos activos de la tienda web. */
export function MediosPagoAceptados({ metodos, aDomicilio }: { metodos: readonly MetodoResumen[]; aDomicilio: boolean }) {
  const chips = chipsMediosPago(metodos, aDomicilio)
  if (chips.length === 0) return null
  return (
    <div className="mt-3 border-t pt-3" data-medios-pago="">
      <p className="mb-2 text-xs text-gray-500">Medios de pago</p>
      <ul className="flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const Icono = ICONO_MEDIO[c.icono]
          return (
            <li
              key={c.clave}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${c.verde ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700'}`}
            >
              <Icono className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {c.etiqueta}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
