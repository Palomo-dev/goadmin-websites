interface FeaturesGridAlternatingProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      icon?: string
      label: string
      description?: string
      image_url?: string
    }>
  }
  primaryColor?: string
}

export function FeaturesGridAlternating({ content, primaryColor }: FeaturesGridAlternatingProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-12">{content.subtitle}</p>
      )}
      <div className="space-y-16 max-w-5xl mx-auto">
        {items.map((item, i) => (
          <div key={i} className={`flex flex-col md:flex-row items-center gap-8 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
            <div className="flex-1">
              {item.icon && (
                <span className="inline-block w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                  {item.icon}
                </span>
              )}
              <h3 className="text-xl font-bold mb-2">{item.label}</h3>
              {item.description && (
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              )}
            </div>
            <div className="flex-1 w-full">
              {item.image_url ? (
                <img src={item.image_url} alt={item.label} className="w-full rounded-xl shadow-lg" loading="lazy" />
              ) : (
                <div className="w-full aspect-video rounded-xl flex items-center justify-center text-5xl" style={{ backgroundColor: `${primaryColor}08` }}>
                  💻
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
