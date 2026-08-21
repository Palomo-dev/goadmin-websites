import Link from 'next/link'

interface ParkingPassPlansCardsProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
  data?: { passTypes?: any[] }
}

export function ParkingPassPlansCards({ content, primaryColor, data }: ParkingPassPlansCardsProps) {
  const plans = data?.passTypes || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan: any, i: number) => (
            <div
              key={plan.id || i}
              className={`rounded-2xl border-2 p-6 text-center transition-shadow hover:shadow-lg dark:bg-gray-800/50 dark:border-gray-600 ${i === 1 ? 'scale-105 shadow-lg' : ''}`}
              style={{ borderColor: i === 1 ? primaryColor : undefined }}
            >
              {i === 1 && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>
                  RECOMENDADO
                </span>
              )}
              <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">{plan.name}</h3>
              {plan.duration_days && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{plan.duration_days} días</p>
              )}
              <div className="mb-4">
                <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                  ${plan.price != null ? Number(plan.price).toLocaleString('es-CO') : '---'}
                </span>
              </div>
              <div className="space-y-2 text-sm text-left mb-6 text-gray-700 dark:text-gray-300">
                {plan.includes_car_wash && (
                  <p className="flex items-center gap-2"><span style={{ color: primaryColor }}>✓</span> Lavado incluido</p>
                )}
                {plan.includes_valet && (
                  <p className="flex items-center gap-2"><span style={{ color: primaryColor }}>✓</span> Valet parking</p>
                )}
                {plan.max_entries_per_day && (
                  <p className="flex items-center gap-2"><span style={{ color: primaryColor }}>✓</span> {plan.max_entries_per_day} entradas/día</p>
                )}
              </div>
              <Link
                href={content.cta_url || '/checkout'}
                className="block w-full px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: i === 1 ? primaryColor : 'transparent',
                  color: i === 1 ? 'white' : primaryColor,
                  border: `2px solid ${primaryColor}`,
                }}
              >
                {content.cta_text || 'Comprar Pase'}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🎫</p>
          <p>Planes de pase próximamente</p>
        </div>
      )}
    </div>
  )
}
