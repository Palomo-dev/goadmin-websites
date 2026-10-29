'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppliedPromotion, PromotionEvaluation } from '@/lib/promotions'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'

export type { AppliedPromotion }

interface PromoLine {
  id: number | string
  productId?: number | null
  name: string
  price: number
  quantity: number
}

interface UseCartPromotionsOptions {
  organizationId?: number | null
  /** Outlet explícito. Gana sobre `sedeElegidaId`. */
  branchId?: number | null
  /**
   * Sede ya resuelta cuando no hay outlet: la mesa de «comer aquí» o la sede
   * del pedido que calculó la página. Sin las dos, el servidor usa la sede
   * por defecto (`sedeDePedidoWeb`).
   */
  sedeElegidaId?: number | null
  items: PromoLine[]
  /**
   * Método de pago elegido (solo el checkout). Las promociones con
   * `payment_method_codes` se evalúan con él; sin método no aplican todavía.
   */
  paymentMethod?: string | null
  /** Espera antes de consultar tras un cambio del carrito (ms). */
  debounceMs?: number
}

const EMPTY: PromotionEvaluation = { promotions: [], totalDiscount: 0, itemDiscounts: {} }

/**
 * Consulta /api/promotions/check cada vez que cambia el carrito y devuelve las
 * promociones automáticas aplicadas. Lo comparten el drawer, /carrito y el
 * checkout para que los tres muestren el mismo descuento.
 *
 *   const { promotions, totalDiscount, itemDiscounts, loading } =
 *     useCartPromotions({ organizationId, branchId, sedeElegidaId, items })
 *
 * `itemDiscounts` va por id de línea de carrito (string) para pintar el badge
 * y el precio tachado en cada item.
 */
export function useCartPromotions({ organizationId, branchId, sedeElegidaId = null, items, paymentMethod = null, debounceMs = 250 }: UseCartPromotionsOptions) {
  const [result, setResult] = useState<PromotionEvaluation>(EMPTY)
  const [loading, setLoading] = useState(false)
  const requestSeq = useRef(0)
  // Misma regla que /api/orders. Sin id, el servidor completa la sede por defecto.
  const sede = sedeDePedidoWeb(undefined, { outletId: branchId, sedeElegidaId })

  // Clave estable: solo lo que afecta al cálculo, así no se repite la llamada
  // por cambios de imagen, notas, etc.
  const itemsKey = useMemo(
    () => JSON.stringify(items.map(i => [i.id, i.productId ?? null, i.price, i.quantity])),
    [items],
  )

  useEffect(() => {
    if (!organizationId || items.length === 0) {
      setResult(EMPTY)
      setLoading(false)
      return
    }

    const seq = ++requestSeq.current
    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/promotions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            ...(sede != null ? { branchId: sede } : {}),
            ...(paymentMethod ? { paymentMethod } : {}),
            items: items.map(i => ({ id: i.id, productId: i.productId ?? null, name: i.name, price: i.price, quantity: i.quantity })),
          }),
        })
        const data = await res.json().catch(() => EMPTY)
        // Ignorar respuestas de peticiones viejas que llegan después.
        if (seq !== requestSeq.current) return
        setResult({
          promotions: Array.isArray(data?.promotions) ? data.promotions : [],
          totalDiscount: Number(data?.totalDiscount) || 0,
          itemDiscounts: data?.itemDiscounts && typeof data.itemDiscounts === 'object' ? data.itemDiscounts : {},
        })
      } catch {
        if (seq === requestSeq.current) setResult(EMPTY)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    }, debounceMs)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, sede, itemsKey, paymentMethod, debounceMs])

  return { ...result, loading }
}

/** Promociones que afectan a una línea concreta del carrito. */
export function promotionsForItem(promotions: AppliedPromotion[], itemId: number | string): AppliedPromotion[] {
  const key = String(itemId)
  return promotions.filter(p => (p.affectedItemIds || []).some(id => String(id) === key))
}

/** Etiqueta corta de una promoción para badges: "10% OFF", "2x1", "-$5.000". */
export function promotionBadgeLabel(promo: AppliedPromotion, formatPrice: (n: number) => string): string {
  switch (promo.promotion_type) {
    case 'percentage':
    case 'bundle':
      return `${Number(promo.discount_value)}% OFF`
    case 'buy_x_get_y':
      return promo.name
    case 'fixed_amount':
      return `-${formatPrice(promo.discount)}`
    default:
      return promo.name
  }
}
