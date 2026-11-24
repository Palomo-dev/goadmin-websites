'use client'

import { Banknote, Info } from 'lucide-react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { useOpcionesTienda } from '@/components/site/OpcionesTiendaContext'
import { normalizarCondiciones, productoAplica } from '@/lib/contraentrega/reglaContraentrega'
import { avisoFichaContraentrega } from '@/lib/contraentrega/textosContraentrega'
import { useCondicionesContraentrega } from './useCondicionesContraentrega'

interface Props {
  /** El producto de la ficha (fila de `products`): id, categoría y padre. */
  product: { id: number | string; category_id?: number | string | null; parent_product_id?: number | string | null }
  branchId?: number | null
}

function idONulo(v: unknown): number | null {
  const n = Number(v)
  return v !== null && v !== undefined && Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Aviso de contraentrega de la ficha, en línea discreta (Figma 3073:83567 y 3073:83624, aprobado
 * el 2026-11-24): «Contraentrega disponible · pagas al recibir» si el producto aplica, «Este
 * producto se paga en línea» si no. Gris de 12 px con el billete, sin recuadro.
 *
 * APAGADO por defecto (dueño, 2026-11-24: «no me gusta que lo mencione»). Lo enciende la casilla
 * `header_carrito.avisoContraentrega.ficha`, que el editor cambia desde Encabezado › Carrito o
 * desde la ficha del producto; la lee del contexto de la cabecera (sin consultas nuevas; en la
 * vista previa, con los ajustes vivos del editor). Apagada, ni se piden las condiciones. Sin
 * condiciones en la sede (la mayoría de tiendas) no pinta nada aunque esté encendida.
 */
export function AvisoContraentregaFicha({ product, branchId }: Props) {
  const { formatPrice } = useCurrency()
  const encendido = useOpcionesTienda().carrito.avisoContraentrega.ficha
  const respuesta = useCondicionesContraentrega(branchId, null, encendido)
  const productoId = idONulo(product?.id)
  if (!encendido || !respuesta || !respuesta.conCondiciones || productoId === null) return null

  const aplica = productoAplica(normalizarCondiciones(respuesta), {
    productoId,
    categoriaId: idONulo(product.category_id),
    productoPadreId: idONulo(product.parent_product_id),
  })
  const aviso = avisoFichaContraentrega(respuesta, aplica, formatPrice)
  const Icono = aviso.tipo === 'disponible' ? Banknote : Info
  return (
    <p
      className="flex items-start gap-1.5 text-xs leading-4 text-gray-500 dark:text-gray-400"
      title={aviso.detalle ?? undefined}
      data-aviso-contraentrega={aviso.tipo}
    >
      <Icono className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>{aviso.titulo}</span>
    </p>
  )
}
