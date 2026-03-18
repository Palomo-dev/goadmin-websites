'use client'

interface ImageTextTopProps {
  content: Record<string, any>
  primaryColor?: string
}

export function ImageTextTop({ content, primaryColor = '#3B82F6' }: ImageTextTopProps) {
  const { title, body, image_url, cta_text, cta_url } = content

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {image_url && (
          <div className="rounded-xl overflow-hidden aspect-video bg-gray-100 mb-8">
            <img src={image_url} alt={title || ''} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="text-center">
          {title && <h2 className="text-3xl font-bold mb-4">{title}</h2>}
          {body && <div className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: body }} />}
          {cta_text && cta_url && (
            <a href={cta_url} className="inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
              {cta_text}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
