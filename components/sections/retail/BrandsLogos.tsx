interface BrandsLogosProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      name: string
      logo_url?: string
      url?: string
    }>
  }
  primaryColor?: string
}

export function BrandsLogos({ content }: BrandsLogosProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-8">{content.subtitle}</p>
      )}
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {items.map((item, i) => (
            <div key={i} className="grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all">
              {item.logo_url ? (
                <a href={item.url || '#'} target={item.url ? '_blank' : undefined} rel="noopener noreferrer">
                  <img src={item.logo_url} alt={item.name} className="h-10 md:h-12 w-auto object-contain" loading="lazy" />
                </a>
              ) : (
                <span className="text-gray-400 font-medium text-lg">{item.name}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
          <p className="text-3xl mb-2">🏢</p>
          <p>Sin marcas registradas aún</p>
        </div>
      )}
    </div>
  )
}
