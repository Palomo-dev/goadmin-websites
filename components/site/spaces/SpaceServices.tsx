interface SpaceServicesProps {
  services: { name: string; icon?: string | null }[]
  amenities?: Record<string, boolean> | null
  primaryColor: string
}

export function SpaceServices({ services, amenities, primaryColor }: SpaceServicesProps) {
  if (services.length > 0) {
    return (
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Servicios incluidos</h3>
        <div className="grid grid-cols-2 gap-2">
          {services.map((svc, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: `${primaryColor}06` }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
              <span className="text-sm text-gray-700">{svc.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (amenities && Object.keys(amenities).length > 0) {
    return (
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Amenidades</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(amenities).map(([key, value]) => (
            value && (
              <span key={key} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                {key}
              </span>
            )
          ))}
        </div>
      </div>
    )
  }

  return null
}
