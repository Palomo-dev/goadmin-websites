'use client'

interface TextBlockLeftProps {
  content: Record<string, any>
  primaryColor?: string
}

export function TextBlockLeft({ content, primaryColor = '#3B82F6' }: TextBlockLeftProps) {
  const { title, body, show_divider } = content

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {title && <h2 className="text-3xl font-bold mb-4">{title}</h2>}
        {show_divider && <div className="w-16 h-1 rounded mb-6" style={{ backgroundColor: primaryColor }} />}
        {body && <div className="text-gray-600 dark:text-gray-300 leading-relaxed prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: body }} />}
      </div>
    </section>
  )
}
