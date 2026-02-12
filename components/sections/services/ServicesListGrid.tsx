'use client'

interface ServicesListGridProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
  data?: { services?: any[] }
}

export function ServicesListGrid({ content, primaryColor = '#3B82F6', data }: ServicesListGridProps) {
  const title = content.title || 'Nuestros Servicios'
  const subtitle = content.subtitle
  const services = data?.services || []

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{title}</h2>}
      {subtitle && <p className="text-gray-600 text-center mb-10">{subtitle}</p>}
      {services.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border p-6 text-center hover:shadow-md transition-shadow">
              {service.icon && <p className="text-3xl mb-3">{service.icon}</p>}
              <h3 className="font-semibold text-lg mb-2">{service.name}</h3>
              {service.description && <p className="text-gray-600 text-sm mb-3">{service.description}</p>}
              {service.price && (
                <p className="font-bold text-lg" style={{ color: primaryColor }}>${service.price.toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p>No hay servicios configurados aún</p>
        </div>
      )}
    </div>
  )
}
