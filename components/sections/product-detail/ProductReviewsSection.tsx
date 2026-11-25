'use client'

import { useMemo } from 'react'
import { ProductReviews } from '@/components/site/reviews/ProductReviews'
import { CLAVE_EJEMPLOS_VERIFICADA, leerOpcionesResenas } from '@/lib/website/v2/seccionesFicha'

export const CONTENT_KEYS = ['reviews_source', 'empty_state_title', 'empty_state_message', 'empty_state_cta'] as const

const FUENTES = ['generated', 'real', 'mixed', 'auto'] as const

interface ProductReviewsSectionProps {
  content: {
    reviews_source?: string
    empty_state_title?: string
    empty_state_message?: string
    empty_state_cta?: string
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: {
    product?: any
    reviewsConfig?: any
    productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
  }
}

/**
 * Reseñas de la ficha. Sin claves nuevas, lo de siempre. Con las opciones de la sección
 * (Figma 2986:73149, `lib/website/v2/seccionesFicha.ts`) cambia el pintado; los datos no.
 *
 * «De dónde salen las opiniones» (`reviews_source`, `auto_switch_threshold`, `min_visible`) del
 * contenido de la sección, si está, manda sobre el de los ajustes del sitio: es lo que el panel
 * del editor escribe (antes se guardaba y la tienda no lo leía).
 *
 * «Mostrar “Compra verificada” en las de ejemplo» (`examples_verified_badge`, Figma 3144-96345):
 * solo `false` cambia algo (las de ejemplo sin la insignia); sin la clave, como siempre.
 */
export function ProductReviewsSection({ content, primaryColor = '#3B82F6', data }: ProductReviewsSectionProps) {
  const product = data?.product
  const opciones = useMemo(() => leerOpcionesResenas(content as Record<string, unknown>), [content])
  const fuente = typeof content?.reviews_source === 'string' && (FUENTES as readonly string[]).includes(content.reviews_source)
    ? content.reviews_source
    : null
  const umbral = typeof content?.auto_switch_threshold === 'number' ? content.auto_switch_threshold : null
  const minimo = typeof content?.min_visible === 'number' ? content.min_visible : null
  const sinInsigniaEjemplos = content?.[CLAVE_EJEMPLOS_VERIFICADA] === false
  const base = data?.reviewsConfig
  const reviewsConfig = useMemo(() => {
    if (!fuente && umbral === null && minimo === null && !sinInsigniaEjemplos) return base
    return {
      ...(base ?? {}),
      ...(fuente ? { reviews_source: fuente } : {}),
      ...(umbral !== null ? { auto_switch_threshold: umbral } : {}),
      ...(minimo !== null ? { min_visible: minimo } : {}),
      ...(sinInsigniaEjemplos ? { ejemplos_verificada: false } : {}),
    }
  }, [base, fuente, umbral, minimo, sinInsigniaEjemplos])
  if (!product) return null

  return (
    <div id="product-reviews">
      <ProductReviews
        productId={product.id}
        productName={product.name}
        primaryColor={primaryColor}
        reviewsConfig={reviewsConfig}
        estadoVacio={{ titulo: content?.empty_state_title, mensaje: content?.empty_state_message, boton: content?.empty_state_cta }}
        productStats={data?.productStats}
        opciones={opciones}
      />
    </div>
  )
}
