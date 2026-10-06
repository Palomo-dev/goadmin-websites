import type { MetadataRoute } from 'next'
import { getOrgContext } from '@/lib/get-org-context'
import { getPaginasPublicas } from '@/lib/seo/paginasPublicas'
import { getSedesWeb } from '@/lib/restaurant/sedes'
import { conPrefijo } from '@/lib/outlet/rutaSitio'

/**
 * /sitemap.xml por host: las páginas publicadas del sitio que se sirve (V2 o legacy) y, en el
 * sitio principal, la portada (y la carta en restaurantes) de cada sede publicada por ruta
 * (`/<slug>`). Las sedes con dominio propio publican su sitemap en su host.
 * Sitio no publicado → vacío. Consultas cacheadas (getPaginasPublicas, getSedesWeb).
 */
export const dynamic = 'force-dynamic'

function indexable(slug: string): boolean {
  return !!slug && !slug.startsWith('_') && !slug.startsWith('plantillas/')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ctx = await getOrgContext()
  if (!ctx || ctx.effectiveSettings?.is_published === false) return []

  const esRestaurante = ctx.organization.type_id === 1
  const raiz = ctx.sedePorPrefijo ? ctx.urlBasePrincipal : ctx.urlBase
  const prefijo = ctx.prefijoSede
  const paginas = await getPaginasPublicas(ctx.organization.id, ctx.branchId ?? null)

  const rutas = new Set<string>(['/'])
  for (const p of paginas) {
    if (!indexable(p.slug)) continue
    rutas.add(p.slug === 'home' ? '/' : `/${p.slug}`)
  }
  if (esRestaurante) rutas.add('/menu')

  const entradas: MetadataRoute.Sitemap = [...rutas].map((ruta) => ({
    url: `${raiz}${ruta === '/' && !prefijo ? '' : conPrefijo(ruta, prefijo)}`,
    changeFrequency: ruta === '/menu' ? 'daily' : 'weekly',
    priority: ruta === '/' ? 1 : 0.7,
  }))

  // Sitio principal: las sedes publicadas por ruta.
  if (!ctx.outlet) {
    const sedes = await getSedesWeb(ctx.organization.id)
    for (const sede of sedes) {
      if (!sede.slug || sede.customDomain) continue
      const base = `${ctx.urlBasePrincipal}/${encodeURIComponent(sede.slug)}`
      entradas.push({ url: base, changeFrequency: 'weekly', priority: 0.8 })
      if (esRestaurante) entradas.push({ url: `${base}/menu`, changeFrequency: 'daily', priority: 0.7 })
    }
  }
  return entradas
}
