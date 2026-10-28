interface ImageTextRightProps {
  content: {
    title?: string
    text?: string
    image_url?: string | null
    image_url_mobile?: string | null
    body?: string
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
}

export function ImageTextRight({ content, primaryColor }: ImageTextRightProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        {content.title && (
          <h2 className="titulo-legado text-2xl md:text-3xl font-bold mb-4 text-gray-900 dark:text-white" style={{ color: primaryColor }}>
            {content.title}
          </h2>
        )}
        {/* «Contenido» (body) y botón, como en «Imagen a la izquierda». Sin body: el texto de siempre. */}
        {content.body ? (
          <div className="text-gray-600 dark:text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: content.body }} />
        ) : content.text ? (
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{content.text}</p>
        ) : null}
        {content.cta_text && content.cta_url && (
          <a href={content.cta_url} className="mt-6 inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor || '#3B82F6' }}>
            {content.cta_text}
          </a>
        )}
      </div>
      <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-[4/3]">
        {content.image_url || content.image_url_mobile ? (
          content.image_url_mobile && content.image_url_mobile !== content.image_url ? (
            <picture className="block h-full w-full">
              <source media="(max-width: 767px)" srcSet={content.image_url_mobile} />
              <img src={content.image_url || content.image_url_mobile} alt={content.title || ''} className="w-full h-full object-cover" loading="lazy" />
            </picture>
          ) : (
            <img src={content.image_url || content.image_url_mobile || ''} alt={content.title || ''} className="w-full h-full object-cover" loading="lazy" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">🖼️</span>
          </div>
        )}
      </div>
    </div>
  )
}
