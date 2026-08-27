'use client'

import { Truck, Shield, Package, Star } from 'lucide-react'

export const CONTENT_KEYS = ['items'] as const

const ICON_MAP: Record<string, any> = {
  Truck,
  Shield,
  Package,
  Star,
}

const DEFAULT_BENEFITS = [
  { icon: 'Truck', title: 'Envío rápido', description: '24-48 horas' },
  { icon: 'Shield', title: 'Garantía', description: '30 días' },
  { icon: 'Package', title: 'Empaque seguro', description: 'Protección total' },
  { icon: 'Star', title: 'Calidad', description: '100% original' },
]

interface ProductBenefitsProps {
  content: {
    items?: Array<{ icon?: string; title?: string; description?: string }>
  }
  primaryColor?: string
}

export function ProductBenefits({ content }: ProductBenefitsProps) {
  const items = content.items?.length ? content.items : DEFAULT_BENEFITS

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 border-t dark:border-gray-700">
      {items.map((item, i) => {
        const Icon = ICON_MAP[item.icon || ''] || Star
        const colors = ['green', 'blue', 'purple', 'yellow']
        const color = colors[i % colors.length]
        return (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
              <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
