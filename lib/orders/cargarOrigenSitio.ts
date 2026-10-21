/**
 * Lee el origen del sitio. La organización la pasa quien ya la resolvió
 * (el pedido o la reserva), nunca el cuerpo de una petición pública.
 */

import { origenDesdeDatos, type DominioSitioCorreo } from '@/lib/orders/origenSitio'

type Cliente = { from: (tabla: string) => any }

export async function origenSitio(sb: Cliente, organizationId: number): Promise<string> {
  if (!Number.isInteger(organizationId) || organizationId <= 0) return ''
  const [{ data: dominios, error: errorDominios }, { data: org, error: errorOrg }] = await Promise.all([
    sb
      .from('organization_domains')
      .select('host, domain_type, status, is_primary, is_active, updated_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    sb.from('organizations').select('subdomain').eq('id', organizationId).maybeSingle(),
  ])
  if (errorDominios || errorOrg) {
    console.error('[origen-sitio] No se pudo leer el dominio', {
      organizationId,
      dominios: errorDominios?.message,
      org: errorOrg?.message,
    })
    return ''
  }
  const filas: DominioSitioCorreo[] = ((dominios || []) as any[]).map((d) => ({
    host: String(d.host || ''),
    domainType: String(d.domain_type || ''),
    status: String(d.status || ''),
    isPrimary: d.is_primary === true,
    isActive: d.is_active === true,
    updatedAt: d.updated_at ?? null,
  }))
  return origenDesdeDatos({
    dominios: filas,
    subdomain: org?.subdomain ?? null,
  })
}
