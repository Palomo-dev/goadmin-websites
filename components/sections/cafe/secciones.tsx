/**
 * Variantes de la plantilla «Café de especialidad» para el SectionRenderer (servidor).
 * Contrato: lib/website/v2/contrato/seccionesCafe.ts (copia del ERP, `npm run verify:copias`).
 *
 * - `hero` · `carousel_editorial`      → PortadaEditorial
 * - `how_it_works` · `chapters`        → HistoriaCapitulos
 * - `menu_full` · `dotted`             → CartaPuntos
 * - `reservation` · `floor_plan`       → ReservaPlano (sin plano dibujado: `Reservation` · `stepper`)
 *
 * Sin directiva de cliente a propósito (como MenuFull.tsx y mesa/secciones.tsx): el manifiesto del
 * sitio (lib/sectionManifest.ts) lee `CONTENT_KEYS` de cada componente desde un route handler.
 * Aquí se normaliza el contenido y se recorta lo que viaja al navegador. Ninguna consulta: los
 * datos los precarga `app/[[...slug]]/page.tsx` (la carta y las sedes, como para las variantes de
 * siempre; el plano solo si la página tiene `floor_plan`).
 *
 * Solo se activan con estas variantes: ningún otro sitio cambia.
 */

import type { OrganizationWithDetails } from '@/types/database'
import {
  CLAVES_CARTA_PUNTOS,
  CLAVES_DISENO_CARTA_PUNTOS,
  CLAVES_DISENO_HISTORIA_CAPITULOS,
  CLAVES_DISENO_PORTADA_EDITORIAL,
  CLAVES_DISENO_RESERVA_PLANO,
  CLAVES_HISTORIA_CAPITULOS,
  CLAVES_PORTADA_EDITORIAL,
  CLAVES_RESERVA_PLANO,
  DISENO_HISTORIA_CAPITULOS,
  VARIANTE_RESPALDO_SIN_PLANO,
  cartaConBarra,
  normalizarCartaPuntos,
  normalizarHistoriaCapitulos,
  normalizarPortadaEditorial,
  normalizarReservaPlano,
  resolverModoReserva,
  selectorSedeVisible,
} from '@/lib/website/v2/contrato/seccionesCafe'
import { heroSolapa } from '@/lib/website/espacioHeader'
import { buildMenuGroups, mapaDeTags, type MenuItem, type MenuSourceCategory, type MenuSourceProduct, type MenuTagSource } from '@/lib/menu/menuFull'
import { aplicarCartaPlatos, leerCartaPlatos } from '@/lib/menu/cartaPlatos'
import { ajustesDeSede, direccionCompleta, esSedesRestaurante, type SedesRestaurante } from '@/lib/restaurant/sedes-modelo'
import { planoConZonas, reservasActivas, sedesDeReservaPlano, type PlanoSede } from '@/lib/restaurant/planoMesas'
import { CONTENT_KEYS as CLAVES_MENU_FULL, resolverCartaErp } from '@/components/sections/restaurant/MenuFull'
import { CONTENT_KEYS as CLAVES_RESERVATION, Reservation } from '@/components/sections/restaurant/Reservation'
import { PortadaEditorial } from './PortadaEditorial'
import { HistoriaCapitulos } from './HistoriaCapitulos'
import { CartaPuntos, type CategoriaCarta, type PlatoCarta, type SedeCarta } from './CartaPuntos'
import { ReservaPlano, type SedeReservaPlano } from './ReservaPlano'

interface PropsServidor {
  content: Record<string, unknown>
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function idsDe(v: unknown): number[] {
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
}

function hex(v: unknown): string | null {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim()) ? v.trim() : null
}

function sedesDe(data: Record<string, unknown> | undefined): SedesRestaurante | null {
  return esSedesRestaurante(data?.sedesRestaurante) ? data.sedesRestaurante : null
}

// ─── hero · «Carrusel editorial» ─────────────────────────────────────────────────────────────

export function SeccionPortadaEditorial({ content, organization, data }: PropsServidor) {
  const c = content || {}
  const portada = normalizarPortadaEditorial(c)
  const mostrarTitulo = c.show_title !== false
  // Sin fotos: la portada de la sede de la página o de la principal, si la página ya trae las sedes.
  const sedes = sedesDe(data)
  const sedePagina = typeof data?.branchId === 'number' ? data.branchId : null
  const sede = sedes ? (sedePagina !== null ? sedes.sedes.find((s) => s.id === sedePagina) : sedes.sedes.find((s) => s.esPrincipal)) ?? sedes.sedes[0] : null
  return (
    <PortadaEditorial
      portada={portada}
      titulo={mostrarTitulo ? str(c.title) ?? organization.name : null}
      subtitulo={mostrarTitulo ? str(c.subtitle) : null}
      mostrarBotones={c.show_cta !== false}
      fotoRespaldo={sede?.foto ?? null}
      // Misma regla que SectionWrapperBase (clave cruda `overlap_header`).
      solapaEncabezado={heroSolapa(organization.website_settings as Parameters<typeof heroSolapa>[0], c.overlap_header)}
    />
  )
}
SeccionPortadaEditorial.CONTENT_KEYS = [
  'title',
  'subtitle',
  'show_title',
  'show_cta',
  'slides',
  'buttons',
  'autoplay',
  'interval_ms',
  'pause_on_hover',
  'loop',
  'transition',
  'show_arrows',
  'show_dots',
  'dot_style',
  'enable_swipe',
  'height',
  'content_position',
  'text_align',
  'overlap_header',
  'show_overlay',
  'overlay_opacity',
  ...CLAVES_PORTADA_EDITORIAL,
  ...CLAVES_DISENO_PORTADA_EDITORIAL,
] as const

// ─── how_it_works · «Capítulos» ──────────────────────────────────────────────────────────────

export function SeccionHistoriaCapitulos({ content }: PropsServidor) {
  const c = content || {}
  const d = DISENO_HISTORIA_CAPITULOS
  const radio = num(c.card_radius)
  const borde = num(c.card_border_width)
  const columnas = num(c.columns)
  const separacion = num(c.gap)
  return (
    <HistoriaCapitulos
      historia={normalizarHistoriaCapitulos(c)}
      tarjeta={{
        radio: radio !== null && radio >= 0 && radio <= 64 ? radio : d.cardRadius,
        borde: borde !== null && borde >= 0 && borde <= 8 ? borde : d.cardBorderWidth,
        colorBorde: hex(c.card_border_color),
        fondo: hex(c.card_bg),
        sombra: typeof c.card_shadow === 'string' ? c.card_shadow !== 'none' : d.cardShadow !== 'none',
        columnas: columnas !== null && Number.isInteger(columnas) && columnas >= 1 && columnas <= 4 ? columnas : d.columns,
        separacion: separacion !== null && separacion >= 0 && separacion <= 80 ? separacion : d.gap,
      }}
    />
  )
}
SeccionHistoriaCapitulos.CONTENT_KEYS = [
  'title',
  'subtitle',
  'items',
  'aspect_ratio',
  'columns',
  'gap',
  'card_radius',
  'card_shadow',
  'card_border_width',
  'card_border_color',
  'card_bg',
  ...CLAVES_HISTORIA_CAPITULOS,
  ...CLAVES_DISENO_HISTORIA_CAPITULOS,
] as const

// ─── menu_full · «Línea de puntos» ───────────────────────────────────────────────────────────

function plato(it: MenuItem): PlatoCarta | null {
  // Sin precio o agotado en la sede: no aparece (lámina 02).
  if (it.price === null || it.soldOut) return null
  return { id: it.id, nombre: it.name, descripcion: it.description, precio: it.price, precioAnterior: it.comparePrice }
}

/** Selector de sede de la carta: las elegidas o las publicadas con sitio propio; solo en el principal. */
function sedesDeCarta(datos: SedesRestaurante | null, elegidas: number[], esPaginaDeSede: boolean, mostrar: boolean, pageSlug: string): SedeCarta[] {
  if (!datos) return []
  const candidatas = datos.sedes.filter((s) => (elegidas.length > 0 ? elegidas.includes(s.id) : s.publicada || s.esPrincipal))
  if (!selectorSedeVisible({ showBranchSelector: mostrar }, { esPaginaDeSede, sedes: candidatas.length })) return []
  const ruta = pageSlug && pageSlug !== 'home' ? `/${pageSlug}` : ''
  return candidatas
    .filter((s) => s.esPrincipal || (s.publicada && s.slug))
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      href: s.esPrincipal ? ruta || '/' : `/${s.slug}${ruta}`,
      actual: s.esPrincipal,
    }))
}

export function SeccionCartaPuntos({ content, data }: PropsServidor) {
  const c = content || {}
  const carta = normalizarCartaPuntos(c)
  const fuente = Array.isArray(data?.menuProducts) ? data.menuProducts : Array.isArray(data?.products) ? data.products : []
  const products = fuente as MenuSourceProduct[]
  const categories = (Array.isArray(data?.categories) ? data.categories : []) as MenuSourceCategory[]
  const tags = mapaDeTags((Array.isArray(data?.productTags) ? data.productTags : []) as MenuTagSource[])
  const seleccion = Array.isArray(c.selected_category_ids) ? idsDe(c.selected_category_ids) : null

  // Mismas reglas que `menu_full` de siempre: cartas del ERP si las hay; si no, el contenido.
  const erp = resolverCartaErp(data?.cartasPublicas, c, 'anchors', products)
  const ids = erp ? erp.selectedIds : seleccion
  const cartaPlatos = erp ? erp.cartaPlatos : leerCartaPlatos(c)
  const grupos = aplicarCartaPlatos(buildMenuGroups(products, categories, ids, tags), cartaPlatos, ids)

  const categorias: CategoriaCarta[] = grupos
    .map((g) => ({ id: g.id, nombre: g.name, platos: g.items.map(plato).filter((p): p is PlatoCarta => p !== null) }))
    .filter((g) => g.platos.length > 0)
  if (categorias.length === 0) return null

  let destacados: PlatoCarta[] = []
  if (!cartaConBarra(carta)) {
    const todos = categorias.flatMap((g) => g.platos)
    const porId = new Map(todos.map((p) => [p.id, p]))
    const marcados = cartaPlatos.destacados.map((id) => porId.get(id)).filter((p): p is PlatoCarta => !!p)
    // Sin destacados marcados: los primeros platos de la carta (nunca una sección vacía).
    destacados = (marcados.length > 0 ? marcados : todos).slice(0, carta.featuredLimit)
  }

  const branchId = typeof data?.branchId === 'number' ? data.branchId : null
  return (
    <CartaPuntos
      carta={carta}
      eyebrow={str(c.eyebrow)}
      titulo={'title' in c ? str(c.title) : 'Nuestra carta'}
      subtitulo={str(c.subtitle)}
      categorias={cartaConBarra(carta) ? categorias : []}
      destacados={destacados}
      sedes={cartaConBarra(carta) ? sedesDeCarta(sedesDe(data), carta.branchIds, branchId !== null, carta.showBranchSelector, typeof data?.pageSlug === 'string' ? data.pageSlug : '') : []}
    />
  )
}
SeccionCartaPuntos.CONTENT_KEYS = [...CLAVES_MENU_FULL, ...CLAVES_CARTA_PUNTOS, ...CLAVES_DISENO_CARTA_PUNTOS] as const

// ─── reservation · «Plano de mesas» ──────────────────────────────────────────────────────────

function esPlanos(v: unknown): v is Record<number, PlanoSede> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function anclaValida(v: unknown): string {
  const a = str(v)
  return a && /^[a-z0-9][a-z0-9_-]*$/i.test(a) ? a : 'reservar'
}

export function SeccionReservaPlano(p: PropsServidor) {
  const { organization, data } = p
  const c = p.content || {}
  const opciones = normalizarReservaPlano(c)
  const datos = sedesDe(data)
  const planos = esPlanos(data?.planosMesas) ? data.planosMesas : {}
  const sedes: SedeReservaPlano[] = datos
    ? sedesDeReservaPlano(datos, { sedePagina: typeof data?.branchId === 'number' ? data.branchId : null, elegidas: idsDe(c.branch_ids), modoGuardado: c.booking_mode }).map((s) => {
        const plano = planos[s.id] ? planoConZonas(planos[s.id], opciones.zones) : null
        return {
          id: s.id,
          nombre: s.nombre,
          direccion: direccionCompleta(s),
          zonaHoraria: s.zonaHoraria,
          ajustes: ajustesDeSede(s, datos),
          horario: s.horario,
          modo: resolverModoReserva(c, { reservasActivas: reservasActivas(s, datos) }),
          plano: plano && plano.hayPlano ? plano : null,
        }
      })
    : []

  // Sin ninguna sede con plano dibujado: la misma sección como «stepper» (nunca un plano vacío).
  if (!sedes.some((s) => s.plano)) {
    return <Reservation {...p} sectionVariant={VARIANTE_RESPALDO_SIN_PLANO} />
  }
  return (
    <ReservaPlano
      reserva={opciones}
      organizationId={organization.id}
      organizationName={organization.name}
      sedes={sedes}
      eyebrow={'eyebrow' in c ? str(c.eyebrow) : 'Reservas'}
      title={str(c.title)}
      subtitle={str(c.subtitle)}
      ctaText={str(c.cta_text)}
      minGuests={num(c.min_guests)}
      maxGuests={num(c.max_guests)}
      maxDays={num(c.max_days)}
      requireEmail={c.require_email === true}
      showNotes={c.show_notes !== false}
      policyText={str(c.policy_text)}
      successMessage={str(c.success_message)}
      pendingMessage={str(c.pending_message)}
      anchorId={anclaValida(c.anchor_id)}
    />
  )
}
SeccionReservaPlano.CONTENT_KEYS = [...CLAVES_RESERVATION, ...CLAVES_RESERVA_PLANO, ...CLAVES_DISENO_RESERVA_PLANO] as const
