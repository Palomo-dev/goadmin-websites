'use client'

import { useState } from 'react'
import {
  resolveTestimonialItems,
  useShuffledTestimonials,
  gridColumnsClass,
  cardRadiusClass,
  cardShadowClass,
  cardHoverClass,
  avatarShapeClass,
  avatarSizeStyle,
  avatarInitial,
  ratingStars,
  sourceLabel,
  lineClampClass,
  textSizeClass,
  textAlignClass,
  type TestimonialsContent,
  type TestimonialsData,
  type NormalizedTestimonial,
} from './testimonialsUtils'

interface TestimonialsCarouselProps {
  content: TestimonialsContent
  primaryColor?: string
  data?: TestimonialsData
}

export function TestimonialsCarousel({ content, primaryColor = '#8B6914', data }: TestimonialsCarouselProps) {
  const resolved = resolveTestimonialItems(content, data)
  const items = useShuffledTestimonials(resolved, content.randomize_order)

  // Por defecto grid de 3 columnas (comportamiento histórico de esta variante).
  const columns = content.columns ?? 3
  const gap = Number(content.gap ?? 16)
  const cardPadding = Number(content.card_padding ?? 16)
  const showRating = content.show_rating !== false
  // Normalizar: en testimonios no hay "cantidad de reseñas" por item,
  // así que stars_rating = stars_count y rating_count = compact.
  const rawRatingStyle = content.rating_style || 'stars'
  const ratingStyle = rawRatingStyle === 'stars_rating' ? 'stars_count'
    : rawRatingStyle === 'rating_count' ? 'compact' : rawRatingStyle
  const showSource = content.show_source === true
  const showDate = content.show_date === true
  const quoteMarks = content.quote_marks || 'none'
  const quoteMarkColor = content.quote_mark_color || primaryColor
  const avatarPosition = content.avatar_position ?? 'left'
  const avatarShape = content.avatar_shape || 'circle'
  const avatarFallback = content.avatar_fallback || 'initial'
  const textAlign = content.text_align || 'left'
  const textSize = content.text_size || 'md'
  const maxLines = content.text_max_lines
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const gridCls = gridColumnsClass(columns)
  const radiusCls = cardRadiusClass(content.card_radius)
  const shadowCls = cardShadowClass(content.card_shadow)
  const hoverCls = cardHoverClass(content.card_hover)
  const cardBg = content.card_bg
  const textCls = `${textSizeClass(textSize)} ${textAlignClass(textAlign)}`
  const clampCls = lineClampClass(maxLines)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {items.length === 0 ? (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">💬</p>
          <p>No hay testimonios disponibles aún</p>
        </div>
      ) : (
      <div
        className={`flex sm:grid ${gridCls} overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0`}
        style={{ gap: `${gap}px` }}
      >
        {items.map((item) => {
          const isExpanded = expanded[item.id]
          const stars = ratingStars(item.rating)
          const srcLabel = sourceLabel(item.source)
          const showReadMore = clampCls && !isExpanded
          return (
            <div
              key={item.id}
              className={`relative bg-white dark:bg-gray-800 ${radiusCls} ${shadowCls} ${hoverCls} border dark:border-gray-700 p-4 sm:p-6 snap-start flex-shrink-0 sm:flex-shrink-1 w-[85%] sm:w-auto`}
              style={{ padding: `${cardPadding}px`, backgroundColor: cardBg }}
            >
              {showRating && ratingStyle !== 'compact' && (
                <div className="flex gap-1 mb-3">
                  {stars.map((s) => (
                    <span
                      key={s.index}
                      style={{ color: content.rating_color || quoteMarkColor }}
                      className={s.filled ? 'text-yellow-400' : 'text-gray-300'}
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
                <div className="text-xs text-gray-500 mb-3">{item.rating.toFixed(1)} / 5</div>
              )}

              {quoteMarks === 'background' && (
                <span
                  className="absolute text-6xl leading-none opacity-10 select-none"
                  style={{ color: quoteMarkColor, top: 8, right: 12 }}
                  aria-hidden
                >
                  &rdquo;
                </span>
              )}

              <div className="relative mb-4">
                {quoteMarks === 'before' && (
                  <span style={{ color: quoteMarkColor }} className="text-2xl">&ldquo;</span>
                )}
                <p className={`text-gray-600 dark:text-gray-300 italic ${textCls} ${isExpanded ? '' : clampCls}`}>
                  {quoteMarks === 'around' ? `\u201C${item.content}\u201D` : item.content}
                </p>
                {showReadMore && (
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [item.id]: true }))}
                    className="text-xs mt-1 hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Leer más
                  </button>
                )}
              </div>

              <div className={`flex items-center gap-3 ${avatarPosition === 'top' ? 'flex-col text-center' : avatarPosition === 'right' ? 'flex-row-reverse' : avatarPosition === 'bottom' ? 'flex-col-reverse text-center' : ''}`}>
                {avatarPosition !== 'none' && (
                  <Avatar
                    item={item}
                    shape={avatarShape}
                    size={content.avatar_size}
                    fallback={avatarFallback}
                    primaryColor={primaryColor}
                  />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                  {(item.role || item.company) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {item.role || item.company}
                    </p>
                  )}
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
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

function Avatar({
  item,
  shape,
  size,
  fallback,
  primaryColor,
}: {
  item: NormalizedTestimonial
  shape: string
  size: any
  fallback: string
  primaryColor: string
}) {
  const shapeCls = avatarShapeClass(shape)
  const sizeStyle = avatarSizeStyle(size)
  if (item.avatar) {
    return (
      <img
        src={item.avatar}
        alt={item.name}
        className={`${shapeCls} object-cover flex-shrink-0`}
        style={sizeStyle}
      />
    )
  }
  if (fallback === 'icon') {
    return (
      <div
        className={`${shapeCls} flex items-center justify-center text-white flex-shrink-0`}
        style={{ ...sizeStyle, backgroundColor: primaryColor }}
        aria-hidden
      >
        <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </div>
    )
  }
  return (
    <div
      className={`${shapeCls} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
      style={{ ...sizeStyle, backgroundColor: primaryColor }}
    >
      {avatarInitial(item.name)}
    </div>
  )
}
