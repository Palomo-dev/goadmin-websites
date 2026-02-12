import Link from 'next/link'

interface MembershipPlansPricingProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
  data?: { products?: any[] }
}

export function MembershipPlansPricing({ content, primaryColor, data }: MembershipPlansPricingProps) {
  const plans = data?.products || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan: any, i: number) => (
            <div
              key={plan.id || i}
              className={`rounded-2xl border-2 p-6 text-center transition-shadow hover:shadow-lg ${i === 1 ? 'scale-105 shadow-lg' : ''}`}
              style={{ borderColor: i === 1 ? primaryColor : '#E5E7EB' }}
            >
              {i === 1 && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>
                  POPULAR
                </span>
              )}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              {plan.description && <p className="text-gray-500 text-sm mb-4">{plan.description}</p>}
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                  ${plan.price != null ? Number(plan.price).toLocaleString() : '---'}
                </span>
                <span className="text-gray-500">/mes</span>
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
                {content.cta_text || 'Inscribirme'}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">💪</p>
          <p>Planes de membresía próximamente</p>
        </div>
      )}
    </div>
  )
}
