import Link from 'next/link'

interface PromoBannersGridProps {
  content: {
    title?: string
    banners?: Array<{
      title: string
      subtitle?: string
      image_url?: string
      cta_text?: string
      cta_url?: string
      bg_color?: string
    }>
  }
  primaryColor?: string
}

export function PromoBannersGrid({ content, primaryColor }: PromoBannersGridProps) {
  const banners = content.banners || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{content.title}</h2>
      )}
      {banners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner, i) => (
            <div
              key={i}
              className="relative rounded-2xl overflow-hidden min-h-[200px] flex items-center p-8"
              style={{ backgroundColor: banner.bg_color || primaryColor }}
            >
              {banner.image_url && (
                <img src={banner.image_url} alt={banner.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              )}
              <div className="relative z-10 text-white">
                <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
                {banner.subtitle && <p className="mb-4 opacity-90">{banner.subtitle}</p>}
                {banner.cta_text && banner.cta_url && (
                  <Link href={banner.cta_url} className="inline-block px-5 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                    {banner.cta_text}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay promociones activas</p>
        </div>
      )}
    </div>
  )
}
