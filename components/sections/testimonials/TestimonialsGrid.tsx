'use client'

interface TestimonialsGridProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TestimonialsGrid({ content, primaryColor = '#3B82F6' }: TestimonialsGridProps) {
  const title = content.title || 'Lo que dicen nuestros clientes'
  const items = content.items || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-12">{title}</h2>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any, i: number) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 flex flex-col">
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: item.rating || 5 }).map((_, s) => (
                  <span key={s} className="text-yellow-400">★</span>
                ))}
              </div>
              <p className="text-gray-600 dark:text-gray-300 flex-1 mb-4 italic">"{item.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t dark:border-gray-700">
                {item.avatar_url ? (
                  <img src={item.avatar_url} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                    {item.name?.[0] || '?'}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  {item.role && <p className="text-xs text-gray-500 dark:text-gray-400">{item.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
