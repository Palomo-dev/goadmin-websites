'use client'

import { Truck, Store, UtensilsCrossed } from 'lucide-react'

export type OrderType = 'delivery' | 'pickup' | 'dine_in'

interface OrderTypeSelectorProps {
  value: OrderType
  onChange: (type: OrderType) => void
  primaryColor: string
  enableDelivery?: boolean
  enablePickup?: boolean
  enableDineIn?: boolean
}

const ORDER_TYPES: { id: OrderType; label: string; description: string; icon: typeof Truck }[] = [
  { id: 'delivery', label: 'Domicilio', description: 'Te lo llevamos a tu dirección', icon: Truck },
  { id: 'pickup', label: 'Recoger', description: 'Recógelo en el local', icon: Store },
  { id: 'dine_in', label: 'Comer aquí', description: 'Disfruta en nuestro restaurante', icon: UtensilsCrossed },
]

export function OrderTypeSelector({
  value, onChange, primaryColor,
  enableDelivery = true, enablePickup = true, enableDineIn = true
}: OrderTypeSelectorProps) {
  const enabledTypes = ORDER_TYPES.filter(t => {
    if (t.id === 'delivery') return enableDelivery
    if (t.id === 'pickup') return enablePickup
    if (t.id === 'dine_in') return enableDineIn
    return true
  })

  if (enabledTypes.length <= 1) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Tipo de pedido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {enabledTypes.map(type => {
          const isSelected = value === type.id
          const Icon = type.icon
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onChange(type.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-current shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={isSelected ? { borderColor: primaryColor } : {}}
            >
              <Icon
                className="h-6 w-6 mb-2"
                style={{ color: isSelected ? primaryColor : '#9CA3AF' }}
              />
              <p className={`font-semibold text-sm ${isSelected ? '' : 'text-gray-700'}`}
                style={isSelected ? { color: primaryColor } : {}}
              >
                {type.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
