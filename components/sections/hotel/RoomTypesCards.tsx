interface RoomTypesCardsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
  }
  primaryColor?: string
  data?: { spaceTypes?: any[] }
}

export function RoomTypesCards({ content, primaryColor, data }: RoomTypesCardsProps) {
  const spaceTypes = (data?.spaceTypes || []).slice(0, content.max_items || 6)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {spaceTypes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaceTypes.map((type: any) => (
            <div key={type.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow group">
              <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
                {type.image_url ? (
                  <img src={type.image_url} alt={type.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">🏨</div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-lg mb-1">{type.name}</h3>
                {type.description && <p className="text-gray-500 text-sm mb-3 line-clamp-2">{type.description}</p>}
                <div className="flex items-center justify-between">
                  {type.base_rate && (
                    <span className="font-bold text-lg" style={{ color: primaryColor }}>
                      ${Number(type.base_rate).toLocaleString()} <span className="text-sm font-normal text-gray-500">/ noche</span>
                    </span>
                  )}
                  {type.capacity && (
                    <span className="text-sm text-gray-500">👤 {type.capacity} personas</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p>No hay tipos de habitación configurados aún</p>
        </div>
      )}
    </div>
  )
}
