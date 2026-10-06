'use client'

/**
 * Mesa del QR en la carta (Figma C/14 y F-flujos «QR de mesa»).
 *
 * - `BannerMesa`: «Mesa 4 · Terraza · Sede Norte» con «No estoy en la mesa». Solo aparece si el
 *   servidor validó la mesa (`useMesaQR`); un id inválido no pinta nada.
 * - `BarraPedidoMesa`: barra fija «Ver pedido (n) · total» que sustituye a «Ver carrito» mientras
 *   hay mesa, y lleva al checkout (donde «Comer aquí» llega con la mesa preseleccionada).
 *
 * Lo comparten la carta clásica (MenuView) y la carta V2 (MenuFullView): una sola pieza.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, UtensilsCrossed, X } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { getCartKey } from '@/lib/utils'
import type { MesaGuardada } from '@/lib/restaurant/useMesaQR'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

const PRIMARY = 'var(--primary-color)'

export function textoMesa(mesa: MesaGuardada): string {
  return [mesa.nombre || 'Tu mesa', mesa.zona, mesa.nombreSede].filter(Boolean).join(' · ')
}

export function BannerMesa({ mesa, onSalir, className }: { mesa: MesaGuardada | null; onSalir: () => void; className?: string }) {
  if (!mesa) return null
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm text-white ${className ?? ''}`}
      style={{ backgroundColor: PRIMARY }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          Pides en <strong>{textoMesa(mesa)}</strong>
        </span>
      </span>
      <button
        type="button"
        onClick={onSalir}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        No estoy en la mesa
      </button>
    </div>
  )
}

interface LineaCarrito {
  price?: number | string
  quantity?: number | string
}

/** Unidades y total del carrito de la sede, en vivo (evento `cart-updated`). */
export function useResumenCarrito(subdomain: string, branchId: number | null | undefined): { unidades: number; total: number } {
  const [resumen, setResumen] = useState({ unidades: 0, total: 0 })
  useEffect(() => {
    const sub = subdomain || window.location.hostname.split('.')[0]
    const leer = () => {
      try {
        const lineas = JSON.parse(localStorage.getItem(getCartKey(sub, branchId)) || '[]') as LineaCarrito[]
        let unidades = 0
        let total = 0
        for (const l of Array.isArray(lineas) ? lineas : []) {
          const q = Number(l.quantity) || 0
          unidades += q
          total += q * (Number(l.price) || 0)
        }
        setResumen({ unidades, total })
      } catch {
        setResumen({ unidades: 0, total: 0 })
      }
    }
    leer()
    window.addEventListener('cart-updated', leer)
    window.addEventListener('storage', leer)
    return () => {
      window.removeEventListener('cart-updated', leer)
      window.removeEventListener('storage', leer)
    }
  }, [subdomain, branchId])
  return resumen
}

/** Barra fija «Ver pedido (n) · total» mientras hay mesa y algo en el carrito. */
export function BarraPedidoMesa({
  mesa,
  subdomain,
  branchId,
  href = '/checkout',
}: {
  mesa: MesaGuardada | null
  subdomain: string
  branchId: number | null | undefined
  href?: string
}) {
  const { unidades, total } = useResumenCarrito(subdomain, branchId)
  // En una sede servida por prefijo, su checkout (`/sede-norte/checkout`): mismo carrito y sede.
  const { ruta } = useRutaSitio()
  if (!mesa || unidades === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link
        href={ruta(href)}
        className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl px-5 py-3.5 font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
        style={{ backgroundColor: PRIMARY }}
      >
        <span className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          Ver pedido ({unidades})
        </span>
        <Price value={total} />
      </Link>
    </div>
  )
}
