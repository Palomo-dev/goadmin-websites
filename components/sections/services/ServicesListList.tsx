'use client'

import { PrecioAnterior } from '@/components/site/PrecioAnterior'
import { mostrarPrecioAnterior, precioAnteriorValido } from '@/lib/products/precioAnterior'

interface ServicesListListProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
  data?: { services?: any[] }
}

export function ServicesListList({ content, primaryColor = '#3B82F6', data }: ServicesListListProps) {
  const title = content.title || 'Nuestros Servicios'
  const subtitle = content.subtitle
  const services = data?.services || []
  // «Mostrar descripción» del inspector. Ausente = se muestra, como antes de leerlo.
  const showDescription = (content as { show_description?: unknown }).show_description !== false
  // «Mostrar precio tachado»: el `compare_price` real del precio vigente. Ausente = sin tachar.
  const showCompare = mostrarPrecioAnterior(content as Record<string, unknown>)

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{title}</h2>}
      {subtitle && <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{subtitle}</p>}
      {services.length > 0 ? (
        <div className="max-w-3xl mx-auto space-y-4">
          {services.map((service: any, i: number) => (
            <div key={i} className="flex items-start gap-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: primaryColor }} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{service.name}</h3>
                {showDescription && service.description && <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{service.description}</p>}
              </div>
              {service.price && (showCompare && precioAnteriorValido(service.compare_price, service.price) !== null ? (
                <div className="flex-shrink-0 text-right">
                  <PrecioAnterior className="block text-sm">${Number(service.compare_price).toLocaleString('es-CO')}</PrecioAnterior>
                  <p className="font-bold text-lg" style={{ color: primaryColor }}>${service.price.toLocaleString('es-CO')}</p>
                </div>
              ) : (
                <p className="font-bold text-lg flex-shrink-0" style={{ color: primaryColor }}>${service.price.toLocaleString('es-CO')}</p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p>No hay servicios configurados aún</p>
        </div>
      )}
    </div>
  )
}
