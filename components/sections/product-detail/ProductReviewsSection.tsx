'use client'

import { useMemo } from 'react'
import { ProductReviews } from '@/components/site/reviews/ProductReviews'
import { CLAVE_EJEMPLOS_VERIFICADA, leerOpcionesResenas } from '@/lib/website/v2/seccionesFicha'
import { configResenasDeSeccion } from '@/components/site/reviews/types'

export const CONTENT_KEYS = ['reviews_source', 'empty_state_title', 'empty_state_message', 'empty_state_cta'] as const

/**
 * Estado vacío dentro de la pestaña «Reseñas» (Figma 3256-99587, «Reseñas vacía»). Los textos
 * propios de la sección mandan; sin ellos, estos (fuera de la pestaña, los de siempre).
 */
export const VACIO_EN_PESTANA = {
  titulo: 'Aún no hay reseñas de este producto',
  mensaje: '¿Ya lo tienes? Cuéntale a otros compradores cómo te fue.',
  boton: 'Escribir la primera reseña',
} as const

function textoPropio(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor : null
}

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
    /** Dentro de la pestaña «Reseñas» de la ficha (PestanasFicha). */
    enPestanaFicha?: boolean
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
  // La misma regla que la pestaña «Reseñas (N)» (configResenasDeSeccion): cuentan lo mismo.
  const fuente = content?.reviews_source
  const umbral = content?.auto_switch_threshold
  const minimo = content?.min_visible
  const insignia = content?.[CLAVE_EJEMPLOS_VERIFICADA]
  const base = data?.reviewsConfig
  const reviewsConfig = useMemo(
    () => configResenasDeSeccion({ reviews_source: fuente, auto_switch_threshold: umbral, min_visible: minimo, [CLAVE_EJEMPLOS_VERIFICADA]: insignia }, base),
    [base, fuente, umbral, minimo, insignia],
  )
  if (!product) return null
  const enPestana = data?.enPestanaFicha === true

  return (
    // En su pestaña, sin el margen ni la línea de arriba del bloque suelto (la barra ya separa).
    <div id="product-reviews" className={enPestana ? '[&>*]:!mt-0 [&>*]:!border-t-0 [&>*]:!pt-0' : undefined}>
      <ProductReviews
        productId={product.id}
        productName={product.name}
        primaryColor={primaryColor}
        reviewsConfig={reviewsConfig}
        estadoVacio={enPestana
          ? {
              titulo: textoPropio(content?.empty_state_title) ?? VACIO_EN_PESTANA.titulo,
              mensaje: textoPropio(content?.empty_state_message) ?? VACIO_EN_PESTANA.mensaje,
              boton: textoPropio(content?.empty_state_cta) ?? VACIO_EN_PESTANA.boton,
            }
          : { titulo: content?.empty_state_title, mensaje: content?.empty_state_message, boton: content?.empty_state_cta }}
        productStats={data?.productStats}
        opciones={opciones}
      />
    </div>
  )
}
