'use client'

import { PrecioAnterior } from '@/components/site/PrecioAnterior'
import { mostrarPrecioAnterior, precioAnteriorValido } from '@/lib/products/precioAnterior'
import { serviciosParaPintar } from '@/lib/website/serviciosSeccion'
import { EnlaceServicio, FotoServicio, IconoServicio } from './pintarServicio'

interface ServicesListGridProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
  data?: { services?: any[] }
}

export function ServicesListGrid({ content, primaryColor = '#3B82F6', data }: ServicesListGridProps) {
  const title = content.title || 'Nuestros Servicios'
  const subtitle = content.subtitle
  const services = serviciosParaPintar(content, data?.services)
  // «Mostrar descripción» del inspector. Ausente = se muestra, como antes de leerlo.
  const showDescription = (content as { show_description?: unknown }).show_description !== false
  // «Mostrar precio tachado»: el `compare_price` real del precio vigente. Ausente = sin tachar.
  const showCompare = mostrarPrecioAnterior(content as Record<string, unknown>)

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{title}</h2>}
      {subtitle && <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{subtitle}</p>}
      {services.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service: any, i: number) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 text-center hover:shadow-md transition-shadow">
              <FotoServicio url={service.image_url} alt={service.name} />
              {service.icon && (
                <div className="mb-3 flex justify-center">
                  <IconoServicio name={service.icon} className="h-8 w-8" />
                </div>
              )}
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{service.name}</h3>
              {showDescription && service.description && <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{service.description}</p>}
              {service.price && showCompare && precioAnteriorValido(service.compare_price, service.price) !== null && (
                <PrecioAnterior className="block text-sm">${Number(service.compare_price).toLocaleString('es-CO')}</PrecioAnterior>
              )}
              {service.price && (
                <p className="font-bold text-lg" style={{ color: primaryColor }}>${service.price.toLocaleString('es-CO')}</p>
              )}
              <EnlaceServicio texto={service.cta_text} url={service.cta_url} color={primaryColor} />
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
