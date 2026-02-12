'use client'

interface TestimonialsQuotesProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TestimonialsQuotes({ content, primaryColor = '#3B82F6' }: TestimonialsQuotesProps) {
  const title = content.title || 'Lo que dicen nuestros clientes'
  const items = content.items || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-12">{title}</h2>}
        <div className="space-y-10">
          {items.map((item: any, i: number) => (
            <blockquote key={i} className="text-center">
              <span className="text-5xl font-serif leading-none" style={{ color: primaryColor }}>"</span>
              <p className="text-xl md:text-2xl text-gray-700 italic mb-4">{item.text}</p>
              <footer className="text-sm text-gray-500">
                — <strong>{item.name}</strong>{item.role ? `, ${item.role}` : ''}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
