/**
 * URL pública de la tienda. Una sola regla, la misma que `fn_url_publica_org`
 * y que `hostSitio` del ERP:
 *   1. dominio propio principal, verificado y activo
 *   2. subdominio del sistema activo
 *   3. `organizations.subdomain`
 * No lee `organizations.custom_domain`.
 */

export interface DominioPublico {
  host: string
  domainType: string
  status: string
  isPrimary: boolean
  isActive: boolean
  updatedAt?: string | null
}

export function hostLimpio(valor: string | null | undefined): string | null {
  if (!valor || typeof valor !== 'string') return null
  let host = valor.trim().toLowerCase()
  host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '')
  if (!host || host.length > 253 || host.includes('..') || host.includes(' ')) return null
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) return null
  return host
}

function subdominioLimpio(valor: string | null | undefined): string | null {
  if (!valor || typeof valor !== 'string') return null
  const sub = valor.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)) return null
  return sub
}

function momento(d: DominioPublico): number {
  const t = d.updatedAt ? Date.parse(d.updatedAt) : 0
  return Number.isFinite(t) ? t : 0
}

/** Host sin esquema, o null. */
export function hostPublico(dominios: readonly DominioPublico[], subdomain: string | null | undefined): string | null {
  const propio = (dominios || [])
    .map((d) => ({ ...d, host: hostLimpio(d.host) }))
    .filter((d): d is DominioPublico & { host: string } => {
      if (!d.host) return false
      return d.domainType === 'custom_domain' && d.status === 'verified' && d.isActive && d.isPrimary
    })
    .sort((a, b) => momento(b) - momento(a))[0]
  if (propio) return propio.host

  const sistema = (dominios || [])
    .map((d) => ({ ...d, host: hostLimpio(d.host) }))
    .filter((d): d is DominioPublico & { host: string } => !!d.host && d.domainType === 'system_subdomain' && d.isActive)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || momento(b) - momento(a))[0]
  if (sistema) return sistema.host

  const sub = subdominioLimpio(subdomain)
  return sub ? `${sub}.goadmin.io` : null
}

/** `https://host`, o cadena vacía si no hay host. */
export function urlPublicaDeOrganizacion(entrada: {
  dominios: readonly DominioPublico[]
  subdomain: string | null | undefined
}): string {
  const host = hostPublico(entrada.dominios, entrada.subdomain)
  return host ? `https://${host}` : ''
}
