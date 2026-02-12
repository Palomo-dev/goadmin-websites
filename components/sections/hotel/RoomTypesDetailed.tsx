import Link from 'next/link'

interface RoomTypesDetailedProps {
  content: {
    title?: string
    show_prices?: boolean
    show_amenities?: boolean
    show_capacity?: boolean
  }
  primaryColor?: string
  data?: { spaceTypes?: any[] }
}

export function RoomTypesDetailed({ content, primaryColor, data }: RoomTypesDetailedProps) {
  const spaceTypes = data?.spaceTypes || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{content.title}</h2>
      )}
      {spaceTypes.length > 0 ? (
        <div className="space-y-8">
          {spaceTypes.map((type: any) => (
            <div key={type.id} className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="aspect-[16/10] lg:aspect-auto bg-gray-100">
                {type.image_url ? (
                  <img src={type.image_url} alt={type.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full min-h-[250px] flex items-center justify-center text-gray-300 text-6xl">🏨</div>
                )}
              </div>
              <div className="p-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold mb-2">{type.name}</h3>
                {type.description && <p className="text-gray-600 mb-4">{type.description}</p>}
                <div className="flex flex-wrap gap-4 mb-4">
                  {content.show_capacity && type.capacity && (
                    <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">👤 {type.capacity} personas</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-auto">
                  {content.show_prices && type.base_rate && (
                    <span className="font-bold text-2xl" style={{ color: primaryColor }}>
                      ${Number(type.base_rate).toLocaleString()} <span className="text-sm font-normal text-gray-500">/ noche</span>
                    </span>
                  )}
                  <Link
                    href={`/espacios/${type.id}`}
                    className="px-6 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor || '#8B6914' }}
                  >
                    Ver Detalle
                  </Link>
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
