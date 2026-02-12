import Link from 'next/link'

interface BookingTransportBannerProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    whatsapp_number?: string
  }
  primaryColor?: string
  organization?: any
}

export function BookingTransportBanner({ content, primaryColor, organization }: BookingTransportBannerProps) {
  const whatsapp = content.whatsapp_number || organization?.phone
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, quiero reservar un viaje')}` : null

  return (
    <div className="text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-3">{content.title || '¿Listo para viajar?'}</h2>
      {content.subtitle && <p className="text-gray-600 mb-6">{content.subtitle}</p>}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href={content.cta_url || '/viajes'}
          className="px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {content.cta_text || 'Comprar Pasaje'}
        </Link>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-lg font-medium border-2 hover:bg-green-50 transition-colors"
            style={{ borderColor: '#25D366', color: '#25D366' }}
          >
            💬 WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
