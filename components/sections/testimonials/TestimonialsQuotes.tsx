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
import { SiLista } from '../ListRenderer'
import { proporcionHijos } from '../proporcionCeldas'

interface TestimonialsQuotesProps {
  content: TestimonialsContent
  primaryColor?: string
  data?: TestimonialsData
}


/** TESTIM-12: «Tamaño de comillas» (`quote_mark_size`, px). Sin clave, el tamaño de siempre. */
function tamanoComillas(contenido: unknown): { fontSize?: string } {
  const content = (contenido ?? {}) as { quote_mark_size?: unknown }
  const n = Number(content.quote_mark_size)
  return content.quote_mark_size != null && content.quote_mark_size !== '' && Number.isFinite(n) && n >= 8 && n <= 200 ? { fontSize: `${n}px` } : {}
}

export function TestimonialsQuotes({ content, primaryColor = '#3B82F6', data }: TestimonialsQuotesProps) {
  const title = content.title || 'Lo que dicen nuestros clientes'
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
  const quoteMarkColor = content.quote_mark_color || primaryColor
  const textSize = content.text_size || 'xl'
  const ratingPosition = content.rating_position || 'bottom'

  if (items.length === 0) {
    return (
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {title && <h2 className="titulo-legado text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">{title}</h2>}
          <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
            <p className="text-4xl mb-3">💬</p>
            <p>No hay testimonios disponibles aún</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="titulo-legado text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">{title}</h2>}
        <SiLista content={content} className={`space-y-10 ${proporcionHijos(content)}`}>
          {items.map((item) => {
            const stars = ratingStars(item.rating)
            const srcLabel = sourceLabel(item.source)
            const ratingColor = content.rating_color || quoteMarkColor

            return (
              <blockquote key={item.id} className="text-center">
                {showRating && ratingPosition === 'top' && ratingStyle !== 'compact' && (
                  <div className="flex items-center justify-center gap-1 mb-4">
                    {stars.map((s) => (
                      <span
                        key={s.index}
                        style={{ color: ratingColor }}
                        className={s.filled ? '' : 'opacity-30'}
                      >
                        {s.filled ? '★' : '☆'}
                      </span>
                    ))}
                    {ratingStyle === 'stars_count' && (
                      <span className="text-xs text-gray-500 ml-1">{item.rating.toFixed(1)}</span>
                    )}
                  </div>
                )}
                {showRating && ratingPosition === 'top' && ratingStyle === 'compact' && (
                  <div className="text-xs text-gray-500 mb-4 text-center">{item.rating.toFixed(1)} / 5</div>
                )}
                <span className="text-5xl font-serif leading-none" style={{ color: quoteMarkColor, ...tamanoComillas(content) }}>&ldquo;</span>
                <p className={`text-gray-700 dark:text-gray-300 italic mb-4 ${textSizeClass(textSize)}`}>
                  {item.content}
                </p>
                {showRating && ratingPosition === 'bottom' && ratingStyle !== 'compact' && (
                  <div className="flex items-center justify-center gap-1 mb-4">
                    {stars.map((s) => (
                      <span
                        key={s.index}
                        style={{ color: ratingColor }}
                        className={s.filled ? '' : 'opacity-30'}
                      >
                        {s.filled ? '★' : '☆'}
                      </span>
                    ))}
                    {ratingStyle === 'stars_count' && (
                      <span className="text-xs text-gray-500 ml-1">{item.rating.toFixed(1)}</span>
                    )}
                  </div>
                )}
                {showRating && ratingPosition === 'bottom' && ratingStyle === 'compact' && (
                  <div className="text-xs text-gray-500 mb-4 text-center">{item.rating.toFixed(1)} / 5</div>
                )}
                <footer className="text-sm text-gray-500 dark:text-gray-400">
                  — <strong>{item.name}</strong>
                  {(item.role || item.company) ? `, ${item.role || item.company}` : ''}
                  {showSource && srcLabel && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {srcLabel}
                    </span>
                  )}
                  {showDate && item.date && (
                    <span className="block mt-1 text-[10px] text-gray-400">
                      {new Date(item.date).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </footer>
              </blockquote>
            )
          })}
        </SiLista>
      </div>
    </section>
  )
}