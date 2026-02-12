'use client'

interface PartnersCardsProps {
  content: Record<string, any>
  primaryColor?: string
}

export function PartnersCards({ content, primaryColor = '#3B82F6' }: PartnersCardsProps) {
  const title = content.title || 'Nuestros Aliados'
  const items = content.items || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded-xl border p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
              {item.logo_url ? (
                <img src={item.logo_url} alt={item.name} className="w-16 h-16 object-contain flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                  {item.name?.[0] || '?'}
                </div>
              )}
              <div>
                <p className="font-semibold">{item.name}</p>
                {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
