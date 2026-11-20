'use client'

interface ImageTextLeftProps {
  content: Record<string, any>
  primaryColor?: string
}

export function ImageTextLeft({ content, primaryColor = '#3B82F6' }: ImageTextLeftProps) {
  const { title, body, image_url, image_url_mobile, cta_text, cta_url } = content
  // Fondo de color con «Color del texto» (Marea: azul noche con texto claro): el título y el texto
  // toman ese color. Antes las clases grises lo pisaban y el título salía oscuro sobre el azul.
  // Sin fondo de color o sin un hex válido, las clases de siempre.
  const colorTexto = content.bg_type === 'color' && typeof content.text_color === 'string' && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(content.text_color.trim())
    ? content.text_color.trim()
    : null

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {(image_url || image_url_mobile) && (
          <div className="rounded-xl overflow-hidden aspect-[4/3] bg-gray-100 dark:bg-gray-700">
            {image_url_mobile && image_url_mobile !== image_url ? (
              <picture className="block h-full w-full">
                <source media="(max-width: 767px)" srcSet={image_url_mobile} />
                <img src={image_url || image_url_mobile} alt={title || ''} className="w-full h-full object-cover" />
              </picture>
            ) : (
              <img src={image_url || image_url_mobile} alt={title || ''} className="w-full h-full object-cover" />
            )}
          </div>
        )}
        <div>
          {title && <h2 className="titulo-legado text-3xl font-bold mb-4 text-gray-900 dark:text-white" style={colorTexto ? { color: colorTexto } : undefined}>{title}</h2>}
          {body && <div className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6" style={colorTexto ? { color: colorTexto, opacity: 0.85 } : undefined} dangerouslySetInnerHTML={{ __html: body }} />}
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
