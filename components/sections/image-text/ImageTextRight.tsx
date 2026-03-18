interface ImageTextRightProps {
  content: {
    title?: string
    text?: string
    image_url?: string | null
  }
  primaryColor?: string
}

export function ImageTextRight({ content, primaryColor }: ImageTextRightProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        {content.title && (
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: primaryColor }}>
            {content.title}
          </h2>
        )}
        {content.text && (
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{content.text}</p>
        )}
      </div>
      <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {content.image_url ? (
          <img src={content.image_url} alt={content.title || ''} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">🖼️</span>
          </div>
        )}
      </div>
    </div>
  )
}
