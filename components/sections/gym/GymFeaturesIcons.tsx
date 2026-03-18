interface GymFeaturesIconsProps {
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
  weights: '🏋️', cardio: '🏃', pool: '🏊', yoga: '🧘',
  boxing: '🥊', spinning: '🚴', sauna: '🧖', parking: '🅿️',
  wifi: '📶', locker: '🔐', shower: '🚿', nutrition: '🥗',
  personal: '👤', group: '👥', recovery: '💆', equipment: '⚙️',
}

export function GymFeaturesIcons({ content, primaryColor }: GymFeaturesIconsProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((item, i) => (
          <div key={i} className="text-center p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              {ICON_MAP[item.icon || ''] || '💪'}
            </div>
            <h3 className="font-semibold mb-1">{item.label}</h3>
            {item.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
