import type { MetadataRoute } from 'next'
import { getOrgContext } from '@/lib/get-org-context'
import { getSedesWeb } from '@/lib/restaurant/sedes'
import { conPrefijo, prefijoSede } from '@/lib/outlet/rutaSitio'
import { getPixelesSitio } from '@/lib/seo/pixelesSitio'

/**
 * /robots.txt por host (el middleware deja pasar esta ruta para resolver la organización).
 * - Host sin organización o sitio no publicado (`is_published === false`): no indexar nada.
 * - Si no: se indexa el sitio salvo las rutas privadas o de transacción, y se anuncia el
 *   sitemap del mismo host (con la sede si el host es de una sede).
 * - En el host del sitio principal, las mismas rutas privadas bajo el prefijo de cada sede
 *   publicada por ruta (`/<sede>/checkout`, `/<sede>/carrito`…), que el middleware sirve igual.
 *   Lista explícita (getSedesWeb, cacheada) en vez de comodines: no todos los buscadores los leen.
 */
export const dynamic = 'force-dynamic'

const PRIVADAS = ['/api/', '/checkout', '/carrito', '/mi-cuenta', '/auth', '/vista-previa/', '/pedido/', '/consultar-pedido']

export default async function robots(): Promise<MetadataRoute.Robots> {
  const ctx = await getOrgContext()
  if (!ctx || ctx.effectiveSettings?.is_published === false) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  // La base del host (sin el prefijo de ruta de una sede: robots.txt vive en la raíz).
  const raiz = ctx.sedePorPrefijo ? ctx.urlBasePrincipal : ctx.urlBase
  const disallow = new Set(PRIVADAS)
  if (!ctx.outlet) {
    for (const sede of await getSedesWeb(ctx.organization.id)) {
      if (!sede.slug || sede.customDomain) continue
      const prefijo = prefijoSede({ branchSlug: sede.slug }, true)
      // conPrefijo deja tal cual las rutas globales (/api, /auth, /mi-cuenta): el Set las deduplica.
      for (const ruta of PRIVADAS) disallow.add(conPrefijo(ruta, prefijo))
    }
  }
  // «Ocultar de los buscadores»: se deja rastrear (si no, el buscador no ve el noindex de cada
  // página y puede seguir listando las URL) pero sin anunciar el sitemap.
  if ((await getPixelesSitio(ctx.organization.id)).noindex) {
    return { rules: { userAgent: '*', allow: '/', disallow: [...disallow] } }
  } else {
    return {
      rules: { userAgent: '*', allow: '/', disallow: [...disallow] },
      sitemap: `${raiz}/sitemap.xml`,
    }
  }
}
