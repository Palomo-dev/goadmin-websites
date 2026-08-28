'use client'

import {
  resolveTestimonialItems,
  useShuffledTestimonials,
  ratingStars,
  sourceLabel,
  textSizeClass,
  type TestimonialsContent,
  type TestimonialsData,
} from './testimonialsUtils'

interface TestimonialsMinimalProps {
  content: TestimonialsContent
  primaryColor?: string
  data?: TestimonialsData
}

export function TestimonialsMinimal({ content, primaryColor = '#3B82F6', data }: TestimonialsMinimalProps) {
  const title = content.title
  const resolved = resolveTestimonialItems(content, data)
  const items = useShuffledTestimonials(resolved, content.randomize_order)

  const showRating = content.show_rating !== false
  // Normalizar: en testimonios no hay "cantidad de reseñas" por item,
  // así que stars_rating = stars_count y rating_count = compact.
  const rawRatingStyle = content.rating_style || 'stars'
  const ratingStyle = rawRatingStyle === 'stars_rating' ? 'stars_count'
    : rawRatingStyle === 'rating_count' ? 'compact' : rawRatingStyle
  const showSource = content.show_source === true
  const showDate = content.show_date === true
  const textSize = content.text_size || 'md'
  const quoteMarkColor = content.quote_mark_color || primaryColor

  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        {items.length === 0 && (
          <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
            <p className="text-4xl mb-3">💬</p>
            <p>No hay testimonios disponibles aún</p>
          </div>
        )}
        {items.length > 0 && (
        <div className="space-y-6">
          {items.map((item) => {
            const stars = ratingStars(item.rating)
            const srcLabel = sourceLabel(item.source)
            return (
              <div key={item.id} className="flex gap-4 items-start">
                <div className="w-1 flex-shrink-0 rounded-full self-stretch" style={{ backgroundColor: primaryColor }} />
                <div className="min-w-0">
                  <p className={`text-gray-700 dark:text-gray-300 mb-1 ${textSizeClass(textSize)}`}>{item.content}</p>
                  {showRating && ratingStyle !== 'compact' && (
                    <div className="flex items-center gap-0.5 mb-1">
                      {stars.map((s) => (
                        <span
                          key={s.index}
                          style={{ color: content.rating_color || quoteMarkColor }}
                          className={s.filled ? 'text-sm' : 'text-sm opacity-30'}
                        >
                          {s.filled ? '★' : '☆'}
                        </span>
                      ))}
                      {ratingStyle === 'stars_count' && (
                        <span className="text-xs text-gray-500 ml-1">{item.rating.toFixed(1)}</span>
                      )}
                    </div>
                  )}
                  {showRating && ratingStyle === 'compact' && (
                    <p className="text-xs text-gray-500 mb-1">{item.rating.toFixed(1)} / 5</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {item.name}
                    {(item.role || item.company) ? ` · ${item.role || item.company}` : ''}
                  </p>
                  {showSource && srcLabel && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {srcLabel}
                    </span>
                  )}
                  {showDate && item.date && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(item.date).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>
    </section>
  )
}
