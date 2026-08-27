'use client'

import { Truck, RotateCcw, Clock, MapPin } from 'lucide-react'
import { buildCardStyle } from '@/lib/sectionStyle'

interface ProductShippingProps {
  content: Record<string, any>
  data?: Record<string, any>
  primaryColor?: string
}

export function ProductShipping({ content }: ProductShippingProps) {
  const title = content.title || 'Envío y devoluciones'
  const showDeliveryTime = content.show_delivery_time ?? true
  const showShippingCost = content.show_shipping_cost ?? true
  const showReturnPolicy = content.show_return_policy ?? true
  const customMessage = content.custom_message || ''
  const columns = Number(content.columns ?? 2)
  const gap = content.gap ?? 16

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-2'

  const smGridColsClass = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
  }[columns] || 'sm:grid-cols-2'

  const { className: cardClassName, style: cardStyle } = buildCardStyle(content)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>

      <div className={`grid grid-cols-1 ${smGridColsClass}`} style={{ gap: `${gap}px` }}>
        {showDeliveryTime && (
          <div className={`flex items-start gap-3 p-4 border rounded-lg dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
            <Clock className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Tiempo de entrega</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">24-48 horas hábiles</p>
            </div>
          </div>
        )}

        {showShippingCost && (
          <div className={`flex items-start gap-3 p-4 border rounded-lg dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
            <Truck className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Costo de envío</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Calculado al finalizar la compra</p>
            </div>
          </div>
        )}

        {showReturnPolicy && (
          <div className={`flex items-start gap-3 p-4 border rounded-lg dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
            <RotateCcw className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Devoluciones</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">30 días para devoluciones</p>
            </div>
          </div>
        )}

        <div className={`flex items-start gap-3 p-4 border rounded-lg dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
          <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Cobertura</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Envíos a todo el país</p>
          </div>
        </div>
      </div>

      {customMessage && (
        <p className="text-sm text-gray-600 dark:text-gray-300">{customMessage}</p>
      )}
    </div>
  )
}
