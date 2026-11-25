'use client'

import { useEffect, useId, useState } from 'react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { getAvailableStock, primeraVarianteDisponible, type StockTrackable } from '@/lib/stock'
import { escucharVariante } from '@/lib/products/varianteSeleccionada'
import { useVolumenFicha } from '@/components/site/volumen/EscalonesTiendaContext'
import { PrecioVolumenFicha } from '@/components/site/volumen/PrecioVolumenFicha'
import { useColorDescuentoFicha } from '@/components/site/etiquetas/EtiquetasFicha'

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
  // «Compra más, paga menos» (solo dentro de la ficha con precio por volumen); si no, lo de siempre.
  const varianteId = variants.length > 0 && variante ? Number(variante.id) : null
  const volumen = useVolumenFicha(varianteId)
  // Etiquetas de la ficha junto al título (B): el descuento va en rojo (Figma 3038:78227). Sin
  // ellas, el verde de siempre.
  const descuentoRojo = useColorDescuentoFicha()

  const precioNormal = (
    <div className="flex items-baseline gap-3" data-precio-ficha>
      {conDescuento && <span className="text-xl text-gray-400 line-through">{formatPrice(comparacion!)}</span>}
      <span className="text-4xl font-bold" style={{ color: primaryColor }}>{formatPrice(precio)}</span>
      {conDescuento && (
        descuentoRojo ? (
          <span className="text-sm font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: descuentoRojo.bg, color: descuentoRojo.text }} data-descuento-ficha="">
            -{Math.round((1 - precio / comparacion!) * 100)} %
          </span>
        ) : (
        <span className="text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
          -{Math.round((1 - precio / comparacion!) * 100)}%
        </span>
        )
      )}
    </div>
  )
  if (!volumen) return precioNormal
  return (
    <PrecioVolumenFicha volumen={volumen} precio={precio} comparacion={comparacion} varianteId={varianteId} primaryColor={primaryColor} precioNormal={precioNormal} />
  )
}

/** Variante que muestra la ficha: arranca en la que preseleccionan el selector y la barra, y sigue a la elegida. */
function useVarianteFicha<T extends VariantePrecio>(variants: T[]): T | undefined {
  const ORIGEN = useId()
  const [variante, setVariante] = useState<T | undefined>(() => primeraVarianteDisponible(variants))
  useEffect(() => {
    return escucharVariante(ORIGEN, (id) => {
      const v = variants.find((x) => Number(x.id) === id)
      if (v) setVariante(v)
    })
  }, [variants, ORIGEN])
  return variants.length > 0 ? variante : undefined
}

/**
 * «Ahorras $ 40.000 (31 %)» (Información del producto › Ahorro, Figma «16 Sitio web» bloque 4).
 * Con el precio de la opción elegida; sin precio anterior mayor, no sale.
 */
export function AhorroFicha({ price, comparePrice = null, variants = [] }: Omit<PrecioFichaProps, 'primaryColor'>) {
  const { formatPrice } = useCurrency()
  const variante = useVarianteFicha(variants)
  const { precio, comparacion } = precioDe(variante, price, comparePrice)
  if (comparacion === null || !(comparacion > precio)) return null
  const ahorro = comparacion - precio
  return (
    <p className="mt-1 text-sm font-semibold text-green-700 dark:text-green-400" data-ahorro-ficha="">
      Ahorras {formatPrice(ahorro)} ({Math.round((ahorro / comparacion) * 100)} %)
    </p>
  )
}

/**
 * «Disponible» / «Agotado» (Información del producto › Disponibilidad). Producto sin control de
 * existencias: disponible. Con tallas, la de la opción elegida.
 */
export function DisponibilidadFicha({
  product,
  variants = [],
  textoDisponible,
  textoAgotado,
}: {
  product: StockTrackable
  variants?: (VariantePrecio & StockTrackable)[]
  textoDisponible: string
  textoAgotado: string
}) {
  const variante = useVarianteFicha(variants)
  const stock = getAvailableStock(variante ?? product)
  const agotado = stock !== null && stock <= 0
  return (
    <p className={`mt-2 flex items-center gap-2 text-sm font-medium ${agotado ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`} data-disponibilidad-ficha={agotado ? 'agotado' : 'disponible'}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${agotado ? 'bg-red-500' : 'bg-green-500'}`} />
      {agotado ? textoAgotado : textoDisponible}
    </p>
  )
}
