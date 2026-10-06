/**
 * Páginas publicadas de un sitio (V2 si lo adoptó; si no, legacy) con los tipos de sus
 * secciones visibles. Lo usan el sitemap y la barra móvil de restaurante («Reservar» va a
 * la página que tiene la sección de reserva; «Pedir», a la de la carta).
 *
 * Servidor. V2 sale de la revisión publicada (ya cacheada en lectorPublico); legacy es UNA
 * consulta por organización, cacheada 60 s (`cacheStructural`) y deduplicada en la petición.
 * La organización sale siempre del host (`getOrgContext`): aquí no hay RLS (service role).
 *
 * Columnas verificadas por MCP el 2026-10-06: website_pages(id, slug, organization_id,
 * branch_id, is_published), website_page_sections(page_id, section_type, is_visible).
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'

export interface PaginaPublica {
  slug: string
  /** Tipos de las secciones visibles, en orden. */
  secciones: string[]
}

type FilaPagina = {
  slug: string | null
  branch_id: number | null
  website_page_sections: { section_type: string | null; is_visible: boolean | null }[] | null
}

async function getPaginasLegacyUncached(organizationId: number, branchId: number | null): Promise<PaginaPublica[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  let consulta = (supabase as any)
    .from('website_pages')
    .select('slug, branch_id, website_page_sections(section_type, is_visible)')
    .eq('organization_id', organizationId)
    .eq('is_published', true)
  consulta = branchId !== null ? consulta.or(`branch_id.is.null,branch_id.eq.${branchId}`) : consulta.is('branch_id', null)
  const { data, error } = await consulta
  if (error) {
    console.error('[paginas-publicas] Error leyendo páginas', { organizationId, error: error.message })
    return []
  }
  // La copia de la sede manda sobre la del principal (mismo criterio que getWebsitePageBySlug).
  const porSlug = new Map<string, FilaPagina>()
  for (const fila of (data ?? []) as FilaPagina[]) {
    if (!fila.slug) continue
    const previa = porSlug.get(fila.slug)
    if (!previa || (previa.branch_id === null && fila.branch_id !== null)) porSlug.set(fila.slug, fila)
  }
  return [...porSlug.values()].map((fila) => ({
    slug: fila.slug as string,
    secciones: (fila.website_page_sections ?? [])
      .filter((s) => s.is_visible !== false && typeof s.section_type === 'string')
      .map((s) => s.section_type as string),
  }))
}

const getPaginasLegacy = cacheStructural('getPaginasPublicasLegacy', getPaginasLegacyUncached, CONTENT_TTL)

export const getPaginasPublicas = cache(async (organizationId: number, branchId?: number | null): Promise<PaginaPublica[]> => {
  const sede = typeof branchId === 'number' && Number.isInteger(branchId) ? branchId : null
  const sitio = await getSitioPublicoV2(organizationId, sede)
  if (sitio) {
    return sitio.documento.paginas
      .filter((p) => p.publicada)
      .map((p) => ({
        slug: p.slug,
        secciones: p.secciones.filter((s) => s.visibilidad?.movil !== false || s.visibilidad?.escritorio !== false).map((s) => s.tipo),
      }))
  }
  return getPaginasLegacy(organizationId, sede)
})

/** Ruta de la primera página con alguna de las secciones (la portada al final). `null` si ninguna. */
export function rutaDePaginaCon(paginas: PaginaPublica[], tipos: readonly string[]): string | null {
  const con = paginas.filter((p) => p.secciones.some((t) => tipos.includes(t)))
  const elegida = con.find((p) => p.slug !== 'home') ?? con[0]
  if (!elegida) return null
  return elegida.slug === 'home' ? '/' : `/${elegida.slug}`
}
