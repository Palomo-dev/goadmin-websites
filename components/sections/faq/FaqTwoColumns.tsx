'use client'

interface FaqTwoColumnsProps {
  content: Record<string, any>
  primaryColor?: string
}

export function FaqTwoColumns({ content, primaryColor = '#3B82F6' }: FaqTwoColumnsProps) {
  const title = content.title || 'Preguntas Frecuentes'
  const items = content.items || []
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)

  const renderItem = (item: any, i: number) => (
    <div key={i} className="mb-6">
      <h3 className="font-semibold mb-1" style={{ color: primaryColor }}>{item.question}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm">{item.answer}</p>
    </div>
  )

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-12">{title}</h2>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
          <div>{left.map(renderItem)}</div>
          <div>{right.map(renderItem)}</div>
        </div>
      </div>
    </section>
  )
}
