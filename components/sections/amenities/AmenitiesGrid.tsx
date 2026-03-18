interface AmenityItem {
  icon: string
  label: string
  description?: string
}

interface AmenitiesGridProps {
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

export function AmenitiesGrid({ content, primaryColor }: AmenitiesGridProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{content.title}</h2>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: `${primaryColor || '#8B6914'}15` }}
            >
              {ICON_MAP[item.icon] || '⭐'}
            </div>
            <div>
              <h3 className="font-semibold mb-1">{item.label}</h3>
              {item.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
