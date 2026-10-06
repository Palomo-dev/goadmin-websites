/**
 * Modelo de las sedes del sitio (tipos, validación de la respuesta y reglas).
 *
 * Puro: lo importan componentes cliente y servidor. La consulta vive en
 * `./sedes.ts` (servidor), que no debe importarse desde el navegador.
 */

import type { RestaurantBookingSettings } from '@/types/database'
import { parseHorario, type HorarioSemana } from './horario'

type FilaAjustes = Pick<
  RestaurantBookingSettings,
  | 'branch_id'
  | 'is_enabled'
  | 'min_party_size'
  | 'max_party_size'
  | 'max_advance_days'
  | 'require_phone'
  | 'require_email'
  | 'require_confirmation'
  | 'policy_text'
  | 'allow_zone_choice'
  | 'allowed_zones'
  | 'slot_interval_minutes'
  | 'large_party_threshold'
>

export interface AjustesReserva {
  habilitada: boolean
  minPersonas: number
  maxPersonas: number
  maxDiasAnticipacion: number
  requiereTelefono: boolean
  requiereEmail: boolean
  /** true: la reserva entra `pending` (la confirma el equipo). */
  requiereConfirmacion: boolean
  politica: string | null
  /** Zonas elegibles por el cliente; vacío = no se ofrece elegir zona. */
  zonas: string[]
  intervaloMinutos: number
  /**
   * Grupos de MÁS personas que esto no reservan en línea: el sitio invita a
   * contactar y, si llegan, la RPC los deja `pending`. `null` = sin umbral.
   */
  grupoGrande: number | null
}

/**
 * Valores que usa la base cuando la sede no tiene configuración
 * (DEFAULT de `restaurant_booking_settings` y de las RPC). Una sola constante
 * para las dos secciones de reserva: antes el sitio usaba 8 personas y 30 días
 * mientras la base aceptaba 12 y 60.
 */
export const AJUSTES_RESERVA_POR_DEFECTO = {
  minPersonas: 1,
  maxPersonas: 12,
  maxDiasAnticipacion: 60,
  intervaloMinutos: 30,
} as const

export interface SedeSitio {
  id: number
  nombre: string
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  lat: number | null
  lng: number | null
  horario: HorarioSemana | null
  /** Zona IANA efectiva (sede → organización). */
  zonaHoraria: string
  foto: string | null
  esPrincipal: boolean
  slug: string | null
  publicada: boolean
  /** Mesas de la sede en `restaurant_tables`. Sin mesas no se puede reservar. */
  mesas: number
  /** Ajustes propios de la sede (`restaurant_booking_settings.branch_id = id`). */
  ajustes: AjustesReserva | null
}

export interface SedesRestaurante {
  sedes: SedeSitio[]
  /** Ajustes de toda la organización (`branch_id` null). */
  ajustesOrganizacion: AjustesReserva | null
  /** Mesas sin sede: sólo se reservan sin `branchId`. */
  mesasSinSede: number
  zonaOrganizacion: string
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function zonaValida(v: unknown): string | null {
  const z = texto(v)
  if (!z) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z })
    return z
  } catch {
    return null
  }
}

function parseAjustes(fila: Partial<Record<keyof FilaAjustes, unknown>>): AjustesReserva {
  const min = numero(fila.min_party_size) ?? AJUSTES_RESERVA_POR_DEFECTO.minPersonas
  const max = numero(fila.max_party_size) ?? AJUSTES_RESERVA_POR_DEFECTO.maxPersonas
  const grande = numero(fila.large_party_threshold)
  return {
    habilitada: fila.is_enabled !== false,
    minPersonas: Math.max(1, min),
    maxPersonas: Math.max(Math.max(1, min), max),
    maxDiasAnticipacion: Math.max(0, numero(fila.max_advance_days) ?? AJUSTES_RESERVA_POR_DEFECTO.maxDiasAnticipacion),
    requiereTelefono: fila.require_phone !== false,
    requiereEmail: fila.require_email === true,
    requiereConfirmacion: fila.require_confirmation === true,
    politica: texto(fila.policy_text),
    zonas:
      fila.allow_zone_choice === true
        ? lista(fila.allowed_zones).map(texto).filter((z): z is string => z !== null)
        : [],
    intervaloMinutos: numero(fila.slot_interval_minutes) ?? AJUSTES_RESERVA_POR_DEFECTO.intervaloMinutos,
    grupoGrande: grande !== null && grande >= 1 ? grande : null,
  }
}

/** Valida la respuesta de PostgREST: aquí no hay tipos inferidos (relaciones anidadas). */
export function parseSedesRestaurante(raw: unknown): SedesRestaurante | null {
  if (!esObjeto(raw)) return null
  const zonaOrganizacion = zonaValida(raw.timezone) ?? 'America/Bogota'

  const ajustesFilas = lista(raw.restaurant_booking_settings).filter(esObjeto)
  const ajustesPorSede = new Map<number, AjustesReserva>()
  let ajustesOrganizacion: AjustesReserva | null = null
  for (const fila of ajustesFilas) {
    const branchId = numero(fila.branch_id)
    if (branchId === null) ajustesOrganizacion = parseAjustes(fila)
    else ajustesPorSede.set(branchId, parseAjustes(fila))
  }

  const mesasPorSede = new Map<number, number>()
  let mesasSinSede = 0
  for (const mesa of lista(raw.restaurant_tables).filter(esObjeto)) {
    const branchId = numero(mesa.branch_id)
    if (branchId === null) mesasSinSede++
    else mesasPorSede.set(branchId, (mesasPorSede.get(branchId) ?? 0) + 1)
  }

  const sedes: SedeSitio[] = lista(raw.branches)
    .filter(esObjeto)
    .filter((b) => b.is_active !== false && numero(b.id) !== null)
    .map((b) => {
      const id = numero(b.id) as number
      return {
        id,
        nombre: texto(b.name) ?? `Sede ${id}`,
        direccion: texto(b.address),
        ciudad: texto(b.city),
        telefono: texto(b.phone),
        lat: numero(b.latitude),
        lng: numero(b.longitude),
        horario: parseHorario(b.opening_hours),
        zonaHoraria: zonaValida(b.timezone) ?? zonaOrganizacion,
        foto: texto(b.website_cover_url),
        esPrincipal: b.is_main === true,
        slug: texto(b.slug),
        publicada: b.is_web_published === true,
        mesas: mesasPorSede.get(id) ?? 0,
        ajustes: ajustesPorSede.get(id) ?? null,
      }
    })
    .sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.nombre.localeCompare(b.nombre, 'es'))

  return { sedes, ajustesOrganizacion, mesasSinSede, zonaOrganizacion }
}

// ---------------------------------------------------------------------------
// Reglas de negocio compartidas por las dos secciones (puras: cliente y servidor)
// ---------------------------------------------------------------------------

/** Ajustes efectivos de una sede: los suyos, si no los de la organización. */
/**
 * Fila efectiva de `restaurant_booking_settings` para una sede, sobre filas
 * crudas: la de la sede gana y la de la organización (`branch_id` NULL) es el
 * respaldo. Misma regla que `fn_ajustes_reserva` (D1) y que `ajustesDeSede`
 * (que trabaja sobre el modelo ya parseado). Sin sede, la de la organización.
 */
export function filaEfectiva<T extends { branch_id?: unknown }>(
  filas: readonly T[] | null | undefined,
  branchId: number | null,
): T | null {
  const lista = Array.isArray(filas) ? filas : []
  const propia = branchId !== null ? lista.find((f) => f.branch_id != null && Number(f.branch_id) === branchId) : undefined
  return propia ?? lista.find((f) => f.branch_id === null || f.branch_id === undefined) ?? null
}

export function ajustesDeSede(sede: SedeSitio | null, datos: SedesRestaurante): AjustesReserva | null {
  return sede?.ajustes ?? datos.ajustesOrganizacion
}

/** `data.sedesRestaurante` precargado por la página (forma mínima). */
export function esSedesRestaurante(v: unknown): v is SedesRestaurante {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sedes?: unknown }).sedes)
}

/**
 * Personas que ofrece un formulario de reserva: la sección solo puede
 * RESTRINGIR lo que fija la sede; sin ajustes, los de la base
 * (`AJUSTES_RESERVA_POR_DEFECTO`). Lo usan `reservation` y `reservation_cta`.
 */
export function limitesPersonas(
  ajustes: AjustesReserva | null,
  minSeccion: number | null | undefined,
  maxSeccion: number | null | undefined,
): { min: number; max: number } {
  const base = ajustes ?? AJUSTES_RESERVA_POR_DEFECTO
  const min = Math.max(base.minPersonas, minSeccion || base.minPersonas)
  const max = Math.max(min, Math.min(base.maxPersonas, maxSeccion || base.maxPersonas))
  return { min, max }
}

/**
 * Una sede acepta reservas web si tiene mesas (`create_restaurant_reservation`
 * con branch_id sólo asigna mesas de esa sede) y sus ajustes no las
 * deshabilitan. Sin fila propia, manda la de la organización; sin ninguna,
 * la RPC acepta con valores por defecto.
 */
export function sedeAceptaReservas(sede: SedeSitio, datos: SedesRestaurante): boolean {
  if (sede.mesas <= 0) return false
  const ajustes = ajustesDeSede(sede, datos)
  return ajustes ? ajustes.habilitada : true
}

/** Dirección legible: «Calle 00 # 00-00, Ciudad». */
export function direccionCompleta(sede: SedeSitio): string | null {
  const partes = [sede.direccion, sede.ciudad].filter(Boolean)
  if (partes.length === 0) return null
  // No repetir la ciudad si ya viene en la dirección.
  if (sede.direccion && sede.ciudad && sede.direccion.toLowerCase().includes(sede.ciudad.toLowerCase())) {
    return sede.direccion
  }
  return partes.join(', ')
}
