'use client'

import { useEffect, useId, useState } from 'react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { primeraVarianteDisponible, type StockTrackable } from '@/lib/stock'
import { escucharVariante } from '@/lib/products/varianteSeleccionada'

interface VariantePrecio extends StockTrackable {
  id: number
  product_prices?: { price: number; compare_price?: number | null }[]
}

interface PrecioFichaProps {
  price: number
  comparePrice?: number | null
  /** Variantes del padre. Sin ellas (producto simple), el precio fijo de siempre. */
  variants?: VariantePrecio[]
  primaryColor: string
}

function precioDe(v: VariantePrecio | undefined, price: number, comparePrice: number | null) {
  const p = v?.product_prices?.[0]
  if (!v || !p || p.price === undefined || p.price === null) return { precio: price, comparacion: comparePrice }
  return { precio: Number(p.price), comparacion: p.compare_price ? Number(p.compare_price) : null }
}

/**
 * Precio del encabezado de la ficha. Con variantes sigue a la elegida (evento
 * goadmin:variante-seleccionada) y arranca en la misma que preseleccionan el selector y la barra.
 */
export function PrecioFicha({ price, comparePrice = null, variants = [], primaryColor }: PrecioFichaProps) {
  const ORIGEN = useId()
  const { formatPrice } = useCurrency()
  const [variante, setVariante] = useState<VariantePrecio | undefined>(() => primeraVarianteDisponible(variants))

  useEffect(() => {
    return escucharVariante(ORIGEN, (id) => {
      const v = variants.find((x) => Number(x.id) === id)
      if (v) setVariante(v)
    })
  }, [variants, ORIGEN])

  const { precio, comparacion } = precioDe(variants.length > 0 ? variante : undefined, price, comparePrice)
  const conDescuento = comparacion !== null && comparacion > precio

  return (
    <div className="flex items-baseline gap-3" data-precio-ficha>
      {conDescuento && <span className="text-xl text-gray-400 line-through">{formatPrice(comparacion!)}</span>}
      <span className="text-4xl font-bold" style={{ color: primaryColor }}>{formatPrice(precio)}</span>
      {conDescuento && (
        <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
          -{Math.round((1 - precio / comparacion!) * 100)}%
        </span>
      )}
    </div>
  )
}
