import { headers } from 'next/headers'
import { resolveOutletByCustomDomain, resolveOutletBySubSubdomain, resolveOutletFromPath } from '@/lib/outlet/resolver'

/** Sede de esta petición, por las mismas cabeceras que el resto del sitio. Sin sede: null. */
export async function sedeDeLaPeticion(orgId: number): Promise<number | null> {
  const cabeceras = await headers()
  const dominio = cabeceras.get('x-custom-outlet-domain')
  if (dominio) {
    const resuelta = await resolveOutletByCustomDomain(dominio)
    if (resuelta && resuelta.organizationId === orgId) return resuelta.outlet.branchId
  }
  const sub = cabeceras.get('x-outlet-subdomain')
  if (sub) {
    const sede = await resolveOutletBySubSubdomain(sub, orgId)
    if (sede) return sede.branchId
  }
  const prefijo = cabeceras.get('x-outlet-path')
  if (prefijo) {
    const result = await resolveOutletFromPath(orgId, [prefijo])
    if (result.outlet) return result.outlet.branchId
  }
  return null
}
