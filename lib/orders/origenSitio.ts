/**
 * Origen público del sitio para los enlaces de un correo.
 *
 * Primero el dominio propio verificado (principal y activo). Después
 * `organizations.custom_domain`. Al final el subdominio de la plataforma.
 * Un host `*.goadmin.io` guardado como dominio propio no gana: ese es el respaldo.
 */

export interface DominioSitioCorreo {
  host: string
  domainType: string
  status: string
  isPrimary: boolean
  isActive: boolean
}

const TIPOS_PROPIOS = new Set(['custom_domain', 'custom_subdomain', 'www_alias'])
const ORDEN_TIPO: Record<string, number> = { custom_domain: 0, custom_subdomain: 1, www_alias: 2 }

export function hostLimpio(valor: string | null | undefined): string | null {
  if (!valor || typeof valor !== 'string') return null
  let host = valor.trim().toLowerCase()
  host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '')
  if (!host || host.length > 253 || host.includes('..')) return null
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) return null
  return host
}

function subdominioLimpio(valor: string | null | undefined): string | null {
  if (!valor || typeof valor !== 'string') return null
  const sub = valor.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)) return null
  return sub
}

export function origenDesdeDatos(entrada: {
  dominios: readonly DominioSitioCorreo[]
  customDomain: string | null
  subdomain: string | null
}): string {
  const propios = (entrada.dominios || [])
    .map((d) => ({ ...d, host: hostLimpio(d.host) }))
    .filter((d): d is DominioSitioCorreo & { host: string } => {
      if (!d.host || d.host.endsWith('.goadmin.io')) return false
      if (!d.isPrimary || !d.isActive || d.status !== 'verified') return false
      return TIPOS_PROPIOS.has(d.domainType)
    })
    .sort((a, b) => (ORDEN_TIPO[a.domainType] ?? 9) - (ORDEN_TIPO[b.domainType] ?? 9))
  if (propios[0]) return `https://${propios[0].host}`
  const custom = hostLimpio(entrada.customDomain)
  if (custom) return `https://${custom}`
  const sub = subdominioLimpio(entrada.subdomain)
  if (sub) return `https://${sub}.goadmin.io`
  return ''
}
