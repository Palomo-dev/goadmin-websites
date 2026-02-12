interface TestimonialItem {
  name: string
  text: string
  rating?: number
  image_url?: string | null
}

interface TestimonialsCarouselProps {
  content: {
    title?: string
    items?: TestimonialItem[]
  }
  primaryColor?: string
}

export function TestimonialsCarousel({ content, primaryColor }: TestimonialsCarouselProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{content.title}</h2>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border p-6">
            {item.rating && (
              <div className="flex gap-1 mb-3">
                {Array.from({ length: item.rating }).map((_, j) => (
                  <span key={j} className="text-yellow-400">★</span>
                ))}
              </div>
            )}
            <p className="text-gray-600 mb-4 italic">&ldquo;{item.text}&rdquo;</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor || '#8B6914' }}
              >
                {item.name.charAt(0)}
              </div>
              <span className="font-medium text-gray-900">{item.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
