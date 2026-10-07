/**
 * Datos de las secciones que antes salían SIEMPRE vacías porque
 * `app/[[...slug]]/page.tsx` no los cargaba: `class_schedule` (data.classes),
 * `routes` (data.routes), `fleet_showcase` (data.vehicles) y `membership_plans`
 * (data.membershipPlans).
 *
 * Una consulta cacheada por sección, y solo si la página tiene la sección:
 * - Clases y flota no llevan precio → `cacheStructural` (60 s) + `react.cache`.
 * - Rutas (tarifa) y planes (precio) llevan precio → `cacheCatalog` (30 s,
 *   etiqueta `catalogo-<org>` que invalida el ERP), como el resto del catálogo.
 *
 * Columnas verificadas por MCP (jgmgphmzusbluqhuqihj) el 2026-10-06:
 * - gym_classes: id, organization_id, branch_id, title, instructor_id
 *   (FK a auth.users, NO a profiles: por eso el nombre va en una segunda
 *   lectura de `profiles`), capacity, start_at, end_at, recurrence, status
 *   ('active' | 'cancelled' | 'completed'), room, location, difficulty_level
 *   ('beginner' | 'intermediate' | 'advanced' | 'all_levels').
 * - vehicles: id, organization_id, branch_id, vehicle_type, passenger_capacity,
 *   brand, model, year, status, is_active, metadata. Placa, VIN y vencimientos
 *   NO se leen: no son para el público.
 * - transport_routes / membership_plans: las mismas consultas de siempre
 *   (`getTransportRoutes`, `getMembershipPlans`), no una segunda versión.
 *
 * Service role: aquí no hay RLS. `organizationId` sale del host (getOrgContext).
 */

import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog, cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { getMembershipPlans, getOrganizationServices, getTransportRoutes, type MembershipPlanPublic } from '@/lib/supabase/queries'
import { MAX_SERVICIOS, servicioDesdeCatalogo, servicioDesdeProducto, type ServicioSeccion } from '@/lib/website/serviciosSeccion'

function cliente() {
  return createAdminClient() || createPublicClient()
}

// ---------------------------------------------------------------------------
// Clases (gym)
// ---------------------------------------------------------------------------

export interface ClaseSeccion {
  id: number
  title: string
  difficulty_level: string | null
  instructor_name: string | null
  start_at: string
  end_at: string
  room: string | null
  capacity: number | null
  recurrente: boolean
}

const MAX_CLASES = 60

async function getClasesUncached(organizationId: number, branchId: number | null): Promise<ClaseSeccion[]> {
  const supabase = cliente()
  const ahora = new Date().toISOString()
  // Próximas, o recurrentes (su `start_at` es la primera sesión y puede haber pasado).
  let consulta = (supabase as any)
    .from('gym_classes')
    .select('id, title, instructor_id, capacity, start_at, end_at, recurrence, room, location, difficulty_level, branch_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .or(`end_at.gte."${ahora}",recurrence.not.is.null`)
    .order('start_at', { ascending: true })
    .limit(MAX_CLASES)
  if (branchId !== null) consulta = consulta.or(`branch_id.is.null,branch_id.eq.${branchId}`)

  const { data, error } = await consulta
  if (error) {
    console.error('[datosSecciones] gym_classes', { organizationId, error: error.message })
    return []
  }
  const filas = (data ?? []) as any[]

  const instructores = Array.from(new Set(filas.map((c) => c.instructor_id).filter(Boolean))) as string[]
  const nombres = new Map<string, string>()
  if (instructores.length > 0) {
    const { data: perfiles } = await (supabase as any)
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', instructores)
    for (const p of (perfiles ?? []) as any[]) {
      const nombre = [p.first_name, p.last_name].filter((v: unknown) => typeof v === 'string' && v.trim()).join(' ').trim()
      if (nombre) nombres.set(p.id, nombre)
    }
  }

  return filas.map((c) => ({
    id: c.id,
    title: c.title,
    difficulty_level: c.difficulty_level ?? null,
    instructor_name: c.instructor_id ? nombres.get(c.instructor_id) ?? null : null,
    start_at: c.start_at,
    end_at: c.end_at,
    room: c.room ?? c.location ?? null,
    capacity: typeof c.capacity === 'number' ? c.capacity : null,
    recurrente: c.recurrence !== null && c.recurrence !== undefined,
  }))
}

export const getClasesDeSeccion = cache(
  cacheStructural('getClasesDeSeccion', getClasesUncached, CONTENT_TTL),
)

// ---------------------------------------------------------------------------
// Flota (transporte)
// ---------------------------------------------------------------------------

export interface VehiculoSeccion {
  id: string
  brand: string | null
  model: string | null
  year: number | null
  passenger_capacity: number | null
  vehicle_type: string | null
  image_url: string | null
}

const MAX_VEHICULOS = 24

async function getFlotaUncached(organizationId: number, branchId: number | null): Promise<VehiculoSeccion[]> {
  let consulta = (cliente() as any)
    .from('vehicles')
    .select('id, brand, model, year, passenger_capacity, vehicle_type, metadata, branch_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .limit(MAX_VEHICULOS)
  if (branchId !== null) consulta = consulta.or(`branch_id.is.null,branch_id.eq.${branchId}`)

  const { data, error } = await consulta
  if (error) {
    console.error('[datosSecciones] vehicles', { organizationId, error: error.message })
    return []
  }
  return ((data ?? []) as any[]).map((v) => {
    const foto = v.metadata && typeof v.metadata === 'object' ? (v.metadata as Record<string, unknown>).image_url : null
    return {
      id: v.id,
      brand: v.brand ?? null,
      model: v.model ?? null,
      year: typeof v.year === 'number' ? v.year : null,
      passenger_capacity: typeof v.passenger_capacity === 'number' ? v.passenger_capacity : null,
      vehicle_type: v.vehicle_type ?? null,
      image_url: typeof foto === 'string' && /^https:\/\//.test(foto) ? foto : null,
    }
  })
}

export const getFlotaDeSeccion = cache(
  cacheStructural('getFlotaDeSeccion', getFlotaUncached, CONTENT_TTL),
)

// ---------------------------------------------------------------------------
// Rutas (transporte): tarifa → caché del catálogo
// ---------------------------------------------------------------------------

export interface RutaSeccion {
  id: string
  name: string
  code: string | null
  origin_name: string | null
  destination_name: string | null
  base_fare: number | null
}

async function getRutasUncached(organizationId: number): Promise<RutaSeccion[]> {
  const rutas = (await getTransportRoutes(organizationId)) as any[]
  return rutas.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code ?? null,
    origin_name: r.origin?.name ?? null,
    destination_name: r.destination?.name ?? null,
    base_fare: r.base_fare !== null && r.base_fare !== undefined ? Number(r.base_fare) : null,
  }))
}

export const getRutasDeSeccion = cache(
  cacheCatalog('getRutasDeSeccion', getRutasUncached, (organizationId) => organizationId),
)

// ---------------------------------------------------------------------------
// Planes de membresía: precio → caché del catálogo
// ---------------------------------------------------------------------------

export const getPlanesDeSeccion = cache(
  cacheCatalog(
    'getPlanesDeSeccion',
    (organizationId: number): Promise<MembershipPlanPublic[]> => getMembershipPlans(organizationId),
    (organizationId) => organizationId,
  ),
)

// ---------------------------------------------------------------------------
// Servicios (`services_list`): precio → caché del catálogo
// ---------------------------------------------------------------------------
//
// La sección leía `data.services`, que nadie cargaba: los 50 sitios con la sección pintaban
// «No hay servicios configurados aún». Misma fuente que la página /servicios
// (app/[[...slug]]/page.tsx), con la misma regla:
// - organizaciones de servicios (type_id 4): su catálogo `organization_services` activo. Sin
//   descripción ni precio anterior: la tabla no los tiene (verificado por MCP el 2026-10-07:
//   id, organization_id, service_id, custom_name, custom_icon, custom_category, is_active,
//   created_at, price, linked_product_id; `services`: id, name, icon, category, is_default).
// - las demás: productos activos con `unit_code = 'SV'` y su precio vigente, con
//   `compare_price` (`getOrganizationServices`, la misma consulta de /servicios).
// Una consulta cacheada por organización y sede (`cacheCatalog`, 30 s, etiqueta del catálogo
// que invalida el ERP), y solo si la página tiene la sección.

async function getServiciosUncached(organizationId: number, branchId: number | null, catalogoDeServicios: boolean): Promise<ServicioSeccion[]> {
  if (!catalogoDeServicios) {
    const productos = await getOrganizationServices(organizationId, MAX_SERVICIOS, branchId)
    return productos.map(servicioDesdeProducto)
  }
  const { data, error } = await cliente()
    .from('organization_services')
    .select('id, custom_name, custom_icon, price, services(name, icon)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(MAX_SERVICIOS)
  if (error) {
    console.error('[datosSecciones] organization_services', { organizationId, error: error.message })
    return []
  }
  return (data ?? []).map(servicioDesdeCatalogo)
}

export const getServiciosDeSeccion = cache(
  cacheCatalog('getServiciosDeSeccion', getServiciosUncached, (...args) => args[0]),
)
