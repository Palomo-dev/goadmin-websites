interface ParkingAvailabilitySummaryProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  data?: { zones?: any[]; spaces?: any[] }
}

export function ParkingAvailabilitySummary({ content, primaryColor, data }: ParkingAvailabilitySummaryProps) {
  const zones = data?.zones || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {zones.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone: any, i: number) => {
            const total = zone.capacity || 0
            const available = zone.available_spaces ?? total
            const pct = total > 0 ? Math.round((available / total) * 100) : 0
            const barColor = pct > 50 ? '#22C55E' : pct > 20 ? '#F59E0B' : '#EF4444'

            return (
              <div key={zone.id || i} className="border dark:border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{zone.name}</h3>
                  {zone.is_vip && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: primaryColor }}>VIP</span>
                  )}
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-bold" style={{ color: barColor }}>{available}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">/ {total} espacios</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pct}% disponible</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📊</p>
          <p>Disponibilidad en tiempo real próximamente</p>
        </div>
      )}
    </div>
  )
}
