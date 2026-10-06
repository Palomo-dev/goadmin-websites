/**
 * Datos de sede que el layout de TODAS las páginas necesita y que hoy no le llegan:
 * - el prefijo de la sede (enlaces del encabezado, el logo y el pie),
 * - las sedes publicadas para el selector del encabezado,
 * - la barra fija móvil del restaurante («Reservar · Cómo llegar · Pedir»),
 * - el horario del pie (el de la sede revisado, si lo hay).
 *
 * Lo llama `OrganizationLayout` (servidor) con la organización y la sede que ya resolvió
 * cada página, así que ninguna de las ~25 rutas que montan el layout cambia.
 *
 * Coste por render: `getSedesWeb` (1 consulta por organización cada 60 s); en restaurantes,
 * además `getSedesRestaurante` y `getPaginasPublicas` (ambas cacheadas y compartidas con las
 * secciones). Sin sedes publicadas (hoy, todas) el selector no se pinta.
 */

import { headers } from 'next/headers'
import type { OrganizationWithDetails, WebsiteSettings } from '@/types/database'
import type { ResolvedOutlet } from './resolver'
import { CABECERA_SEDE_RUTA } from '@/lib/get-org-context'
import { conPrefijo, prefijoSede } from './rutaSitio'
import { getSedesWeb, getSedesRestaurante } from '@/lib/restaurant/sedes'
import { direccionCompleta, sedeAceptaReservas } from '@/lib/restaurant/sedes-modelo'
import { horarioDeSede, horarioRevisado, type HorarioSemana } from '@/lib/restaurant/horario'
import { urlBasePrincipal } from '@/lib/seo/sede'
import { urlComoLlegar, urlLlamar } from '@/lib/maps/comoLlegar'
import { getPaginasPublicas, rutaDePaginaCon } from '@/lib/seo/paginasPublicas'
import type { SedeSelector } from '@/components/site/header/SelectorSede'

export interface AccionesBarraMovil {
  pedir: string | null
  reservar: string | null
  /** `tel:` de la sede actual (o de la organización si la sede no tiene teléfono). */
  llamar: string | null
  comoLlegar: string | null
}

export interface DatosSedeLayout {
  /** `''` o `'/sede-norte'`. */
  prefijoSede: string
  /** Sedes para el selector (vacío o 1 → no se pinta). */
  sedesSelector: SedeSelector[]
  /** «Ver todas las sedes y horarios» del selector: la página del sitio principal con «Horario y sedes»; null si no hay. */
  hrefTodasSedes: string | null
  /** Barra móvil del restaurante; null fuera de restaurantes o sin ninguna acción. */
  barraMovil: AccionesBarraMovil | null
  /** Horario de la sede de la página (o de la principal en restaurantes), revisado; null → el pie usa business_hours. */
  horarioPie: HorarioSemana | null
  /** Sede de la petición (la que pasó la página o la que resuelven las cabeceras del middleware). */
  sedeActualId: number | null
}

const VACIO: DatosSedeLayout = { prefijoSede: '', sedesSelector: [], hrefTodasSedes: null, barraMovil: null, horarioPie: null, sedeActualId: null }

export async function getDatosSedeLayout(
  organization: OrganizationWithDetails,
  outlet: ResolvedOutlet | null,
  settings: WebsiteSettings | null,
): Promise<DatosSedeLayout> {
  try {
    const h = await headers()
    const sedesWeb = await getSedesWeb(organization.id)

    // La sede de la petición. Varias rutas montan el layout sin pasar `outlet`; con las
    // cabeceras del middleware se reconoce igual, siempre contra las sedes PUBLICADAS de la
    // organización del host (getSedesWeb filtra por organization_id).
    const igual = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
    const subSede = h.get('x-outlet-subdomain')
    const dominioSede = h.get('x-custom-outlet-domain')
    const enHostDeSede = !!subSede || !!dominioSede
    const sedeRuta = enHostDeSede ? null : h.get(CABECERA_SEDE_RUTA)
    const sedeDeRuta = sedeRuta ? sedesWeb.find((s) => igual(s.slug, sedeRuta)) ?? null : null
    const sedeDeHost = dominioSede
      ? sedesWeb.find((s) => igual(s.customDomain, dominioSede)) ?? null
      : subSede
        ? sedesWeb.find((s) => igual(s.slug, subSede)) ?? null
        : null
    const sedeActualId = outlet?.branchId ?? sedeDeRuta?.id ?? sedeDeHost?.id ?? null
    // Prefijo solo si la sede de la petición es la que el middleware sacó de la ruta.
    const prefijo = sedeDeRuta?.slug && sedeDeRuta.id === sedeActualId ? prefijoSede({ branchSlug: sedeDeRuta.slug }, true) : ''
    // Desde el host de una sede (sub-subdominio o dominio propio) las demás sedes viven bajo el principal.
    const origen = enHostDeSede ? urlBasePrincipal(organization) : ''
    const sedesSelector: SedeSelector[] = sedesWeb.flatMap((s) => {
      const href = s.customDomain
        ? `https://${s.customDomain}`
        : s.slug
          ? `${origen}/${encodeURIComponent(s.slug)}`
          : s.esPrincipal
            ? origen
            : null
      if (href === null) return []
      return [{
        id: s.id,
        nombre: s.nombre,
        href,
        horario: horarioDeSede(s.horarioJson),
        zonaHoraria: s.zonaHoraria ?? organization.timezone ?? 'America/Bogota',
      }]
    })

    const esRestaurante = organization.type_id === 1
    let barraMovil: AccionesBarraMovil | null = null
    let horarioPie: HorarioSemana | null = null

    const sedeWebActual = sedeActualId !== null ? sedesWeb.find((s) => s.id === sedeActualId) ?? null : null
    if (sedeWebActual) horarioPie = horarioDeSede(sedeWebActual.horarioJson)

    if (esRestaurante) {
      const [datos, paginas] = await Promise.all([
        getSedesRestaurante(organization.id),
        getPaginasPublicas(organization.id, sedeActualId),
      ])
      const sedes = datos?.sedes ?? []
      const sedeActual = (sedeActualId !== null ? sedes.find((s) => s.id === sedeActualId) : null)
        ?? sedes.find((s) => s.esPrincipal)
        ?? sedes[0]
        ?? null
      if (!horarioPie && sedeActual) horarioPie = horarioRevisado(sedeActual.horario)

      const carta = rutaDePaginaCon(paginas, ['menu_full', 'menu_preview']) ?? '/menu'
      const paginaReserva = rutaDePaginaCon(paginas, ['reservation', 'reservation_cta'])
      const candidatas = sedeActualId !== null ? sedes.filter((s) => s.id === sedeActualId) : sedes
      const aceptaReservas = !!datos && (
        candidatas.some((s) => sedeAceptaReservas(s, datos)) || (sedeActualId === null && datos.mesasSinSede > 0)
      )
      const comoLlegar = urlComoLlegar(
        sedeActual
          ? { lat: sedeActual.lat, lng: sedeActual.lng, direccion: direccionCompleta(sedeActual) }
          : { direccion: [organization.address, organization.city].filter(Boolean).join(', ') || null },
      )
      const acciones: AccionesBarraMovil = {
        pedir: settings?.enable_online_ordering === true ? conPrefijo(carta, prefijo) : null,
        reservar: paginaReserva && aceptaReservas ? conPrefijo(paginaReserva, prefijo) : null,
        llamar: urlLlamar(sedeActual?.telefono ?? organization.phone),
        comoLlegar,
      }
      barraMovil = acciones.pedir || acciones.reservar || acciones.llamar || acciones.comoLlegar ? acciones : null
    }

    // «Ver todas las sedes y horarios»: solo si el selector se pinta (2+ sedes) y el sitio
    // principal tiene una página con la sección «Horario y sedes» (consulta cacheada).
    let hrefTodasSedes: string | null = null
    if (sedesSelector.length >= 2) {
      const pagina = rutaDePaginaCon(await getPaginasPublicas(organization.id, null), ['hours_location'])
      if (pagina) hrefTodasSedes = `${origen}${pagina}`
    }

    return { prefijoSede: prefijo, sedesSelector, hrefTodasSedes, barraMovil, horarioPie, sedeActualId }
  } catch (error) {
    // Nunca tumbar la página por el selector o la barra: se sirve el layout de antes.
    console.error('[sede-layout] Error armando los datos de sede del layout', {
      organizationId: organization.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return VACIO
  }
}
