'use client'

import { Banknote, Info } from 'lucide-react'
import { Price, useCurrency } from '@/components/site/CurrencyProvider'
import { idProductoCarrito } from '@/lib/orders/impuestoProducto'
import { faltaParaMinimo, normalizarCondiciones } from '@/lib/contraentrega/reglaContraentrega'
import { avisoCarritoContraentrega } from '@/lib/contraentrega/textosContraentrega'
import { useCondicionesContraentrega } from './useCondicionesContraentrega'

interface LineaCarrito {
  id: number | string
  productId?: number
  name: string
  price: number
  quantity: number
  imageUrl?: string | null
}

interface Props {
  items: readonly LineaCarrito[]
  /** Valor de los productos con descuentos, sin envío (lo que cuenta el mínimo). */
  subtotalProductos: number
  branchId?: number | null
  primaryColor: string
  /**
   * Con la barra de envío gratis encima: el aviso del mínimo va debajo en una sola línea, sin su
   * barra (14b › 3).
   */
  compacto?: boolean
}

/**
 * Aviso de contraentrega del cajón del carrito (Figma 3019:76125 › 14 y 14b). Sin condiciones en la
 * sede (la mayoría de tiendas) no pinta nada y el cajón queda exactamente como hoy. La zona no se
 * revisa aquí: aún no hay dirección (se revisa en el checkout).
 */
export function AvisoContraentregaCarrito({ items, subtotalProductos, branchId, primaryColor, compacto = false }: Props) {
  const { formatPrice } = useCurrency()
  const ids = items.map((item) => idProductoCarrito(item)).filter((id): id is number => id !== null)
  const respuesta = useCondicionesContraentrega(branchId, ids, items.length > 0)
  if (!respuesta || !respuesta.conCondiciones || items.length === 0) return null

  const condiciones = normalizarCondiciones(respuesta)
  const enCarrito = new Set(ids)
  const excluidos = (respuesta.excluidos ?? []).filter((x) => enCarrito.has(x.productId))
  const aviso = avisoCarritoContraentrega(
    respuesta,
    { falta: faltaParaMinimo(condiciones, subtotalProductos), subtotalProductos, excluidos },
    formatPrice,
  )

  if (aviso.tipo === 'disponible') {
    return (
      <div className="px-4 pt-3" data-aviso-contraentrega="disponible">
        <p className="flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
          <Banknote className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{aviso.titulo}</span>
        </p>
      </div>
    )
  }

  if (aviso.tipo === 'minimo') {
    const avance = Math.round(aviso.avance * 100)
    return (
      <div className="px-4 pt-3" data-aviso-contraentrega="minimo">
        <div className="rounded-xl bg-orange-50 px-3 py-2.5 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
          <p className="flex items-center gap-2 text-sm">
            <Banknote className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{aviso.titulo}</span>
          </p>
          {!compacto && (
            <>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/80 dark:bg-gray-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={avance}
                aria-label="Avance para pagar contra entrega"
              >
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${avance}%`, backgroundColor: primaryColor }} />
              </div>
              <p className="mt-2 text-xs">{aviso.detalle}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (aviso.tipo === 'maximo') {
    return (
      <div className="px-4 pt-3" data-aviso-contraentrega="maximo">
        <div className="flex items-start gap-2 rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            {aviso.titulo}. <span className="text-gray-500 dark:text-gray-400">{aviso.detalle}</span>
          </p>
        </div>
      </div>
    )
  }

  // Un producto (o varios) no aplica: cuáles, con su «Se paga en línea» (14b › 4).
  const lineas = aviso.productoIds
    .map((id) => {
      const item = items.find((i) => idProductoCarrito(i) === id)
      const nombre = excluidos.find((x) => x.productId === id)?.nombre ?? item?.name ?? null
      return item || nombre ? { id, item, nombre } : null
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
  return (
    <div className="px-4 pt-3" data-aviso-contraentrega="productos">
      <div className="rounded-xl bg-gray-100 px-3 py-2.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <p className="flex items-start gap-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{aviso.titulo}</span>
        </p>
        {lineas.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {lineas.map(({ id, item, nombre }) => (
              <li key={id} className="flex items-center gap-3 rounded-lg bg-white px-2.5 py-2 dark:bg-gray-900">
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                  {item?.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900 dark:text-white">{nombre}</p>
                  <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    Se paga en línea
                  </span>
                </div>
                {item ? <Price value={item.price * item.quantity} className="text-sm font-semibold text-gray-900 dark:text-white" /> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
