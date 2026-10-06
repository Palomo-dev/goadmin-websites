/**
 * SEO local por sede: URL pública, metadatos (canonical, Open Graph, título) y
 * datos estructurados Restaurant/LocalBusiness.
 *
 * Contrato para `app/[[...slug]]/page.tsx` (paquete de carta) y las rutas propias:
 *   - `urlsSitio(...)`     → la base pública del sitio que se sirve (con la sede).
 *     `getOrgContext` ya la expone como `ctx.urlBase` / `ctx.urlBasePrincipal`.
 *   - `metadataSede(...)`  → `metadataBase`, `alternates.canonical`, `openGraph.url`
 *     y el título «Página · Sede | Marca». Se mezcla sobre el `Metadata` de la página.
 *   - `jsonLdSedes(...)`   → un Restaurant/LocalBusiness por sede (en la home de una
 *     sede, la suya; en el sitio principal, una por sede cuando la página tiene
 *     `hours_location`).
 *
 * Puro: no consulta nada. Las sedes llegan de `getSedesRestaurante` (cacheada).
 */

import type { Metadata } from 'next'
import { buildRestaurantJsonLd, type EspecificacionHorario } from '@/components/site/JsonLd'
import { DIAS, horarioRevisado, turnosDe, type Dia, type HorarioSemana } from '@/lib/restaurant/horario'
import { sedeAceptaReservas, type SedeSitio, type SedesRestaurante } from '@/lib/restaurant/sedes-modelo'

/** Dominio de los subdominios de sitios. El mismo literal que usa page.tsx para la base. */
export const DOMINIO_SITIOS = 'goadmin.io'

export interface OrgUrl {
  subdomain?: string | null
  custom_domain?: string | null
}

export interface SedeUrl {
  branchSlug: string
  customDomain?: string | null
}

export interface UrlsSitio {
  /** Base del sitio principal de la organización (sin barra final). */
  urlBasePrincipal: string
  /** Base del sitio que se sirve: la del principal, o la de la sede (host propio o `/<slug>`). */
  urlBase: string
}

/** Base pública del sitio principal: la misma fórmula de `app/[[...slug]]/page.tsx`. */
export function urlBasePrincipal(org: OrgUrl): string {
  return org.custom_domain
    ? `https://${org.custom_domain}`
    : `https://${(org.subdomain ?? '').toLowerCase()}.${DOMINIO_SITIOS}`
}

/**
 * URL pública de una sede publicada, con el mismo orden que el sitio la resuelve:
 * dominio propio de la sede → `/<slug>` bajo la base del principal.
 */
export function urlPublicaSede(org: OrgUrl, sede: { slug?: string | null; customDomain?: string | null }): string | null {
  if (sede.customDomain) return `https://${sede.customDomain}`
  if (!sede.slug) return null
  return `${urlBasePrincipal(org)}/${encodeURIComponent(sede.slug)}`
}

/**
 * Bases de la petición actual.
 * - Sede por dominio propio (`hostSede` = `x-custom-outlet-domain`): `https://<host>`.
 * - Sede por sub-subdominio (`hostSede` = host completo de la petición): `https://<host>`.
 * - Sede por prefijo de ruta: `<principal>/<slug>`.
 * - Sin sede: la del principal.
 */
export function urlsSitio(params: {
  organization: OrgUrl
  outlet: SedeUrl | null
  porPrefijo: boolean
  hostSede?: string | null
}): UrlsSitio {
  const principal = urlBasePrincipal(params.organization)
  if (!params.outlet) return { urlBasePrincipal: principal, urlBase: principal }
  if (params.porPrefijo) {
    return { urlBasePrincipal: principal, urlBase: `${principal}/${encodeURIComponent(params.outlet.branchSlug)}` }
  }
  const host = (params.hostSede ?? '').trim().toLowerCase().replace(/^www\./, '')
  if (host && /^[a-z0-9.-]+$/.test(host)) return { urlBasePrincipal: principal, urlBase: `https://${host}` }
  if (params.outlet.customDomain) return { urlBasePrincipal: principal, urlBase: `https://${params.outlet.customDomain}` }
  return { urlBasePrincipal: principal, urlBase: `${principal}/${encodeURIComponent(params.outlet.branchSlug)}` }
}

/**
 * Metadatos que dependen de la sede. `slugPagina` es el slug efectivo (sin el prefijo de
 * sede), `'home'` para la portada. `tituloPagina` null en la portada.
 */
export function metadataSede(params: {
  urlBase: string
  slugPagina: string
  marca: string
  sede?: { branchName: string } | null
  tituloPagina?: string | null
}): Pick<Metadata, 'metadataBase' | 'alternates' | 'title'> & { openGraph: { url: string } } {
  const url = params.slugPagina === 'home' ? params.urlBase : `${params.urlBase}/${params.slugPagina}`
  const partes = [params.tituloPagina, params.sede?.branchName].filter((p): p is string => !!p && p.trim() !== '')
  const title = partes.length > 0 ? `${partes.join(' · ')} | ${params.marca}` : params.marca
  return {
    metadataBase: new URL(params.urlBase.endsWith('/') ? params.urlBase : `${params.urlBase}/`),
    alternates: { canonical: url },
    openGraph: { url },
    title,
  }
}

const DIA_SCHEMA: Record<Dia, string> = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday',
}

/**
 * `openingHoursSpecification` de schema.org, un elemento por turno. El horario por
 * defecto del ERP (sin revisar) no se publica: sería un horario inventado en Google.
 */
export function especificacionHorario(horario: HorarioSemana | null): EspecificacionHorario[] {
  const revisado = horarioRevisado(horario)
  if (!revisado) return []
  return DIAS.flatMap((dia) =>
    turnosDe(revisado[dia]).map((t) => ({
      '@type': 'OpeningHoursSpecification' as const,
      dayOfWeek: DIA_SCHEMA[dia],
      opens: t.abre,
      // schema.org: un cierre después de medianoche se expresa con la hora del día siguiente.
      closes: t.cierra === '24:00' ? '23:59' : t.cierra,
    })),
  )
}

/**
 * Un Restaurant (type_id 1) o LocalBusiness por sede. `urlDe` decide la URL de cada sede
 * (la de la petición si es la sede actual; `urlPublicaSede` o la del principal si no).
 */
export function jsonLdSedes(params: {
  sedes: SedeSitio[]
  datos: SedesRestaurante | null
  urlDe: (sede: SedeSitio) => string
  marca: string
  esRestaurante: boolean
  logo?: string | null
}): Record<string, unknown>[] {
  return params.sedes.map((sede) => {
    const url = params.urlDe(sede)
    return buildRestaurantJsonLd(
      {
        nombre: sede.nombre,
        direccion: sede.direccion,
        ciudad: sede.ciudad,
        telefono: sede.telefono,
        lat: sede.lat,
        lng: sede.lng,
        foto: sede.foto,
      },
      url,
      {
        tipo: params.esRestaurante ? 'Restaurant' : 'LocalBusiness',
        marca: params.marca,
        horario: especificacionHorario(sede.horario),
        aceptaReservas: params.datos ? sedeAceptaReservas(sede, params.datos) : undefined,
        carta: params.esRestaurante ? `${url}/menu` : null,
        logo: params.logo ?? null,
      },
    )
  })
}
