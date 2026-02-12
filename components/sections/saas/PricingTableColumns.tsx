import Link from 'next/link'

interface PricingTableColumnsProps {
  content: {
    title?: string
    subtitle?: string
    plans?: Array<{
      name: string
      price: number | string
      period?: string
      description?: string
      features?: string[]
      cta_text?: string
      cta_url?: string
      is_popular?: boolean
    }>
  }
  primaryColor?: string
}

export function PricingTableColumns({ content, primaryColor }: PricingTableColumnsProps) {
  const plans = content.plans || []

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
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`rounded-2xl border-2 p-6 flex flex-col ${plan.is_popular ? 'scale-105 shadow-xl' : 'hover:shadow-md'} transition-all`}
              style={{ borderColor: plan.is_popular ? primaryColor : '#E5E7EB' }}
            >
              {plan.is_popular && (
                <span className="inline-block self-start px-3 py-1 rounded-full text-xs font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>
                  MÁS POPULAR
                </span>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              {plan.description && <p className="text-gray-500 text-sm mt-1">{plan.description}</p>}
              <div className="my-6">
                <span className="text-4xl font-bold" style={{ color: plan.is_popular ? primaryColor : undefined }}>
                  {typeof plan.price === 'number' ? `$${plan.price.toLocaleString()}` : plan.price}
                </span>
                <span className="text-gray-500">/{plan.period || 'mes'}</span>
              </div>
              {plan.features && plan.features.length > 0 && (
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span style={{ color: primaryColor }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={plan.cta_url || '/checkout'}
                className="block w-full px-6 py-3 rounded-lg font-medium text-center transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: plan.is_popular ? primaryColor : 'transparent',
                  color: plan.is_popular ? 'white' : primaryColor,
                  border: `2px solid ${primaryColor}`,
                }}
              >
                {plan.cta_text || 'Empezar'}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">💰</p>
          <p>Planes y precios próximamente</p>
        </div>
      )}
    </div>
  )
}
