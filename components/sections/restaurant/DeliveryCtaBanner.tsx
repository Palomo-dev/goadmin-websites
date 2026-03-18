import Link from 'next/link'

interface DeliveryCtaBannerProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    image_url?: string
  }
  primaryColor?: string
}

export function DeliveryCtaBanner({ content, primaryColor }: DeliveryCtaBannerProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex-1">
        <div className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-3" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
          🛵 Domicilios
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2">{content.title || '¿Quieres pedir a domicilio?'}</h2>
        {content.subtitle && <p className="text-gray-600 dark:text-gray-300 mb-4">{content.subtitle}</p>}
        <Link
          href={content.cta_url || '/domicilios'}
          className="inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {content.cta_text || 'Pedir Ahora'}
        </Link>
      </div>
      {content.image_url && (
        <div className="w-full md:w-1/3">
          <img src={content.image_url} alt="Delivery" className="w-full rounded-xl" loading="lazy" />
        </div>
      )}
    </div>
  )
}
