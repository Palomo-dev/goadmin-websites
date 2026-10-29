'use client'

import type { CSSProperties, MouseEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { setLineQty, useCartLineQty, type CartLineInput } from '@/lib/cart'

/**
 * «Contador de cantidad» de la tarjeta (`add.quantity_stepper` con `icon_only` + `circle`).
 * - Sin unidades: el círculo «+» de siempre.
 * - Al tocarlo agrega una unidad y pasa a la píldora «− qty +» en la misma esquina; crece hacia
 *   adentro de la imagen porque el contenedor de esquina está anclado a su borde.
 * - «−» con 1 quita la línea y vuelve al círculo. «+» se apaga al llegar al stock.
 * Los clics no navegan (la tarjeta es un enlace): `preventDefault` + `stopPropagation`.
 */
export function CardQuantityStepper({
  subdomain,
  branchId,
  line,
  stock,
  sizePx,
  bg,
  textColor,
  iconClass,
}: {
  subdomain: string
  branchId?: number | null
  line: CartLineInput
  /** Unidades disponibles; `null` = no rastrea inventario (sin tope). */
  stock: number | null
  sizePx: number
  bg: string
  textColor: string
  iconClass: string
}) {
  const qty = useCartLineQty(subdomain, branchId, line.id)
  const tope = stock != null && qty >= stock
  const parar = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation() }
  const cambiar = (e: MouseEvent, siguiente: number) => {
    parar(e)
    setLineQty(subdomain, branchId, line.id, siguiente, line)
  }
  const caja: CSSProperties = { height: sizePx, minWidth: sizePx, backgroundColor: bg, color: textColor, borderRadius: 9999 }
  const boton: CSSProperties = { width: sizePx, height: sizePx }

  if (qty <= 0) {
    return (
      <button type="button" aria-label="Agregar" onClick={(e) => cambiar(e, 1)} disabled={stock != null && stock <= 0} className="inline-flex items-center justify-center shadow-sm transition-all disabled:opacity-50" style={{ ...caja, ...boton }} data-contador="0">
        <Plus className={iconClass} />
      </button>
    )
  }
  return (
    <div className="inline-flex items-center shadow-sm transition-all" style={caja} onClick={parar} data-contador={qty} role="group" aria-label="Cantidad en el carrito">
      <button type="button" aria-label={qty === 1 ? 'Quitar del carrito' : 'Quitar uno'} onClick={(e) => cambiar(e, qty - 1)} className="inline-flex items-center justify-center" style={boton}>
        <Minus className={iconClass} />
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">{qty}</span>
      <button type="button" aria-label="Agregar uno" onClick={(e) => cambiar(e, qty + 1)} disabled={tope} className="inline-flex items-center justify-center disabled:opacity-40" style={boton}>
        <Plus className={iconClass} />
      </button>
    </div>
  )
}
