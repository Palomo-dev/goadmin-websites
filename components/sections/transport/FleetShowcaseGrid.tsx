import type { VehiculoSeccion } from '@/lib/website/datosSecciones'

interface FleetShowcaseGridProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  /** `data.vehicles`: lo carga app/[[...slug]]/page.tsx (lib/website/datosSecciones.ts). */
  data?: { vehicles?: VehiculoSeccion[] }
}

export function FleetShowcaseGrid({ content, primaryColor, data }: FleetShowcaseGridProps) {
  const vehicles = data?.vehicles || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {vehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((v, i) => (
            <div key={v.id || i} className="rounded-xl border dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
              {v.image_url ? (
                <img src={v.image_url} alt={[v.brand, v.model].filter(Boolean).join(' ')} className="w-full h-48 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-5xl">🚌</div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{[v.brand, v.model].filter(Boolean).join(' ') || 'Vehículo'}</h3>
                {v.year && <p className="text-gray-500 dark:text-gray-400 text-sm">Año {v.year}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {v.passenger_capacity && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      👥 {v.passenger_capacity} pasajeros
                    </span>
                  )}
                  {v.vehicle_type && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      {v.vehicle_type}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🚌</p>
          <p>Información de flota próximamente</p>
        </div>
      )}
    </div>
  )
}
