interface IntegrationsLogosProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      name: string
      logo_url?: string
      url?: string
      category?: string
    }>
  }
  primaryColor?: string
}

export function IntegrationsLogos({ content }: IntegrationsLogosProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {items.map((item, i) => (
            <div key={i} className="grayscale hover:grayscale-0 opacity-50 hover:opacity-100 transition-all" title={item.name}>
              {item.logo_url ? (
                <a href={item.url || '#'} target={item.url ? '_blank' : undefined} rel="noopener noreferrer">
                  <img src={item.logo_url} alt={item.name} className="h-10 md:h-12 w-auto object-contain" loading="lazy" />
                </a>
              ) : (
                <span className="text-gray-400 font-medium border-2 border-dashed rounded-lg px-4 py-2">{item.name}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-3xl mb-2">🔗</p>
          <p>Integraciones próximamente</p>
        </div>
      )}
    </div>
  )
}
