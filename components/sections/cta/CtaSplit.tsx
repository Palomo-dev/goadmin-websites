'use client'

interface CtaSplitProps {
  content: Record<string, any>
  primaryColor?: string
}

export function CtaSplit({ content, primaryColor = '#3B82F6' }: CtaSplitProps) {
  const { title, subtitle, cta_text, cta_url } = content

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-8 md:p-12">
        <div>
          {title && <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900 dark:text-white">{title}</h2>}
          {subtitle && <p className="text-gray-600 dark:text-gray-300">{subtitle}</p>}
        </div>
        {cta_text && cta_url && (
          <a href={cta_url} className="flex-shrink-0 px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
            {cta_text}
          </a>
        )}
      </div>
    </section>
  )
}
