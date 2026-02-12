import Link from 'next/link'

interface RoomTypesDetailedProps {
  content: {
    title?: string
    show_prices?: boolean
    show_amenities?: boolean
    show_capacity?: boolean
  }
  primaryColor?: string
  data?: { spaces?: any[]; spaceTypes?: any[] }
}

export function RoomTypesDetailed({ content, primaryColor, data }: RoomTypesDetailedProps) {
  const spaces = data?.spaces || []
  const spaceTypes = data?.spaceTypes || []
  const useSpaces = spaces.length > 0
  const items = useSpaces ? spaces : spaceTypes

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{content.title}</h2>
      )}
      {items.length > 0 ? (
        <div className="space-y-8">
          {items.map((item: any) => {
            const st = useSpaces ? item.space_types : null
            const label = useSpaces ? item.label : item.name
            const image = useSpaces ? item.primaryImage : item.image_url
            const capacity = useSpaces ? st?.capacity : item.capacity
            const baseRate = Number(useSpaces ? (st?.base_rate || 0) : (item.base_rate || 0))
            const typeName = useSpaces ? st?.name : null
            const floorZone = useSpaces ? item.floor_zone : null
            const description = item.description
            const services = useSpaces ? (item.services || []) : []

            return (
              <div key={item.id} className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-xl shadow-sm border overflow-hidden group">
                <div className="relative aspect-[16/10] lg:aspect-auto bg-gray-100 overflow-hidden">
                  {image ? (
                    <img src={image} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full min-h-[250px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}08 100%)` }}>
                      <span className="text-6xl">�</span>
                    </div>
                  )}
                  {typeName && (
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}cc` }}>
                      {typeName}
                    </span>
                  )}
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">{label}</h3>
                  {description && <p className="text-gray-600 mb-4 line-clamp-3">{description}</p>}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {floorZone && <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">📍 {floorZone}</span>}
                    {content.show_capacity !== false && capacity && (
                      <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">👤 {capacity} personas</span>
                    )}
                  </div>
                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {services.slice(0, 5).map((svc: any, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                          {svc.name}
                        </span>
                      ))}
                      {services.length > 5 && <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-500">+{services.length - 5}</span>}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    {content.show_prices !== false && baseRate > 0 && (
                      <span className="font-bold text-2xl" style={{ color: primaryColor }}>
                        ${baseRate.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ noche</span>
                      </span>
                    )}
                    <Link
                      href={`/espacios/${item.id}`}
                      className="px-6 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                      style={{ backgroundColor: primaryColor || '#8B6914' }}
                    >
                      Ver Detalle
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p>No hay habitaciones disponibles aún</p>
        </div>
      )}
    </div>
  )
}
