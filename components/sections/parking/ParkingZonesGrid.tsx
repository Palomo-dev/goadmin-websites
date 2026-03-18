interface ParkingZonesGridProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  data?: { zones?: any[] }
}

export function ParkingZonesGrid({ content, primaryColor, data }: ParkingZonesGridProps) {
  const zones = data?.zones || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {zones.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map((zone: any, i: number) => (
            <div key={zone.id || i} className="rounded-xl border-2 p-6 hover:shadow-md transition-shadow" style={{ borderColor: zone.is_vip ? primaryColor : '#E5E7EB' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xl">{zone.name}</h3>
                {zone.is_vip && (
                  <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: primaryColor }}>VIP</span>
                )}
              </div>
              {zone.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{zone.description}</p>}
              <div className="flex flex-wrap gap-2 mb-4">
                {zone.is_covered && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">🏠 Cubierto</span>
                )}
                {zone.capacity && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">🅿️ {zone.capacity} espacios</span>
                )}
              </div>
              {zone.rate_multiplier && zone.rate_multiplier !== 1 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Tarifa: x{zone.rate_multiplier}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🅿️</p>
          <p>Zonas de estacionamiento próximamente</p>
        </div>
      )}
    </div>
  )
}
