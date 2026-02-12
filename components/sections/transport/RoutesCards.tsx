import Link from 'next/link'

interface RoutesCardsProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
  data?: { routes?: any[] }
}

export function RoutesCards({ content, primaryColor, data }: RoutesCardsProps) {
  const routes = data?.routes || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {routes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routes.map((route: any, i: number) => (
            <div key={route.id || i} className="border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🚌</span>
                <div>
                  {route.code && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      {route.code}
                    </span>
                  )}
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">{route.name}</h3>
              {route.origin_name && route.destination_name && (
                <p className="text-gray-500 text-sm mb-3">
                  {route.origin_name} → {route.destination_name}
                </p>
              )}
              {route.base_fare && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Desde</span>
                  <span className="font-bold text-lg" style={{ color: primaryColor }}>
                    ${Number(route.base_fare).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">🗺️</p>
          <p>Rutas disponibles próximamente</p>
        </div>
      )}
      {content.cta_text && content.cta_url && (
        <div className="text-center mt-8">
          <Link href={content.cta_url} className="inline-block px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: primaryColor }}>
            {content.cta_text}
          </Link>
        </div>
      )}
    </div>
  )
}
