'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OrderConfirmationProps {
  orderNumber: string | null
  customerEmail: string
  primaryColor: string
}

/**
 * Confirmación de un pedido con pago fuera de línea (efectivo, transferencia…). Extraída de
 * CheckoutWizard sin cambios de comportamiento.
 */
export function OrderConfirmation({ orderNumber, customerEmail, primaryColor }: OrderConfirmationProps) {
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
        <Link href="/productos">
          <Button style={{ backgroundColor: primaryColor }}>
            Seguir comprando
          </Button>
        </Link>
      </div>
    </div>
  )
}
