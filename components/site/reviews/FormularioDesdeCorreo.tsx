'use client'

/**
 * Formulario desde el correo «¿Qué te pareció tu compra?» (Figma 3B, 3131-92203).
 *
 * La página (`app/opinar/[pedido]`) ya validó el enlace firmado en el servidor; aquí solo se elige
 * el producto («También compraste») y se usa el MISMO formulario de la ficha (`ReviewForm`) con la
 * compra verificada y las estrellas que eligió en el correo. `POST /api/reviews` vuelve a validar
 * el enlace antes de guardar.
 */

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ReviewForm } from './ReviewForm'

export interface ProductoOpinable {
  id: number
  nombre: string
  yaOpino: boolean
}

interface Props {
  primaryColor: string
  orderId: string
  token: string
  numeroPedido: string
  /** «entregado el 14 nov.» ya armado en el servidor (zona de la tienda). */
  entregado: string
  nombre: string
  productos: ProductoOpinable[]
  productoInicial: number | null
  ratingInicial: number
  fotosPermitidas: boolean
  moderar: boolean
}

export function FormularioDesdeCorreo({ primaryColor, orderId, token, numeroPedido, entregado, nombre, productos, productoInicial, ratingInicial, fotosPermitidas, moderar }: Props) {
  const pendientes = productos.filter((p) => !p.yaOpino)
  const inicial = pendientes.find((p) => p.id === productoInicial) ?? pendientes[0] ?? null
  const [actual, setActual] = useState<ProductoOpinable | null>(inicial)
  const [rating, setRating] = useState(inicial && inicial.id === productoInicial ? ratingInicial : 0)

  if (!actual) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-700" aria-hidden="true" />
        <p className="text-lg font-semibold text-gray-900 dark:text-white">Ya opinaste sobre todos los productos de este pedido</p>
        <p className="text-sm text-gray-500">¡Gracias por contarnos!</p>
      </div>
    )
  }

  const otros = productos.filter((p) => p.id !== actual.id)
  return (
    <div className="flex flex-col gap-6">
      <ReviewForm
        key={actual.id}
        incrustado
        primaryColor={primaryColor}
        productId={actual.id}
        productName={actual.nombre}
        fotosPermitidas={fotosPermitidas}
        moderar={moderar}
        origen="correo"
        ratingInicial={rating}
        nombreInicial={nombre}
        verificacion={{ orderId, token, orderNumber: [numeroPedido, entregado].filter(Boolean).join(' · ') }}
      />
      {otros.length > 0 && (
        <section className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60" aria-label="También compraste">
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">También compraste</p>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {otros.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-gray-800 dark:text-gray-100">{p.nombre}</span>
                {p.yaOpino ? (
                  <span className="text-xs text-gray-500">Ya opinaste</span>
                ) : (
                  <button type="button" onClick={() => { setActual(p); setRating(0) }} className="font-semibold underline underline-offset-2" style={{ color: primaryColor }}>
                    Calificar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
