/**
 * Resumen real de reseñas de una organización («4,9 de 1.280 reseñas») para las piezas de las
 * plantillas de tienda: resumen de testimonios (`testimonials.show_summary`), chip de la portada
 * con buscador (`hero · search`, `rating_chip: 'auto'`) y tarjeta «rating» de la portada
 * flotante (`hero · floating`).
 *
 * Solo se llama si una sección de la página lo pide (`necesidadesPortadaTienda`, en
 * `lib/website/portadaTienda.ts`): ninguna tienda de hoy consulta nada nuevo.
 *
 * Cómo cuenta: un conteo exacto por estrella (1–5) con `head: true` (sin traer filas; el
 * payload son cinco números), en paralelo. Promedio = Σ(estrella × conteo) / Σ conteo. Así el
 * número es exacto aunque haya miles de reseñas, sin depender de agregados de PostgREST.
 *
 * Caché: `react.cache` (una vez por render) + `unstable_cache` por organización y fuente, con la
 * etiqueta del catálogo de la organización (`catalogo-<id>`, la que invalida el ERP) y TTL corto.
 * Si una lectura falla se lanza para NO cachear un cero falso; el llamador recibe `null` y la
 * pieza no se pinta.
 *
 * Columnas verificadas por MCP (taqjemqjtumhwptchcxk) el 2026-11-07:
 * - product_reviews: organization_id (int, NOT NULL), status (text, NOT NULL, default 'pending';
 *   lo público es 'approved', como `realReviews.ts` y `/api/reviews`), rating (smallint 1–5,
 *   CHECK). Índice (organization_id, status).
 * - testimonials: organization_id (int, NOT NULL), is_active (bool, NOT NULL), rating (smallint
 *   1–5, CHECK, default 5).
 * `scripts/verify-portada-tienda.mjs` lee estas mismas consultas del fuente y las compara con el
 * esquema.
 *
 * Service role (aquí no hay RLS): `organizationId` sale del host (getOrgContext), nunca del
 * cliente.
 */

import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog } from '@/lib/supabase/cache'
import type { FuenteResumen, ResumenResenas } from '@/lib/website/portadaTienda'

const ESTRELLAS = [1, 2, 3, 4, 5] as const

function cliente() {
  return createAdminClient() || createPublicClient()
}

/** Conteo exacto de una estrella, sin filas. Lanza si la lectura falla. */
async function contarEstrella(organizationId: number, fuente: FuenteResumen, estrella: number): Promise<number> {
  const supabase = cliente() as any
  const consulta =
    fuente === 'product_reviews'
      ? supabase
          .from('product_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'approved')
          .eq('rating', estrella)
      : supabase
          .from('testimonials')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .eq('rating', estrella)
  const { count, error } = await consulta
  if (error) throw new Error(`[resenas] ${fuente}: ${error.message}`)
  return typeof count === 'number' ? count : 0
}

async function getResumenResenasUncached(organizationId: number, fuente: FuenteResumen): Promise<ResumenResenas> {
  const conteos = await Promise.all(ESTRELLAS.map((e) => contarEstrella(organizationId, fuente, e)))
  const cantidad = conteos.reduce((s, n) => s + n, 0)
  const suma = conteos.reduce((s, n, i) => s + n * ESTRELLAS[i], 0)
  return { promedio: cantidad > 0 ? suma / cantidad : 0, cantidad }
}

const getResumenResenasCached = cache(
  cacheCatalog('getResumenResenasTienda', getResumenResenasUncached, (...args) => args[0]),
)

/** Resumen real, o `null` si la lectura falló (la pieza no se pinta; nunca una cifra inventada). */
export async function getResumenResenas(organizationId: number, fuente: FuenteResumen): Promise<ResumenResenas | null> {
  try {
    return await getResumenResenasCached(organizationId, fuente)
  } catch (e) {
    console.error('[resenas] resumen falló', { organizationId, fuente, error: e instanceof Error ? e.message : String(e) })
    return null
  }
}
