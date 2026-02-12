'use client'

interface MapWithDirectionsProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
}

export function MapWithDirections({ content, organization, primaryColor = '#3B82F6' }: MapWithDirectionsProps) {
  const title = content.title || 'Cómo Llegar'
  const address = organization?.address || content.address || ''
  const city = organization?.city || ''
  const fullAddress = [address, city, organization?.state].filter(Boolean).join(', ')
  const query = encodeURIComponent(fullAddress)

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{title}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-xl overflow-hidden min-h-[400px]">
          {fullAddress ? (
            <iframe
              src={`https://maps.google.com/maps?q=${query}&output=embed`}
              className="w-full h-full min-h-[400px] border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="w-full h-full min-h-[400px] bg-gray-100 flex items-center justify-center text-gray-400">
              No hay dirección configurada
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          {fullAddress && (
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-2">Nuestra Ubicación</h3>
              <p className="text-gray-600">{fullAddress}</p>
            </div>
          )}
          {content.directions && (
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-2">Indicaciones</h3>
              <div className="text-gray-600 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content.directions }} />
            </div>
          )}
          {fullAddress && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity w-fit"
              style={{ backgroundColor: primaryColor }}
            >
              <span>📍</span>
              Abrir en Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
