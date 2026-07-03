'use client'

interface StatsCardsProps {
  content: Record<string, any>
  primaryColor?: string
}

export function StatsCards({ content, primaryColor = '#3B82F6' }: StatsCardsProps) {
  const title = content.title
  const items = content.items || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((item: any, i: number) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 text-center hover:shadow-md transition-shadow">
              {item.icon && <p className="text-3xl mb-3">{item.icon}</p>}
              <p className="text-3xl font-bold mb-1" style={{ color: primaryColor }}>{item.value}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
