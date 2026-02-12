interface WhyChooseUsIconsProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      icon?: string
      label: string
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
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {items.map((item, i) => (
          <div key={i} className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              {ICON_MAP[item.icon || ''] || '✨'}
            </div>
            <h3 className="font-semibold mb-1">{item.label}</h3>
            {item.description && (
              <p className="text-gray-500 text-sm">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
