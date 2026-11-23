'use client'

import { Minus, Plus } from 'lucide-react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { PrecioAnterior } from '@/components/site/PrecioAnterior'
import type { CompraBarraFija } from './useCompraBarraFija'

/**
 * Piezas que comparten la barra fija del celular y la del computador (Figma 2836:69391): la
 * cantidad compacta y la miniatura con nombre y precio.
 */

/** Cantidad compacta (− 1 +), la misma en las dos barras. */
export function CantidadCompacta({ compra, alto = 'h-12' }: { compra: CompraBarraFija; alto?: string }) {
  const tope = compra.cupo !== null && compra.cantidad >= Math.max(1, compra.cupo)
  return (
    <div className={`flex ${alto} shrink-0 items-center rounded-[10px] border border-gray-300`} role="group" aria-label="Cantidad">
      <button
        type="button"
        onClick={() => compra.cambiarCantidad(compra.cantidad - 1)}
        disabled={compra.cantidad <= 1}
        aria-label="Quitar uno"
        className="flex h-full w-9 items-center justify-center text-gray-700 disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">{compra.cantidad}</span>
      <button
        type="button"
        onClick={() => compra.cambiarCantidad(compra.cantidad + 1)}
        disabled={tope}
        aria-label="Agregar uno"
        className="flex h-full w-9 items-center justify-center text-gray-700 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Miniatura + nombre + precio (B1, B2 y el computador). */
export function InfoProductoBarra({
  compra,
  nombre,
  conImagen = true,
  conNombre = true,
  conPrecio = true,
}: {
  compra: CompraBarraFija
  nombre: string
  conImagen?: boolean
  conNombre?: boolean
  conPrecio?: boolean
}) {
  const { formatPrice } = useCurrency()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {conImagen && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gray-100">
          {compra.imagenActiva && (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura de 44 px; la ficha ya cargó la imagen
            <img src={compra.imagenActiva} alt="" className="h-full w-full object-cover" />
          )}
        </span>
      )}
      <div className="min-w-0">
        {conNombre && <p className="truncate text-[13px] font-medium leading-4 text-gray-900">{nombre}</p>}
        {conPrecio && (
          <p className="flex items-baseline gap-1.5 text-sm font-semibold text-gray-900">
            <span>{formatPrice(compra.activePrice)}</span>
            {compra.activeComparePrice && compra.activeComparePrice > compra.activePrice ? (
              <PrecioAnterior className="text-xs font-normal text-gray-400">{formatPrice(compra.activeComparePrice)}</PrecioAnterior>
            ) : null}
          </p>
        )}
      </div>
    </div>
  )
}
