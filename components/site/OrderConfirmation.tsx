'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { momentoPedido } from '@/lib/restaurant/ventanaPedido'
import { etiquetaMesa } from '@/lib/orders/nombreMesa'

/** Copia de lo que el cliente pidió, guardada antes de vaciar el carrito y el formulario. */
export interface ResumenPedidoConfirmado {
  tipo: string
  mesa: string | null
  sede: string | null
  programadoPara: string | null
  zona: string | null
  total: string
  trackingToken: string | null
}

interface OrderConfirmationProps {
  orderNumber: string | null
  customerEmail: string
  primaryColor: string
  /** Restaurante: «Seguir pidiendo» lleva a la carta. */
  isRestaurant?: boolean
  resumen?: ResumenPedidoConfirmado | null
  /**
   * Carta o catálogo de la sede del pedido, con su prefijo si la sede se sirve por ruta
   * (`rutaSitio`, lo calcula app/checkout/page.tsx). Sin él: `/menu` o `/productos`, como antes.
   */
  rutaSeguirPidiendo?: string
}

/**
 * Confirmación de un pedido con pago fuera de línea (efectivo, transferencia…). Sin `resumen`
 * (comportamiento anterior): número, correo, «Volver al inicio» y «Seguir comprando».
 *
 * Con `resumen`: tipo de entrega, mesa, sede y hora programada (en la zona de la sede), «Seguir mi
 * pedido» al seguimiento con su token, y «Seguir pidiendo» a la carta en restaurante. Dice
 * «recibido», no «confirmado»: el restaurante aún no lo ha aceptado.
 */
export function OrderConfirmation({ orderNumber, customerEmail, primaryColor, isRestaurant = false, resumen = null, rutaSeguirPidiendo }: OrderConfirmationProps) {
  const rutaSeguir = rutaSeguirPidiendo || (isRestaurant ? '/menu' : '/productos')
  if (!resumen) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <Check className="h-10 w-10" style={{ color: primaryColor }} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Pedido Realizado!</h1>
        <p className="text-gray-600 mb-2">
          Tu pedido <strong>{orderNumber}</strong> ha sido recibido exitosamente.
        </p>
        <p className="text-gray-500 mb-8 text-sm">
          Te enviaremos un correo de confirmación a <strong>{customerEmail}</strong> con los detalles de tu compra.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button variant="outline">Volver al inicio</Button>
          </Link>
          <Link href={rutaSeguir}>
            <Button style={{ backgroundColor: primaryColor }}>
              Seguir comprando
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const seguimiento = orderNumber
    ? `/pedido/${encodeURIComponent(orderNumber)}${resumen.trackingToken ? `?t=${encodeURIComponent(resumen.trackingToken)}` : ''}`
    : null

  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Número de pedido', valor: orderNumber || '—' },
    { etiqueta: 'Tipo', valor: resumen.mesa ? `${resumen.tipo} · ${etiquetaMesa(resumen.mesa)}` : resumen.tipo },
    ...(resumen.sede ? [{ etiqueta: 'Sede', valor: resumen.sede }] : []),
    ...(resumen.programadoPara ? [{ etiqueta: 'Para', valor: momentoPedido(resumen.programadoPara, resumen.zona) }] : []),
    { etiqueta: 'Estado', valor: 'Recibido · por confirmar' },
    { etiqueta: 'Total', valor: resumen.total },
  ]

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${primaryColor}20` }}
          aria-hidden="true"
        >
          <Check className="h-10 w-10" style={{ color: primaryColor }} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Recibimos tu pedido!</h1>
        <p className="text-gray-600 mb-6">
          Te avisaremos por correo a <strong>{customerEmail}</strong> cuando lo confirmen.
        </p>
      </div>

      <dl className="rounded-xl border bg-white divide-y text-sm mb-8">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-gray-500">{f.etiqueta}</dt>
            <dd className="font-medium text-gray-900 text-right">{f.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {seguimiento && (
          <Link href={seguimiento} className="sm:flex-1">
            <Button className="w-full" style={{ backgroundColor: primaryColor }}>
              Seguir mi pedido
            </Button>
          </Link>
        )}
        <Link href={rutaSeguir} className="sm:flex-1">
          <Button variant="outline" className="w-full">
            {isRestaurant ? 'Seguir pidiendo' : 'Seguir comprando'}
          </Button>
        </Link>
      </div>
    </div>
  )
}
