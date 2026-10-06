import type { MetadataRoute } from 'next'
import { getOrgContext } from '@/lib/get-org-context'

/**
 * /robots.txt por host (el middleware deja pasar esta ruta para resolver la organización).
 * - Host sin organización o sitio no publicado (`is_published === false`): no indexar nada.
 * - Si no: se indexa el sitio salvo las rutas privadas o de transacción, y se anuncia el
 *   sitemap del mismo host (con la sede si el host es de una sede).
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
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVADAS },
    sitemap: `${raiz}/sitemap.xml`,
  }
}
