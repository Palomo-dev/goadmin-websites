'use client'

interface StatsInlineProps {
  content: Record<string, any>
  primaryColor?: string
}

export function StatsInline({ content, primaryColor = '#3B82F6' }: StatsInlineProps) {
  const items = content.items || []

  return (
    <section className="py-10 px-4" style={{ backgroundColor: `${primaryColor}08` }}>
      <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16">
        {items.map((item: any, i: number) => (
          <div key={i} className="text-center">
            <p className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>{item.value}</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
