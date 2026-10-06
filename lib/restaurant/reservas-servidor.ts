/**
 * Ayudas de servidor de `/api/restaurant-reservations/**` (paquete D).
 *
 * Service role: la organización SIEMPRE llega ya resuelta desde el host
 * (`organizacionDeLaReserva`) y cada consulta filtra por ella.
 *
 * Todo lo que depende de las migraciones pendientes del ERP funciona antes y
 * después de aplicarlas:
 * - `p_validar_reglas` (D1) va siempre explícito (true solo con
 *   RESERVAS_ENFORCE_REGLAS=true) y, si la sobrecarga aún no existe
 *   (PGRST202), se repite la llamada de siempre;
 * - `manage_token` (D2) es opcional en la respuesta de la RPC.
 */

import { instanteEnZona } from './horario'
import { filaEfectiva } from './sedes-modelo'

export interface ArgsReservaWeb {
  p_organization_id: number
  p_reservation_date: string
  p_reservation_time: string
  p_party_size: number
  p_customer_name: string
  p_branch_id: number | null
  p_customer_phone: string | null
  p_customer_email: string | null
  p_zone: string | null
  p_notes: string | null
  p_source: 'website'
}

/**
 * Interruptor de las reglas de la sede, con el mismo patrón que
 * `WOMPI_WEBHOOK_ENFORCE_SIGNATURE`: SOLO `RESERVAS_ENFORCE_REGLAS=true`
 * bloquea. Sin la variable (o con cualquier otro valor) es modo observación:
 * la RPC crea la reserva aunque incumpla las reglas y devuelve
 * `regla_incumplida`, que se registra para medir antes de bloquear.
 *
 * Motivo (revisión 2026-10-07): `restaurant_booking_settings` tiene 0 filas y
 * hay 8 restaurantes con `reservation_cta` (16 secciones). Bloquear por
 * defecto los pasaría a los turnos de la base (inicios 12:00–13:30 y
 * 18:00–21:00) y perderían en silencio las reservas de desayuno o de después
 * de las 21:00.
 */
export function reglasEnObservacion(): boolean {
  return process.env.RESERVAS_ENFORCE_REGLAS !== 'true'
}

export async function crearReservaWeb(supabase: any, args: ArgsReservaWeb): Promise<{ data: any; error: any }> {
  const bloquear = !reglasEnObservacion()
  const nueva = await supabase.rpc('create_restaurant_reservation', {
    ...args,
    p_table_id: null,
    p_customer_id: null,
    p_duration_minutes: null,
    p_validar_reglas: bloquear,
  })
  if (nueva.error?.code === 'PGRST202') {
    // Sobrecarga de D1 aún no aplicada: la llamada de siempre (sin reglas).
    return supabase.rpc('create_restaurant_reservation', args)
  } else {
    if (nueva.data?.regla_incumplida) {
      console.warn('[Restaurant Reservations] regla incumplida (observación)', {
        orgId: args.p_organization_id,
        branchId: args.p_branch_id,
        regla: String(nueva.data.regla_incumplida).split(':')[0],
      })
    }
    return nueva
  }
}

export interface ContextoCorreoReserva {
  organizacion: { nombre: string; email: string | null }
  sede: { nombre: string; direccion: string | null; email: string | null; telefono: string | null } | null
  /** Correos del equipo (`notify_emails`): los de la sede; si no tiene fila, los de la organización. */
  correosEquipo: string[]
}

function correosValidos(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(c))
    .slice(0, 10)
}

/** Datos para los correos de la reserva: dos consultas pequeñas, filtradas por la organización del host. */
export async function contextoCorreoReserva(
  supabase: any,
  orgId: number,
  branchId: number | null,
): Promise<ContextoCorreoReserva> {
  const [org, ajustes] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, email, branches!branches_organization_id_fkey(id, name, address, city, email, phone)')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('restaurant_booking_settings')
      .select('branch_id, notify_emails')
      .eq('organization_id', orgId),
  ])

  const sedes: any[] = Array.isArray(org.data?.branches) ? org.data.branches : []
  const sede = branchId !== null ? sedes.find((b) => Number(b.id) === branchId) : null
  const fila = filaEfectiva<{ branch_id: number | null; notify_emails?: unknown }>(ajustes.data, branchId)

  const direccion = sede ? [sede.address, sede.city].filter(Boolean).join(', ') || null : null
  return {
    organizacion: { nombre: org.data?.name || 'El restaurante', email: org.data?.email || null },
    sede: sede
      ? { nombre: sede.name || 'Sede', direccion, email: sede.email || null, telefono: sede.phone || null }
      : null,
    correosEquipo: correosValidos(fila?.notify_emails),
  }
}

/** URL absoluta en el host público de la petición (dominio propio o subdominio). */
export function urlEnElSitio(request: Request, ruta: string): string | null {
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim()
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) || host.endsWith('.localhost')
  return `${local ? 'http' : 'https'}://${host}${ruta}`
}

// ---------------------------------------------------------------------------
// Gestión de la reserva por token (migración D2): página y API comparten esto.
// ---------------------------------------------------------------------------

export interface ReservaPorToken {
  code: string
  status: string
  customerName: string
  partySize: number
  date: string
  time: string
  notes: string | null
  cancellationReason: string | null
  sede: { nombre: string; direccion: string | null; telefono: string | null } | null
  zonaHoraria: string
  /** Horas de antelación para cancelar (sede → organización → 4). */
  horasCancelacion: number
  /** Instante límite para cancelar desde el enlace (ISO). */
  cancelableHasta: string
  /** El cliente puede cancelar ya mismo (estado y plazo). La base vuelve a decidir. */
  puedeCancelar: boolean
  /** Depósito de la reserva (migración D7); `null` si no lleva o si la migración no está. */
  deposito: {
    estado: string
    monto: number
    moneda: string
    reembolsableHasta: string | null
    venceEn: string | null
  } | null
}

const ESTADOS_CANCELABLES = new Set(['pending', 'confirmed'])
const HORAS_CANCELACION_POR_DEFECTO = 4

/**
 * Lee la reserva por `manage_token` + organización del host. `null` si no
 * existe, si es de otra organización o si la columna aún no existe (antes de
 * aplicar D2: no hay tokens emitidos).
 */
export async function leerReservaPorToken(
  supabase: any,
  orgId: number,
  token: string,
  ahora: Date = new Date(),
): Promise<ReservaPorToken | null> {
  const columnas =
    'id, branch_id, status, customer_name, party_size, reservation_date, reservation_time, notes, cancellation_reason, branches!restaurant_reservations_branch_id_fkey(name, address, city, phone)'
  const leer = (cols: string) =>
    supabase.from('restaurant_reservations').select(cols).eq('organization_id', orgId).eq('manage_token', token).maybeSingle()
  let { data: r, error } = await leer(
    `${columnas}, deposit_status, deposit_amount, deposit_currency, deposit_refundable_until, deposit_due_at`,
  )
  if (error?.code === '42703') {
    // Migración D7 sin aplicar: la lectura de siempre, sin depósito.
    ;({ data: r, error } = await leer(columnas))
  }
  if (error || !r) {
    if (error && error.code !== '42703') console.error('[reserva/mesa] lectura por token', error.code)
    return null
  }

  const [zona, ajustes] = await Promise.all([
    supabase.rpc('fn_timezone_for', { p_organization_id: orgId, p_branch_id: r.branch_id }),
    supabase
      .from('restaurant_booking_settings')
      .select('branch_id, cancellation_hours')
      .eq('organization_id', orgId),
  ])
  const zonaHoraria = typeof zona.data === 'string' && zona.data ? zona.data : 'America/Bogota'
  const fila = filaEfectiva<{ branch_id: number | null; cancellation_hours?: unknown }>(
    ajustes.data,
    r.branch_id == null ? null : Number(r.branch_id),
  )
  const horas = Number.isFinite(Number(fila?.cancellation_hours)) ? Number(fila?.cancellation_hours) : HORAS_CANCELACION_POR_DEFECTO

  const hora = String(r.reservation_time).slice(0, 5)
  const inicio = instanteEnZona(r.reservation_date, hora, zonaHoraria)
  const limite = new Date(inicio.getTime() - horas * 3_600_000)
  const sede = r.branches
    ? {
        nombre: r.branches.name || 'Sede',
        direccion: [r.branches.address, r.branches.city].filter(Boolean).join(', ') || null,
        telefono: r.branches.phone || null,
      }
    : null

  return {
    code: String(r.id).slice(0, 8).toUpperCase(),
    status: r.status,
    customerName: r.customer_name,
    partySize: r.party_size,
    date: r.reservation_date,
    time: hora,
    notes: r.notes ?? null,
    cancellationReason: r.cancellation_reason ?? null,
    sede,
    zonaHoraria,
    horasCancelacion: horas,
    cancelableHasta: limite.toISOString(),
    puedeCancelar: ESTADOS_CANCELABLES.has(r.status) && ahora.getTime() < limite.getTime(),
    deposito:
      r.deposit_status && Number(r.deposit_amount) > 0
        ? {
            estado: String(r.deposit_status),
            monto: Number(r.deposit_amount),
            moneda: String(r.deposit_currency || 'COP').toUpperCase(),
            reembolsableHasta: r.deposit_refundable_until ?? null,
            venceEn: r.deposit_due_at ?? null,
          }
        : null,
  }
}
