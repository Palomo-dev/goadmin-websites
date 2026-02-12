interface ServicesListCardsProps {
  content: {
    title?: string
    subtitle?: string
  }
  organization: any
  primaryColor?: string
  data?: { services?: any[] }
}

export function ServicesListCards({ content, primaryColor, data }: ServicesListCardsProps) {
  const services = data?.services || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service: any, i: number) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg mb-2" style={{ color: primaryColor }}>{service.name}</h3>
              {service.description && <p className="text-gray-600 text-sm mb-3">{service.description}</p>}
              {service.price && (
                <p className="font-bold text-lg">${service.price.toLocaleString()}</p>
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
