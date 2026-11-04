'use client'

import { Truck, Shield, Package, Star } from 'lucide-react'
import { buildCardStyle } from '@/lib/sectionStyle'

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

/**
 * Tonos de los íconos, en orden. Clases literales (no `bg-${color}-100`): Tailwind solo genera
 * las clases que ve escritas en el código.
 */
const TONOS = [
  { fondo: 'bg-green-100 dark:bg-green-900/30', icono: 'text-green-600 dark:text-green-400' },
  { fondo: 'bg-blue-100 dark:bg-blue-900/30', icono: 'text-blue-600 dark:text-blue-400' },
  { fondo: 'bg-purple-100 dark:bg-purple-900/30', icono: 'text-purple-600 dark:text-purple-400' },
  { fondo: 'bg-yellow-100 dark:bg-yellow-900/30', icono: 'text-yellow-600 dark:text-yellow-400' },
]

interface ProductBenefitsProps {
  content: {
    items?: Array<{ icon?: string; title?: string; description?: string }>
    columns?: number
    gap?: number
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: { restaurante?: unknown }
}

/**
 * Beneficios de la ficha (envío, garantía…). Sin opciones pinta exactamente la franja de siempre:
 * rejilla de 2 columnas con separador superior. `columns`, `gap` e `items` la ajustan; el estilo
 * de tarjeta (`card_*`) solo se aplica si el contenido trae alguna clave `card_`.
 */
export function ProductBenefits({ content, data }: ProductBenefitsProps) {
  // Restaurante sin beneficios propios: los de e-commerce («Envío rápido 24-48 horas»,
  // «Garantía 30 días») no aplican a un plato. Con ítems configurados, se pintan.
  if (data?.restaurante && !content.items?.length) return null
  const items = content.items?.length ? content.items : DEFAULT_BENEFITS
  const columns = content.columns ?? 2

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-2'

  const conEstiloTarjeta = Object.keys(content).some((clave) => clave.startsWith('card_'))
  const { className: cardClassName, style: cardStyle } = conEstiloTarjeta
    ? buildCardStyle(content)
    : { className: '', style: undefined }
  const claseItem = ['flex items-center gap-3', cardClassName].filter(Boolean).join(' ')
  const gapPropio = typeof content.gap === 'number'

  return (
    <div
      className={`grid ${gridColsClass} ${gapPropio ? '' : 'gap-4 '}pt-6 border-t dark:border-gray-700`}
      style={gapPropio ? { gap: `${content.gap}px` } : undefined}
    >
      {items.map((item, i) => {
        const Icon = ICON_MAP[item.icon || ''] || Star
        const tono = TONOS[i % TONOS.length]
        return (
          <div key={i} className={claseItem} style={cardStyle}>
            <div className={`w-10 h-10 rounded-full ${tono.fondo} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${tono.icono}`} />
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
