'use client'

interface ImageTextLeftProps {
  content: Record<string, any>
  primaryColor?: string
}

export function ImageTextLeft({ content, primaryColor = '#3B82F6' }: ImageTextLeftProps) {
  const { title, body, image_url, cta_text, cta_url } = content

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {image_url && (
          <div className="rounded-xl overflow-hidden aspect-[4/3] bg-gray-100">
            <img src={image_url} alt={title || ''} className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          {title && <h2 className="text-3xl font-bold mb-4">{title}</h2>}
          {body && <div className="text-gray-600 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: body }} />}
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
