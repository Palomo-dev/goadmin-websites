'use client'

import { useState } from 'react'
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
  /**
   * Casilla «En el carrito» (`header_carrito.avisoContraentrega.carrito`). Apagada (por defecto)
   * no se pinta nada y ni se piden las condiciones.
   */
  encendido: boolean
}

const CLASE_LINEA = 'flex items-start gap-1.5 text-xs leading-4 text-gray-500 dark:text-gray-400'

/**
 * Aviso de contraentrega del cajón del carrito, en línea discreta debajo del total (Figma
 * 3073:83426 y 3073:83624, aprobado el 2026-11-24): gris de 12 px con el billete, sin recuadro y sin
 * la barra del mínimo (el cajón ya tiene la de envío gratis).
 *
 * APAGADO por defecto (dueño, 2026-11-24: «no me gusta que lo mencione»): lo enciende la casilla
 * del editor (Encabezado › Carrito). Sin condiciones en la sede (la mayoría de tiendas) no pinta
 * nada aunque esté encendido. La zona no se revisa aquí: aún no hay dirección (se revisa en el
 * checkout).
 */
export function AvisoContraentregaCarrito({ items, subtotalProductos, branchId, encendido }: Props) {
  const { formatPrice } = useCurrency()
  const [verCuales, setVerCuales] = useState(false)
  const ids = items.map((item) => idProductoCarrito(item)).filter((id): id is number => id !== null)
  const respuesta = useCondicionesContraentrega(branchId, ids, encendido && items.length > 0)
  if (!encendido || !respuesta || !respuesta.conCondiciones || items.length === 0) return null

  const condiciones = normalizarCondiciones(respuesta)
  const enCarrito = new Set(ids)
  const excluidos = (respuesta.excluidos ?? []).filter((x) => enCarrito.has(x.productId))
  const aviso = avisoCarritoContraentrega(
    respuesta,
    { falta: faltaParaMinimo(condiciones, subtotalProductos), subtotalProductos, excluidos },
    formatPrice,
  )

  if (aviso.tipo === 'disponible' || aviso.tipo === 'minimo') {
    return (
      <p className={CLASE_LINEA} data-aviso-contraentrega={aviso.tipo}>
        <Banknote className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{aviso.titulo}</span>
      </p>
    )
  }

  if (aviso.tipo === 'maximo') {
    return (
      <p className={CLASE_LINEA} data-aviso-contraentrega="maximo">
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{aviso.titulo}: {aviso.detalle.charAt(0).toLowerCase()}{aviso.detalle.slice(1)}</span>
      </p>
    )
  }

  // Uno o varios productos no aplican: la línea y «Ver cuáles» abre la lista con su «Se paga en
  // línea» (la misma de 14b › 4).
  const lineas = aviso.productoIds
    .map((id) => {
      const item = items.find((i) => idProductoCarrito(i) === id)
      const nombre = excluidos.find((x) => x.productId === id)?.nombre ?? item?.name ?? null
      return item || nombre ? { id, item, nombre } : null
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
  return (
    <div data-aviso-contraentrega="productos">
      <p className={CLASE_LINEA}>
        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          {aviso.titulo}
          {lineas.length > 0 && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setVerCuales((v) => !v)}
                aria-expanded={verCuales}
                className="font-medium text-gray-700 underline underline-offset-2 dark:text-gray-300"
              >
                {verCuales ? 'Ocultar' : 'Ver cuáles'}
              </button>
            </>
          )}
        </span>
      </p>
      {verCuales && lineas.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {lineas.map(({ id, item, nombre }) => (
            <li key={id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-800">
              <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700">
                {item?.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-900 dark:text-white">{nombre}</p>
                <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  Se paga en línea
                </span>
              </div>
              {item ? <Price value={item.price * item.quantity} className="text-sm font-semibold text-gray-900 dark:text-white" /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
