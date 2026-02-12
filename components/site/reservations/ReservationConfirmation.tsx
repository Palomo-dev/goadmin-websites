'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Calendar, MapPin, Copy, Mail, Download } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface ReservationConfirmationProps {
  reservationId: string
  spaceTypeName: string
  checkin: string
  checkout: string
  guestName: string
  guestEmail: string
  total: number
  primaryColor: string
  onNewReservation: () => void
}

export function ReservationConfirmation({
  reservationId,
  spaceTypeName,
  checkin,
  checkout,
  guestName,
  guestEmail,
  total,
  primaryColor,
  onNewReservation
}: ReservationConfirmationProps) {
  const [copied, setCopied] = useState(false)
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CO', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  const copyReservationId = () => {
    navigator.clipboard.writeText(reservationId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto text-center">
      <div 
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <CheckCircle className="h-10 w-10" style={{ color: primaryColor }} />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        ¡Reserva Confirmada!
      </h2>
      <p className="text-gray-600 mb-6">
        Tu reserva ha sido procesada exitosamente. Hemos enviado los detalles a {guestEmail}.
      </p>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          {/* Número de confirmación */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Número de confirmación</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-mono font-bold text-gray-900">
                {reservationId.substring(0, 8).toUpperCase()}
              </span>
              <button
                onClick={copyReservationId}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Copiar"
              >
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 mt-1">¡Copiado!</p>
            )}
          </div>
          
          {/* Detalles */}
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Espacio</p>
                <p className="font-medium text-gray-900">{spaceTypeName}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Fechas</p>
                <p className="font-medium text-gray-900">
                  {formatDate(checkin)} - {formatDate(checkout)}
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total pagado</span>
                <span 
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  ${total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Acciones */}
      <div className="space-y-3">
        <Button
          className="w-full"
          style={{ backgroundColor: primaryColor }}
          asChild
        >
          <Link href="/">
            Volver al inicio
          </Link>
        </Button>
        
        <Button
          variant="outline"
          className="w-full"
          onClick={onNewReservation}
        >
          Hacer otra reserva
        </Button>
      </div>
      
      <p className="text-xs text-gray-500 mt-6">
        Si tienes alguna pregunta sobre tu reserva, contáctanos con tu número de confirmación.
      </p>
    </div>
  )
}
