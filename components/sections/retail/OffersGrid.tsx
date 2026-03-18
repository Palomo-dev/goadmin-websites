import Link from 'next/link'

interface OffersGridProps {
  content: {
    title?: string
    subtitle?: string
    offers?: Array<{
      title: string
      description?: string
      discount?: string
      image_url?: string
      cta_text?: string
      cta_url?: string
      bg_color?: string
    }>
  }
  primaryColor?: string
}

export function OffersGrid({ content, primaryColor }: OffersGridProps) {
  const offers = content.offers || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer, i) => (
            <div key={i} className="rounded-xl overflow-hidden border dark:border-gray-700 hover:shadow-lg transition-shadow">
              {offer.image_url && (
                <img src={offer.image_url} alt={offer.title} className="w-full h-48 object-cover" loading="lazy" />
              )}
              <div className="p-5">
                {offer.discount && (
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>
                    {offer.discount}
                  </span>
                )}
                <h3 className="font-bold text-lg mb-1">{offer.title}</h3>
                {offer.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{offer.description}</p>}
                {offer.cta_text && offer.cta_url && (
                  <Link href={offer.cta_url} className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>
                    {offer.cta_text} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🔥</p>
          <p>No hay ofertas activas en este momento</p>
        </div>
      )}
    </div>
  )
}
