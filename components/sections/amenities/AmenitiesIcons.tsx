interface AmenityItem {
  icon: string
  label: string
  description?: string
}

interface AmenitiesIconsProps {
  content: {
    title?: string
    items?: AmenityItem[]
  }
  primaryColor?: string
}

const ICON_MAP: Record<string, string> = {
  wifi: '📶',
  pool: '🏊',
  restaurant: '🍽️',
  spa: '💆',
  parking: '🅿️',
  gym: '💪',
  bar: '🍸',
  laundry: '👔',
  room_service: '🛎️',
  airport: '✈️',
}

export function AmenitiesIcons({ content, primaryColor }: AmenitiesIconsProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${primaryColor || '#8B6914'}20` }}
            >
              {ICON_MAP[item.icon] || '⭐'}
            </div>
            <span className="font-medium text-sm text-gray-900 dark:text-white">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
