interface CoverageMapStaticProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  data?: { stops?: any[] }
  organization?: any
}

export function CoverageMapStatic({ content, primaryColor, data, organization }: CoverageMapStaticProps) {
  const stops = data?.stops || []
  const address = organization?.address || ''

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="rounded-xl overflow-hidden h-[400px]">
            <iframe
              title="Mapa de cobertura"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(address)}`}
            />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Paradas / Terminales</h3>
          {stops.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto">
              {stops.map((stop: any, i: number) => (
                <div key={stop.id || i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{stop.name}</p>
                    {stop.city && <p className="text-gray-500 dark:text-gray-400 text-sm">{stop.city}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-sm border-2 border-dashed dark:border-gray-700 rounded-lg p-6 text-center">
              <p>📍 Paradas próximamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
