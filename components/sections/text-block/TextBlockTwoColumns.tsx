'use client'

interface TextBlockTwoColumnsProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TextBlockTwoColumns({ content, primaryColor = '#3B82F6' }: TextBlockTwoColumnsProps) {
  const { title, body, show_divider } = content

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-4 text-gray-900 dark:text-white">{title}</h2>}
        {show_divider && <div className="w-16 h-1 rounded mx-auto mb-8" style={{ backgroundColor: primaryColor }} />}
        {body && (
          <div className="columns-1 md:columns-2 gap-12 text-gray-600 dark:text-gray-300 leading-relaxed prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: body }} />
        )}
      </div>
    </section>
  )
}
