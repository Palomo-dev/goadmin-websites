'use client'

interface ServicesListIconsRowProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
  data?: { services?: any[] }
}

export function ServicesListIconsRow({ content, primaryColor = '#3B82F6', data }: ServicesListIconsRowProps) {
  const title = content.title || 'Nuestros Servicios'
  const services = data?.services || []

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
      {services.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {services.map((service: any, i: number) => (
            <div key={i} className="flex flex-col items-center gap-2 w-28">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl"
                style={{ backgroundColor: primaryColor }}
              >
                {service.icon || service.name?.charAt(0) || '★'}
              </div>
              <span className="text-sm font-medium text-center leading-tight text-gray-900 dark:text-white">{service.name}</span>
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
