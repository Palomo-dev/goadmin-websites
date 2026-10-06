/**
 * Depósito de la reserva de mesa (ERP: migración D7
 * `20261006170000_reservas_deposito_web`). Módulo PURO: lo usan los
 * formularios (cliente), las rutas y el webhook (servidor).
 *
 * La base decide si hay depósito y cuánto (`fn_reserva_mesa_deposito_cotizar`
 * y `fn_reserva_mesa_crear_web`): el navegador solo lo muestra. El monto que se
 * cobra es el que guardó la base en la reserva, nunca uno del body.
 */

/** Cotización para mostrar antes de reservar. */
export interface CotizacionDeposito {
  requiere: boolean
  /** Monto por reserva o por persona (según `porPersona`). */
  montoBase: number
  porPersona: boolean
  moneda: string
  reembolsable: boolean
  /** Horas antes de la reserva hasta las que se devuelve. */
  horasReembolso: number
  politica: string | null
  pasarela: string | null
  minutosParaPagar: number
}

export const SIN_DEPOSITO: CotizacionDeposito = {
  requiere: false,
  montoBase: 0,
  porPersona: false,
  moneda: 'COP',
  reembolsable: false,
  horasReembolso: 0,
  politica: null,
  pasarela: null,
  minutosParaPagar: 30,
}

/** Depósito de una reserva recién creada (respuesta de `fn_reserva_mesa_crear_web`). */
export interface DepositoCreado {
  monto: number
  moneda: string
  referencia: string
  vence: string
  pasarela: string
  estadoAlPagar: 'confirmed' | 'pending'
  reembolsable: boolean
  reembolsableHasta: string | null
  politica: string | null
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/** Lee la respuesta de `fn_reserva_mesa_deposito_cotizar` (o la de la ruta). */
export function parseCotizacion(raw: unknown): CotizacionDeposito {
  if (typeof raw !== 'object' || raw === null) return SIN_DEPOSITO
  const r = raw as Record<string, unknown>
  if (r.requiere !== true) return SIN_DEPOSITO
  const montoBase = num(r.monto_base ?? r.montoBase)
  if (montoBase <= 0) return SIN_DEPOSITO
  return {
    requiere: true,
    montoBase,
    porPersona: (r.por_persona ?? r.porPersona) === true,
    moneda: (txt(r.moneda) ?? 'COP').toUpperCase(),
    reembolsable: r.reembolsable === true,
    horasReembolso: Math.max(0, Math.floor(num(r.horas_reembolso ?? r.horasReembolso))),
    politica: txt(r.politica),
    pasarela: txt(r.pasarela),
    minutosParaPagar: num(r.minutos_para_pagar ?? r.minutosParaPagar) || 30,
  }
}

/** Lee `deposito` de la respuesta de `fn_reserva_mesa_crear_web`; `null` si no hay. */
export function parseDepositoCreado(raw: unknown): DepositoCreado | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const referencia = txt(r.referencia)
  const pasarela = txt(r.pasarela)
  const monto = num(r.monto)
  if (!referencia || !referencia.startsWith(PREFIJO_REFERENCIA) || !pasarela || monto <= 0) return null
  return {
    monto,
    moneda: (txt(r.moneda) ?? 'COP').toUpperCase(),
    referencia,
    vence: txt(r.vence) ?? '',
    pasarela,
    estadoAlPagar: r.estado_al_pagar === 'confirmed' ? 'confirmed' : 'pending',
    reembolsable: r.reembolsable === true,
    reembolsableHasta: txt(r.reembolsable_hasta),
    politica: txt(r.politica),
  }
}

/** Monto que verá el cliente para `personas` (mismo cálculo que la base). */
export function montoParaPersonas(c: CotizacionDeposito, personas: number): number {
  if (!c.requiere) return 0
  const n = Math.max(1, Math.floor(Number(personas) || 1))
  return Math.round(c.montoBase * (c.porPersona ? n : 1) * 100) / 100
}

/** «$ 80.000» en pesos (sin decimales cuando no los hay). */
export function formatoMonto(monto: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: Number.isInteger(monto) ? 0 : 2,
    }).format(monto)
  } catch {
    return `${moneda} ${monto}`
  }
}

/** Frase del depósito para el formulario: monto, cálculo y reembolso. */
export function textoDeposito(c: CotizacionDeposito, personas: number): string {
  const total = formatoMonto(montoParaPersonas(c, personas), c.moneda)
  const calculo = c.porPersona ? ` (${formatoMonto(c.montoBase, c.moneda)} por persona)` : ''
  const reembolso = c.reembolsable
    ? c.horasReembolso > 0
      ? ` Se devuelve si cancelas hasta ${c.horasReembolso} h antes.`
      : ' Se devuelve si cancelas antes de la hora de la reserva.'
    : ' No es reembolsable.'
  return `Depósito para reservar: ${total}${calculo}.${reembolso}`
}

// ---------------------------------------------------------------------------
// Pasarela
// ---------------------------------------------------------------------------

/** Referencia del cobro del depósito: `MESA-<uuid sin guiones>`. */
export const PREFIJO_REFERENCIA = 'MESA-'

export function esReferenciaDeposito(referencia: unknown): referencia is string {
  return typeof referencia === 'string' && /^MESA-[0-9A-F]{32}$/.test(referencia)
}

/** Estado de Wompi → estado del depósito que entiende `fn_reserva_mesa_deposito_resultado`. */
export function estadoDepositoWompi(estado: unknown): 'paid' | 'failed' | 'refunded' | 'pending' {
  switch (estado) {
    case 'APPROVED':
      return 'paid'
    case 'DECLINED':
    case 'ERROR':
      return 'failed'
    case 'VOIDED':
      return 'refunded'
    default:
      return 'pending'
  }
}

/** Fuente de cobro de `/api/checkout/init` para el depósito. */
export const FUENTE_COBRO_DEPOSITO = 'restaurant_reservation'
