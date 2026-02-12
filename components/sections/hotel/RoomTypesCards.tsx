import Link from 'next/link'

interface RoomTypesCardsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
  }
  primaryColor?: string
  data?: { spaces?: any[]; spaceTypes?: any[] }
}

export function RoomTypesCards({ content, primaryColor, data }: RoomTypesCardsProps) {
  const spaces = data?.spaces || []
  const spaceTypes = data?.spaceTypes || []
  const useSpaces = spaces.length > 0
  const items = (useSpaces ? spaces : spaceTypes).slice(0, content.max_items || 6)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any) => {
            const st = useSpaces ? item.space_types : null
            const label = useSpaces ? item.label : item.name
            const image = useSpaces ? item.primaryImage : item.image_url
            const capacity = useSpaces ? st?.capacity : item.capacity
            const baseRate = Number(useSpaces ? (st?.base_rate || 0) : (item.base_rate || 0))
            const typeName = useSpaces ? st?.name : null
            const floorZone = useSpaces ? item.floor_zone : null
            const services = useSpaces ? (item.services || []) : []

            return (
              <Link key={item.id} href={`/espacios/${item.id}`} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-lg transition-all group">
                <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                  {image ? (
                    <img src={image} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}08 100%)` }}>
                      <span className="text-5xl">�</span>
                    </div>
                  )}
                  {typeName && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}cc` }}>
                      {typeName}
                    </span>
                  )}
                  {useSpaces && (
                    <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                      Disponible
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1">{label}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                    {floorZone && <span>📍 {floorZone}</span>}
                    {capacity && <span>👤 {capacity} personas</span>}
                  </div>
                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {services.slice(0, 3).map((svc: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                          {svc.name}
                        </span>
                      ))}
                      {services.length > 3 && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">+{services.length - 3}</span>}
                    </div>
                  )}
                  {baseRate > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        ${baseRate.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ noche</span>
                      </span>
                      <span className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: primaryColor }}>
                        Ver detalle
                      </span>
                    </div>
                  )}
                </div>
              </Link>
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
