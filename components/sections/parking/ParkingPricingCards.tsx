interface ParkingPricingCardsProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  data?: { rates?: any[] }
}

export function ParkingPricingCards({ content, primaryColor, data }: ParkingPricingCardsProps) {
  const rates = data?.rates || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {rates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {rates.map((rate: any, i: number) => (
            <div key={rate.id || i} className="rounded-xl border dark:border-gray-700 p-6 text-center hover:shadow-md transition-shadow dark:bg-gray-800/50">
              <div className="text-3xl mb-3">
                {rate.vehicle_type === 'car' ? '🚗' : rate.vehicle_type === 'motorcycle' ? '🏍️' : rate.vehicle_type === 'truck' ? '🚛' : '🚗'}
              </div>
              <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">{rate.rate_name || rate.vehicle_type}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                  ${rate.price != null ? Number(rate.price).toLocaleString() : '---'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">/{rate.unit || 'hora'}</span>
              </div>
              {rate.grace_period_min && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{rate.grace_period_min} min de gracia</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">💰</p>
          <p>Tarifas próximamente</p>
        </div>
      )}
    </div>
  )
}
