'use client'

interface TestimonialsMinimalProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TestimonialsMinimal({ content, primaryColor = '#3B82F6' }: TestimonialsMinimalProps) {
  const title = content.title
  const items = content.items || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="space-y-6">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-1 flex-shrink-0 rounded-full self-stretch" style={{ backgroundColor: primaryColor }} />
              <div>
                <p className="text-gray-700 mb-1">{item.text}</p>
                <p className="text-sm text-gray-500 font-medium">{item.name}{item.role ? ` · ${item.role}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
