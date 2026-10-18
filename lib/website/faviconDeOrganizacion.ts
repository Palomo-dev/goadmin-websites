/**
 * Favicon que debe servir la pestaña de esta petición.
 *
 * La organización sale del host (cabeceras del middleware o el Host). Nunca del
 * body. Si el sitio adoptó V2, manda el favicon de la revisión publicada.
 */
import { headers } from 'next/headers'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { faviconLegacyDe, urlFaviconEfectiva } from '@/lib/website/v2/faviconPublico'
import {
  resolveOutletByCustomDomain,
  resolveOutletBySubSubdomain,
  resolveOutletFromPath,
} from '@/lib/outlet/resolver'

const SYSTEM_DOMAINS = ['goadmin.io']

function identificadorDesdeHost(hostname: string): string | null {
  const esSistema = SYSTEM_DOMAINS.some((dominio) => hostname.endsWith(dominio))
  if (esSistema) {
    const partes = hostname.split('.')
    return partes.length > 2 ? partes[0] : null
  }
  if (!hostname || hostname.includes('localhost')) return null
  return hostname
}

async function branchDeCabeceras(organizationId: number, cabeceras: Headers): Promise<number | null> {
  const dominioSede = cabeceras.get('x-custom-outlet-domain')
  if (dominioSede) {
    const resuelta = await resolveOutletByCustomDomain(dominioSede)
    if (resuelta && resuelta.organizationId === organizationId) return resuelta.outlet.branchId
  }
  const subSede = cabeceras.get('x-outlet-subdomain')
  if (subSede) {
    const sede = await resolveOutletBySubSubdomain(subSede, organizationId)
    if (sede) return sede.branchId
  }
  const prefijo = cabeceras.get('x-outlet-path')
  if (prefijo) {
    const result = await resolveOutletFromPath(organizationId, [prefijo])
    if (result.outlet) return result.outlet.branchId
  }
  return null
}

/** URL del favicon de la organización de esta petición, o `null` si no hay sitio. */
export async function urlFaviconDeLaPeticion(): Promise<string | null> {
  const cabeceras = await headers()
  const identificador =
    cabeceras.get('x-custom-domain') ||
    cabeceras.get('x-subdomain') ||
    identificadorDesdeHost(cabeceras.get('host') || '')
  if (!identificador) return null

  const organization = await getOrganizationByHost(identificador)
  if (!organization) return null

  const branchId = await branchDeCabeceras(organization.id, cabeceras)
  const sitio = await getSitioPublicoV2(organization.id, branchId)
  return urlFaviconEfectiva({
    documento: sitio?.documento ?? null,
    principal: sitio?.principal ? { documento: sitio.principal.documento } : null,
    faviconLegacy: faviconLegacyDe(organization.website_settings),
    logoUrl: organization.logo_url,
  })
}
