'use client'

import {
  resolveTestimonialItems,
  useShuffledTestimonials,
  ratingStars,
  sourceLabel, clasesBadgeOrigen,
  textSizeClass,
  type TestimonialsContent,
  type TestimonialsData,
  type NormalizedTestimonial,
} from './testimonialsUtils'
import { SiLista } from '../ListRenderer'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizarAjustesTestimonios } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { ResumenTestimonios } from './ResumenTestimonios'

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

  // Plantillas de tienda (Roble): con `image_url` o `pager: 'fraction'`, una cita a la vez junto a
  // la foto. Sin esas claves, la lista de citas de siempre.
  const ajustesCitas = normalizarAjustesTestimonios(content)
  if (ajustesCitas.imageUrl !== '' || ajustesCitas.pager === 'fraction') {
    return <CitasConFoto content={content} data={data} items={items} imageUrl={ajustesCitas.imageUrl} fraccion={ajustesCitas.pager === 'fraction'} />
  }

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
        <ResumenTestimonios content={content} data={data} className="mb-10 justify-center" />
        <SiLista content={content} className={`space-y-10`}>
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
                    <span className={`ml-2 ${clasesBadgeOrigen(content.source_badge_style)}`}>
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

const FOCO_CITA = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current'

/** «01 / 03» */
function dosCifras(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Una cita a la vez junto a la foto (`image_url`), con «01 / 03» y flechas (`pager: 'fraction'`) y
 * el resumen real de reseñas abajo (`show_summary`). Sin testimonios no pinta nada (en la vista
 * previa, un aviso): nunca una cita de ejemplo.
 */
function CitasConFoto({
  content,
  data,
  items,
  imageUrl,
  fraccion,
}: {
  content: TestimonialsContent
  data?: TestimonialsData
  items: NormalizedTestimonial[]
  imageUrl: string
  fraccion: boolean
}) {
  const [actual, setActual] = useState(0)
  if (items.length === 0) {
    return <EditorHint title="Sin testimonios">Agrega testimonios o conéctalos a los de tu tienda.</EditorHint>
  }
  const i = Math.min(actual, items.length - 1)
  const cita = items[i]
  const conPaginas = fraccion && items.length > 1
  const detalle = cita.role || cita.company
  return (
    <div className={imageUrl ? 'grid items-stretch gap-10 md:grid-cols-2 md:gap-14' : 'mx-auto max-w-3xl'} data-citas-foto="">
      {imageUrl && (
        <div className="aspect-[4/5] overflow-hidden bg-black/5 md:aspect-auto md:min-h-[460px]">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="flex flex-col py-2">
        {content.title && <p className="mb-6 text-xs opacity-60">{content.title}</p>}
        <blockquote aria-live="polite">
          <p className="text-2xl leading-snug md:text-4xl md:leading-tight">&ldquo;{cita.content}&rdquo;</p>
          <footer className="mt-6 text-sm">
            <span className="block">{cita.name}</span>
            {detalle && <span className="block text-xs opacity-60">{detalle}</span>}
          </footer>
        </blockquote>
        {conPaginas && (
          <div className="mt-8 flex items-center gap-3 text-xs">
            <button type="button" aria-label="Testimonio anterior" onClick={() => setActual((i - 1 + items.length) % items.length)} className={`flex h-9 w-9 items-center justify-center rounded-full border border-black/20 dark:border-white/30 ${FOCO_CITA}`}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span>{dosCifras(i + 1)} / {dosCifras(items.length)}</span>
            <button type="button" aria-label="Testimonio siguiente" onClick={() => setActual((i + 1) % items.length)} className={`flex h-9 w-9 items-center justify-center rounded-full border border-black/20 dark:border-white/30 ${FOCO_CITA}`}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <ResumenTestimonios content={content} data={data} className="mt-auto pt-10" />
      </div>
    </div>
  )
}
