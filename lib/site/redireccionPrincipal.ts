/**
 * Redirección al dominio principal propio de la organización (2026-11-19).
 *
 * Si la organización tiene un dominio propio principal (organization_domains: custom_domain,
 * principal, activo, verificado, sin `misconfigured` y que no sea de una sede), toda visita por
 * su subdominio del sistema (*.goadmin.io / *.goadmin.co.uk) o por otro de sus dominios (con o
 * sin www) va con 308 al principal, misma ruta y query. Un solo sitio para Google y para el
 * cliente, y un solo carrito (el carrito vive en el almacenamiento del navegador, por dominio).
 *
 * El «www» del principal (decisión del dueño: en Vercel a veces se agrega y a veces no):
 *  - la regla NO lee la configuración de Vercel; la conoce por una sonda (`formaDelPrincipal`)
 *    que el middleware hace al propio principal y recuerda unos minutos;
 *  - `directo`: el principal sin www sirve la tienda → se redirige ahí, y www.principal también;
 *  - `via-www`: Vercel manda el principal a www.principal → se redirige directo a www.principal
 *    (un salto en vez de dos) y www.principal no se toca (si no, bucle con Vercel);
 *  - sin sonda o principal caído (404, sin DNS) → no se redirige nada: la tienda sigue por su
 *    subdominio como hoy. Dos principales registrados no respondían el día que se escribió esto.
 *
 * Pura: sin base, sin red y sin alias `@/`.
 */
import { hostLimpio, type DominioPublico } from './urlPublicaOrg'

export interface DominioDeOrg extends DominioPublico {
  misconfigured?: boolean | null
  /** Dominio propio de una sede: ni origen ni destino de esta redirección. */
  branchId?: number | null
}

/** Cómo sirve hoy el principal (lo dice la sonda): sin www, o pasando por www. */
export type FormaPrincipal = 'directo' | 'via-www'

/** Rutas que nunca se redirigen (prefijo). */
export const RUTAS_SIN_REDIRECCION: readonly string[] = [
  '/api/', // webhooks de pasarelas, auth, pedidos: los POST y las firmas no siguen redirecciones
  '/auth/', // el callback de Supabase necesita la cookie del dominio donde empezó el ingreso
  '/vista-previa/', // vista previa firmada del borrador
  '/_next/',
  '/.well-known/', // verificaciones de dominio (Apple Pay, ACME…)
]
/** Rutas exactas que nunca se redirigen. */
export const RUTAS_EXACTAS_SIN_REDIRECCION: readonly string[] = ['/api', '/auth', '/favicon.ico']

const METODOS = new Set(['GET', 'HEAD'])

/** Código de la redirección (permanente y conserva el método). */
export const CODIGO_REDIRECCION = 308

function momento(d: DominioDeOrg): number {
  const t = d.updatedAt ? Date.parse(d.updatedAt) : 0
  return Number.isFinite(t) ? t : 0
}

/** Host del dominio propio principal válido de la organización, o null. */
export function principalPropio(dominios: readonly DominioDeOrg[] | null | undefined): string | null {
  const candidato = (dominios ?? [])
    .map((d) => ({ ...d, host: hostLimpio(d.host) }))
    .filter(
      (d): d is DominioDeOrg & { host: string } =>
        !!d.host &&
        d.domainType === 'custom_domain' &&
        d.status === 'verified' &&
        d.isActive &&
        d.isPrimary &&
        d.misconfigured !== true &&
        (d.branchId === null || d.branchId === undefined)
    )
    .sort((a, b) => momento(b) - momento(a))[0]
  return candidato ? candidato.host.replace(/^www\./, '') : null
}

export function rutaSinRedireccion(pathname: string): boolean {
  if (RUTAS_EXACTAS_SIN_REDIRECCION.includes(pathname)) return true
  return RUTAS_SIN_REDIRECCION.some((prefijo) => pathname.startsWith(prefijo))
}

/** Hosts que nunca se redirigen: desarrollo y despliegues de Vercel (previews). */
export function hostDeDesarrollo(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^\d+(\.\d+){3}$/.test(host) ||
    host === 'vercel.app' ||
    host.endsWith('.vercel.app')
  )
}

export interface EntradaRedireccion {
  /** Cabecera `host` de la petición (con puerto o www, como venga). */
  host: string | null | undefined
  metodo: string
  pathname: string
  /** Dominios activos de la organización del host. */
  dominios: readonly DominioDeOrg[]
  /** El host es de una sede (sub-subdominio, branches.custom_domain o dominio con branch_id). */
  esSede: boolean
  /** Resultado de la sonda al principal; null = sin comprobar o caído. */
  forma: FormaPrincipal | null
}

/** Host al que hay que redirigir, o null si la petición se atiende aquí. */
export function hostDestinoRedireccion(e: EntradaRedireccion): string | null {
  const crudo = (e.host ?? '').trim().toLowerCase().replace(/:\d+$/, '')
  if (crudo === 'localhost' || crudo.endsWith('.localhost')) return null
  const host = hostLimpio(crudo)
  if (!host) return null
  if (!METODOS.has((e.metodo || '').toUpperCase())) return null
  if (rutaSinRedireccion(e.pathname || '/')) return null
  if (hostDeDesarrollo(host)) return null
  if (e.esSede) return null

  const principal = principalPropio(e.dominios)
  if (!principal || !e.forma) return null

  const sinWww = host.replace(/^www\./, '')
  // Un dominio de sede de la organización nunca se redirige (aunque llegue sin marcar).
  const fila = e.dominios.find((d) => hostLimpio(d.host)?.replace(/^www\./, '') === sinWww)
  if (fila && fila.branchId !== null && fila.branchId !== undefined) return null

  if (sinWww === principal) {
    // www.principal → principal solo si el principal sirve sin www (si no, bucle con Vercel).
    return host !== principal && e.forma === 'directo' ? principal : null
  }

  const destino = e.forma === 'via-www' ? `www.${principal}` : principal
  return destino === host ? null : destino
}

/** Cabecera de la sonda: con ella el middleware no redirige (evita sondas en cadena). */
export const CABECERA_SONDA = 'x-goadmin-sonda-principal'

/**
 * ¿Cómo sirve hoy el principal? Pide `/robots.txt` (barato, pasa por el middleware) y mira que
 * responda ESTA aplicación para ESE dominio (`x-custom-domain`). Un salto de Vercel a www se
 * sigue a mano una vez. Cualquier otra cosa (404, sin DNS, otra app, tiempo agotado) → null.
 */
export async function formaDelPrincipal(
  principal: string,
  fetchImpl: typeof fetch = fetch,
  tiempoLimiteMs = 2000
): Promise<FormaPrincipal | null> {
  const pedir = async (host: string) => {
    const controlador = new AbortController()
    const limite = setTimeout(() => controlador.abort(), tiempoLimiteMs)
    try {
      return await fetchImpl(`https://${host}/robots.txt`, {
        method: 'GET',
        redirect: 'manual',
        headers: { [CABECERA_SONDA]: '1' },
        signal: controlador.signal,
        cache: 'no-store',
      })
    } finally {
      clearTimeout(limite)
    }
  }
  const esEstaTienda = (r: Response) => r.status === 200 && (r.headers.get('x-custom-domain') || '').toLowerCase() === principal
  try {
    const r = await pedir(principal)
    if (esEstaTienda(r)) return 'directo'
    if (r.status >= 300 && r.status < 400) {
      const destino = r.headers.get('location') || ''
      let hostDestino = ''
      try {
        hostDestino = new URL(destino, `https://${principal}`).hostname.toLowerCase()
      } catch {
        return null
      }
      if (hostDestino !== `www.${principal}`) return null
      const r2 = await pedir(hostDestino)
      return esEstaTienda(r2) ? 'via-www' : null
    }
    return null
  } catch {
    return null
  }
}
