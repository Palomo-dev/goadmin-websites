/**
 * Lector público de sitios V2 (ADR-002 D4: adopción explícita por sitio).
 *
 * Si `website_site_states` del sitio (organización + sede, con fallback al sitio principal)
 * tiene `v2_adopted = true`, la respuesta pública sale de la REVISIÓN PUBLICADA
 * (`website_site_revisions.document`). Nunca del borrador: `website_site_drafts` no se lee aquí.
 * Si no, legacy exactamente igual que hoy. Nunca se combinan.
 *
 * Fail-safe: cualquier fallo al leer o validar el documento V2 (consulta, revisión ausente,
 * contrato inválido) devuelve `null` → el sitio sale por legacy y se registra el error.
 *
 * Caché:
 * - Estados del sitio: por organización y sede, 60 s, etiqueta `sitio-v2-org-<org>`.
 * - Revisión: por id de revisión (inmutable), 1 h, etiqueta `sitio-v2-<site_state_id>`.
 *   Una publicación cambia `published_revision_id`, así que el sitio la ve como mucho a los 60 s
 *   aunque nadie procese el outbox; el outbox (`/api/revalidate/sitios-v2`) la adelanta.
 * - Por petición: react.cache, una sola lectura aunque layout, metadata y página la pidan.
 *
 * Columnas verificadas por MCP el 2026-10-05:
 * - website_site_states: id, organization_id, branch_id, v2_adopted, published_revision_id, …
 * - website_site_revisions: id, site_state_id, organization_id, schema_version, document, …
 * Las tablas no admiten anon: se lee con `createAdminClient()` (service role) y SIEMPRE filtrando
 * por `organization_id`, que sale del host (getOrgContext), nunca del body ni de la query.
 */
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import type { WebsitePageWithSections } from '@/types/database'
import { validarDocumentoSitio, VERSION_ESQUEMA_DOCUMENTO, type DocumentoSitio } from './contrato/documentoSitio'
import {
  paginaPublicaDesdeDocumento,
  plantillaPublicaDesdeDocumento,
  type CategoriaMenu,
} from './vistaPublica'

/** Etiqueta de todos los sitios V2 (invalidación manual masiva). */
export const TAG_SITIOS_V2 = 'sitios-v2'
/** Etiqueta de las revisiones de un sitio. */
export const tagSitioV2 = (siteStateId: string) => `sitio-v2-${siteStateId}`
/** Etiqueta de los estados (adopción, revisión publicada) de una organización. */
export const tagEstadosV2Org = (organizationId: number) => `sitio-v2-org-${organizationId}`

const TTL_REVISION = 3600

interface FilaEstado {
  id: string
  branch_id: number | null
  v2_adopted: boolean
  published_revision_id: string | null
}

type ResultadoRevision =
  | { ok: true; documento: DocumentoSitio }
  | { ok: false; errores: { ruta: string; codigo: string }[] }

export interface SitioPublicoV2 {
  siteStateId: string
  revisionId: string
  /** Sede del sitio que se sirve (`null` = principal, también cuando una sede cae al principal). */
  branchId: number | null
  documento: DocumentoSitio
  /** Solo para un sitio de sede: base de la herencia (D6). `documento` null = principal legacy. */
  principal: { documento: DocumentoSitio | null } | null
}

function sedeValida(branchId: number | null | undefined): branchId is number {
  return typeof branchId === 'number' && Number.isInteger(branchId) && branchId > 0
}

async function leerEstadosSinCache(organizationId: number, sede: number | null): Promise<FilaEstado[]> {
  const supabase = createAdminClient()
  if (!supabase) {
    // Sin service role las tablas V2 no son legibles (no admiten anon): todo sale por legacy.
    console.error('[sitio-v2] Sin SUPABASE_SERVICE_ROLE_KEY: no se puede leer website_site_states')
    return []
  }
  let consulta = (supabase as any)
    .from('website_site_states')
    .select('id, branch_id, v2_adopted, published_revision_id')
    .eq('organization_id', organizationId)
  consulta = sede !== null ? consulta.or(`branch_id.is.null,branch_id.eq.${sede}`) : consulta.is('branch_id', null)
  const { data, error } = await consulta
  // Lanzar para que unstable_cache NO guarde el fallo; quien llama cae a legacy.
  if (error) throw new Error(`website_site_states: ${error.message || error.code}`)
  return (data || []) as FilaEstado[]
}

function leerEstados(organizationId: number, sede: number | null): Promise<FilaEstado[]> {
  return unstable_cache(
    () => leerEstadosSinCache(organizationId, sede),
    ['sitio-v2-estados', String(organizationId), sede === null ? 'principal' : String(sede)],
    { revalidate: CONTENT_TTL, tags: [TAG_SITIOS_V2, tagEstadosV2Org(organizationId)] }
  )()
}

async function leerRevisionSinCache(
  organizationId: number,
  siteStateId: string,
  revisionId: string
): Promise<ResultadoRevision> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, errores: [{ ruta: '', codigo: 'sin_service_role' }] }
  const { data, error } = await (supabase as any)
    .from('website_site_revisions')
    .select('id, schema_version, document')
    .eq('id', revisionId)
    .eq('site_state_id', siteStateId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw new Error(`website_site_revisions: ${error.message || error.code}`)
  if (!data) return { ok: false, errores: [{ ruta: '', codigo: 'revision_no_encontrada' }] }
  if (data.schema_version !== VERSION_ESQUEMA_DOCUMENTO) {
    return { ok: false, errores: [{ ruta: 'schema_version', codigo: `schema_version_no_soportada:${data.schema_version}` }] }
  }
  const validacion = validarDocumentoSitio(data.document)
  return validacion.ok ? { ok: true, documento: validacion.documento } : { ok: false, errores: validacion.errores }
}

function leerRevision(organizationId: number, siteStateId: string, revisionId: string): Promise<ResultadoRevision> {
  // Inmutable: la clave es el id de la revisión. Ojo: Next no guarda entradas > 2 MB; un
  // documento cerca del límite del contrato (2 MB) se volvería a leer en cada petición.
  return unstable_cache(
    () => leerRevisionSinCache(organizationId, siteStateId, revisionId),
    ['sitio-v2-revision', String(organizationId), siteStateId, revisionId],
    { revalidate: TTL_REVISION, tags: [TAG_SITIOS_V2, tagSitioV2(siteStateId)] }
  )()
}

/**
 * Sitio V2 que debe servirse para la organización y la sede, o `null` para servir legacy.
 * - Con sede y fila propia de la sede: manda esa fila (adoptada → V2; no adoptada → legacy).
 * - Con sede sin fila propia: fallback al sitio principal.
 */
export const getSitioPublicoV2 = cache(
  async (organizationId: number, branchId?: number | null): Promise<SitioPublicoV2 | null> => {
    const sede = sedeValida(branchId) ? branchId : null
    try {
      const estados = await leerEstados(organizationId, sede)
      if (estados.length === 0) return null // ningún sitio V2: legacy, igual que hoy
      const principal = estados.find((e) => e.branch_id === null) ?? null
      const propio = sede !== null ? estados.find((e) => e.branch_id === sede) ?? null : null
      const elegido = propio ?? principal
      if (!elegido || !elegido.v2_adopted) return null
      if (!elegido.published_revision_id) {
        console.error('[sitio-v2] Sitio adoptado sin revisión publicada; se sirve legacy', {
          organizationId, siteStateId: elegido.id,
        })
        return null
      }

      const revision = await leerRevision(organizationId, elegido.id, elegido.published_revision_id)
      if (!revision.ok) {
        console.error('[sitio-v2] Revisión publicada ilegible; se sirve legacy', {
          organizationId, siteStateId: elegido.id, revisionId: elegido.published_revision_id,
          errores: revision.errores.slice(0, 10),
        })
        return null
      }

      // Sitio de sede: base de herencia = revisión publicada del principal, o su legacy.
      let base: SitioPublicoV2['principal'] = null
      if (elegido.branch_id !== null) {
        if (principal?.published_revision_id) {
          const revPrincipal = await leerRevision(organizationId, principal.id, principal.published_revision_id)
          if (!revPrincipal.ok) {
            console.error('[sitio-v2] Revisión del principal ilegible; la sede se sirve legacy', {
              organizationId, siteStateId: principal.id, errores: revPrincipal.errores.slice(0, 10),
            })
            return null
          }
          base = { documento: revPrincipal.documento }
        } else {
          base = { documento: null }
        }
      }

      return {
        siteStateId: elegido.id,
        revisionId: elegido.published_revision_id,
        branchId: elegido.branch_id,
        documento: revision.documento,
        principal: base,
      }
    } catch (error) {
      console.error('[sitio-v2] Error leyendo el sitio V2; se sirve legacy', {
        organizationId, branchId: sede, error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }
)

/** Categorías referenciadas por los menús V2 (una consulta, cacheada como el resto de la estructura). */
const getCategoriasPorIdsSinCache = async (
  organizationId: number,
  idsOrdenados: string
): Promise<CategoriaMenu[]> => {
  const ids = idsOrdenados.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (ids.length === 0) return []
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data, error } = await (supabase as any)
    .from('categories')
    .select('id, name, slug')
    .eq('organization_id', organizationId)
    .in('id', ids.slice(0, 500))
  if (error) throw new Error(`categories: ${error.message || error.code}`)
  return (data || []) as CategoriaMenu[]
}
const getCategoriasPorIdsCacheada = cacheStructural('getCategoriasMenuV2', getCategoriasPorIdsSinCache, CONTENT_TTL)

export async function getCategoriasMenuV2(organizationId: number, ids: number[]): Promise<Map<number, CategoriaMenu>> {
  if (ids.length === 0) return new Map()
  const clave = Array.from(new Set(ids)).sort((a, b) => a - b).join(',')
  const filas = await getCategoriasPorIdsCacheada(organizationId, clave)
  return new Map(filas.map((c) => [Number(c.id), c]))
}

// ─── Páginas públicas: V2 si el sitio lo adoptó, legacy si no ──────────────────────────────────

/**
 * Página pública por slug. Sitio V2 → la del documento publicado (o `null` si no existe: nunca se
 * mezcla con legacy). Sitio legacy, o fallo leyendo V2 → `legacy()` exactamente como antes.
 */
export async function getPaginaPublica(
  organizationId: number,
  slug: string,
  branchId: number | null | undefined,
  legacy: () => Promise<WebsitePageWithSections | null>
): Promise<WebsitePageWithSections | null> {
  const sitio = await getSitioPublicoV2(organizationId, branchId)
  if (sitio) {
    try {
      return paginaPublicaDesdeDocumento(sitio.documento, slug, { organizationId, branchId: sitio.branchId })
    } catch (error) {
      console.error('[sitio-v2] Error armando la página V2; se sirve legacy', {
        organizationId, slug, siteStateId: sitio.siteStateId, error: error instanceof Error ? error.message : String(error),
      })
    }
  } else {
    // Sitio legacy: sin cambios.
  }
  return legacy()
}

/** Plantilla de detalle (`product_detail`, `category_detail`…) con la misma regla que la página. */
export async function getPlantillaPublica(
  organizationId: number,
  tipo: string,
  branchId: number | null | undefined,
  legacy: () => Promise<WebsitePageWithSections | null>
): Promise<WebsitePageWithSections | null> {
  const sitio = await getSitioPublicoV2(organizationId, branchId)
  if (sitio) {
    try {
      return plantillaPublicaDesdeDocumento(sitio.documento, tipo, { organizationId, branchId: sitio.branchId })
    } catch (error) {
      console.error('[sitio-v2] Error armando la plantilla V2; se sirve legacy', {
        organizationId, tipo, siteStateId: sitio.siteStateId, error: error instanceof Error ? error.message : String(error),
      })
    }
  } else {
    // Sitio legacy: sin cambios.
  }
  return legacy()
}

