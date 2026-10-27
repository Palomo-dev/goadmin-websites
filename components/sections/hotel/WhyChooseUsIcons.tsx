import { icons } from 'lucide-react'
import { DynamicLucideIcon } from '../products/DynamicLucideIcon'

interface WhyChooseUsIconsProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      icon?: string
      label?: string
      /** El editor v2 guarda `title` (no `label`). */
      title?: string
      description?: string
    }>
  }
  primaryColor?: string
}

const ICON_MAP: Record<string, string> = {
  location: '📍', security: '🔒', wifi: '📶', breakfast: '🍳',
  pool: '🏊', spa: '💆', parking: '🅿️', restaurant: '🍽️',
  gym: '💪', bar: '🍸', concierge: '🛎️', view: '🏞️',
  family: '👨‍👩‍👧‍👦', pet: '🐾', eco: '🌿', premium: '⭐',
}

export function WhyChooseUsIcons({ content, primaryColor }: WhyChooseUsIconsProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {items.map((item, i) => (
          <div key={i} className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              {ICON_MAP[item.icon || '']
                ?? (item.icon && (icons as Record<string, unknown>)[item.icon]
                  ? <DynamicLucideIcon name={item.icon} className="h-7 w-7" style={{ color: primaryColor }} aria-hidden />
                  : '✨')}
            </div>
            {(item.label || item.title) && (
              <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">{item.label || item.title}</h3>
            )}
            {item.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
