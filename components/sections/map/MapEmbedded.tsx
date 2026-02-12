'use client'

interface MapEmbeddedProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
}

export function MapEmbedded({ content, organization, primaryColor = '#3B82F6' }: MapEmbeddedProps) {
  const title = content.title || 'Encuéntranos'
  const address = organization?.address || content.address || ''
  const query = encodeURIComponent(address)

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{title}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 rounded-xl overflow-hidden min-h-[350px]">
          {address ? (
            <iframe
              src={`https://maps.google.com/maps?q=${query}&output=embed`}
              className="w-full h-full min-h-[350px] border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="w-full h-full min-h-[350px] bg-gray-100 flex items-center justify-center text-gray-400">
              No hay dirección configurada
            </div>
          )}
        </div>
        <div className="space-y-6">
          {content.show_address !== false && address && (
            <div>
              <h3 className="font-semibold mb-1">Dirección</h3>
              <p className="text-gray-600 text-sm">{address}</p>
              {organization?.city && <p className="text-gray-600 text-sm">{organization.city}, {organization?.state}</p>}
            </div>
          )}
          {content.show_hours !== false && organization?.website_settings?.business_hours && (
            <div>
              <h3 className="font-semibold mb-1">Horario</h3>
              <p className="text-gray-600 text-sm">{JSON.stringify(organization.website_settings.business_hours)}</p>
            </div>
          )}
          {organization?.phone && (
            <div>
              <h3 className="font-semibold mb-1">Teléfono</h3>
              <p className="text-gray-600 text-sm">{organization.phone}</p>
            </div>
          )}
          {organization?.email && (
            <div>
              <h3 className="font-semibold mb-1">Email</h3>
              <p className="text-gray-600 text-sm">{organization.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
