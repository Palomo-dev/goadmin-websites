interface TransformationBeforeAfterProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      name: string
      before_url?: string
      after_url?: string
      description?: string
      duration?: string
    }>
  }
  primaryColor?: string
}

export function TransformationBeforeAfter({ content, primaryColor }: TransformationBeforeAfterProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border dark:border-gray-700 overflow-hidden">
              <div className="grid grid-cols-2">
                <div className="relative">
                  {item.before_url ? (
                    <img src={item.before_url} alt="Antes" className="w-full h-48 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">Antes</div>
                  )}
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">ANTES</span>
                </div>
                <div className="relative">
                  {item.after_url ? (
                    <img src={item.after_url} alt="Después" className="w-full h-48 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">Después</div>
                  )}
                  <span className="absolute bottom-2 right-2 text-white text-xs px-2 py-1 rounded" style={{ backgroundColor: primaryColor }}>DESPUÉS</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                {item.duration && <p className="text-sm" style={{ color: primaryColor }}>{item.duration}</p>}
                {item.description && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">💪</p>
          <p>Transformaciones próximamente</p>
        </div>
      )}
    </div>
  )
}
