'use client'

interface FaqSimpleProps {
  content: Record<string, any>
  primaryColor?: string
}

export function FaqSimple({ content, primaryColor = '#3B82F6' }: FaqSimpleProps) {
  const title = content.title || 'Preguntas Frecuentes'
  const items = content.items || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="space-y-8">
          {items.map((item: any, i: number) => (
            <div key={i}>
              <h3 className="font-semibold text-lg mb-2">{item.question}</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
