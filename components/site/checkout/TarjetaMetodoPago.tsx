'use client'

/**
 * Un método en el paso de pago (Figma «16 Sitio web» contraentrega 08 3019:76155 y 10/10c
 * 3020:76243 · 3029:77604): radio a la izquierda, título en negrita, una línea pequeña de
 * descripción y el ícono en su cuadro redondeado a la DERECHA. Seleccionada: borde y fondo suave
 * del color de la tienda. Lo que se muestra al elegir el método (desglose de contraentrega,
 * selector de pasarela, motivo de la opción apagada…) va dentro de la tarjeta, en `children`,
 * fuera del botón (tiene sus propios controles).
 */

import type { ReactNode } from 'react'
import { ArrowLeftRight, Banknote, Coins, CreditCard, Globe, Landmark, QrCode, Smartphone, Store, Truck, Wallet, Zap, type LucideIcon } from 'lucide-react'
import type { IconoMetodo, NombreIconoMetodo, TonoIconoMetodo } from './resumenPago'

const ESTILO_TONO: Record<TonoIconoMetodo, string> = {
  verde: 'bg-green-50 border-green-200 text-green-600',
  azul: 'bg-sky-50 border-sky-200 text-sky-600',
  rojo: 'bg-red-50 border-red-200 text-red-600',
  gris: 'bg-gray-50 border-gray-200 text-gray-500',
}
/** Cada ícono que la tienda puede elegir en el ERP (ICONOS_TIENDA), más los de cada tipo. */
export const ICONOS_LUCIDE_METODO: Record<NombreIconoMetodo, LucideIcon> = {
  wallet: Wallet,
  banknote: Banknote,
  landmark: Landmark,
  coins: Coins,
  'credit-card': CreditCard,
  'arrow-left-right': ArrowLeftRight,
  smartphone: Smartphone,
  'qr-code': QrCode,
  globe: Globe,
  zap: Zap,
  truck: Truck,
  store: Store,
}

export function CuadroIconoMetodo({ icono }: { icono: IconoMetodo }) {
  if ('emoji' in icono) {
    return (
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xl" aria-hidden="true">
        {icono.emoji}
      </span>
    )
  }
  const Icono = ICONOS_LUCIDE_METODO[icono.icono]
  return (
    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${ESTILO_TONO[icono.tono]}`} aria-hidden="true">
      <Icono className="h-5 w-5" />
    </span>
  )
}

interface Props {
  id: string
  titulo: string
  descripcion: ReactNode
  /** La descripción va en el color de la tienda (contraentrega con sus montos, seleccionada). */
  descripcionEnColor?: boolean
  icono: IconoMetodo
  seleccionada: boolean
  color: string
  /** Apagada (contraentrega que no aplica): se puede tocar para ver el motivo. */
  apagada?: boolean
  onSeleccionar: () => void
  children?: ReactNode
}

export function TarjetaMetodoPago({ id, titulo, descripcion, descripcionEnColor = false, icono, seleccionada, color, apagada = false, onSeleccionar, children }: Props) {
  return (
    <div
      data-metodo-pago={id}
      className={`rounded-lg border-2 transition-colors ${seleccionada ? '' : 'border-gray-200 bg-white hover:border-gray-300'}`}
      style={seleccionada ? { borderColor: color, backgroundColor: `${color}0d` } : undefined}
    >
      <button
        type="button"
        role="radio"
        aria-checked={seleccionada}
        aria-disabled={apagada || undefined}
        onClick={onSeleccionar}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: seleccionada ? color : '#d1d5db' }}
          aria-hidden="true"
        >
          {seleccionada && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
        </span>
        <span className={`min-w-0 flex-1 ${apagada ? 'opacity-70' : ''}`}>
          <span className="block font-semibold text-gray-900">{titulo}</span>
          {descripcion ? (
            <span className={`mt-0.5 block text-xs ${descripcionEnColor ? 'font-medium' : 'text-gray-500'}`} style={descripcionEnColor ? { color } : undefined}>
              {descripcion}
            </span>
          ) : null}
        </span>
        <CuadroIconoMetodo icono={icono} />
      </button>
      {children ? <div className="px-4 pb-4 pl-12">{children}</div> : null}
    </div>
  )
}
