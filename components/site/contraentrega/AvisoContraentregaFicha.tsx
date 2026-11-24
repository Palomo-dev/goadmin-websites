'use client'

import { Banknote, Info } from 'lucide-react'
import { useCurrency } from '@/components/site/CurrencyProvider'
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
 * Aviso de contraentrega de la ficha (Figma 3019:76125 › 15 y 15b): «Contraentrega disponible ·
 * pagas al recibir» si el producto aplica, «Este producto se paga en línea» si no. Sin condiciones
 * en la sede (la mayoría de tiendas) no pinta nada: la ficha queda exactamente como hoy.
 */
export function AvisoContraentregaFicha({ product, branchId }: Props) {
  const { formatPrice } = useCurrency()
  const respuesta = useCondicionesContraentrega(branchId, null)
  const productoId = idONulo(product?.id)
  if (!respuesta || !respuesta.conCondiciones || productoId === null) return null

  const aplica = productoAplica(normalizarCondiciones(respuesta), {
    productoId,
    categoriaId: idONulo(product.category_id),
    productoPadreId: idONulo(product.parent_product_id),
  })
  const aviso = avisoFichaContraentrega(respuesta, aplica, formatPrice)
  const disponible = aviso.tipo === 'disponible'
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-700 dark:bg-gray-800/50"
      data-aviso-contraentrega={aviso.tipo}
    >
      {disponible ? (
        <Banknote className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium ${disponible ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{aviso.titulo}</p>
        {aviso.detalle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{aviso.detalle}</p>}
      </div>
    </div>
  )
}
