/**
 * Intentos de pago de un pedido web — reglas puras: de lo que manda cada pasarela al renglón que
 * se guarda en `web_order_payment_attempts` (ERP 20261125001000). Sin base, sin red y sin alias
 * `@/`, para que `scripts/verify-intentos-pago.mjs` las importe tal cual.
 *
 * Diseño aprobado 2026-11-24 (Figma «05 POS y ventas» › 3087:201491, tabla «Qué trae el aviso de
 * cada pasarela»):
 *  - Bold: aprobado, rechazado y anulaciones (SALE_APPROVED, SALE_REJECTED, VOID_APPROVED). NO manda
 *    motivo del rechazo ni «pendiente». Medio: CARD_WEB, NEQUI, PSE o QR; la tarjeta (marca y número
 *    enmascarado) solo en pagos aprobados con tarjeta.
 *  - Mercado Pago: estado del pago al consultarlo (approved, pending, in_process, rejected,
 *    cancelled, refunded…) con `status_detail` (código que el ERP traduce), `payment_method_id`,
 *    `payment_type_id` y `card.last_four_digits`.
 *  - Wompi: APPROVED, DECLINED, ERROR, PENDING o VOIDED con `status_message` (texto del motivo),
 *    `payment_method_type`, `payment_method.extra.brand/last_four` y, en PSE, el banco.
 *  - Ninguna avisa «enlace creado» (lo registra checkout/init) ni «venció» (lo registra
 *    `expire_pending_web_orders`).
 *
 * NUNCA se guarda la respuesta completa de la pasarela: trae nombre, documento, correo y teléfono
 * del pagador. Solo los campos de abajo, recortados.
 */

export type EventoIntento = 'link_created' | 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'expired'
export type ConceptoIntento = 'order' | 'advance'

/** Lo que se guarda de un intento (sin pedido ni organización: los pone quien registra). */
export interface DatosIntento {
  /** 'bold' | 'mercadopago' | 'wompi' | … (la base normaliza códigos de conector). */
  pasarela: string
  evento: EventoIntento
  /** Texto corto del motivo (Wompi `status_message`). */
  motivo?: string | null
  /** Código del motivo para traducir en el ERP (Mercado Pago `status_detail`). */
  codigoMotivo?: string | null
  /** card | nequi | pse | qr | daviplata | bancolombia_transfer | account_money | … */
  medio?: string | null
  marca?: string | null
  ultimos4?: string | null
  banco?: string | null
  /** Id de la transacción en la pasarela. */
  referencia?: string | null
  monto?: number | null
  moneda?: string | null
}

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const limpio = String(v).trim()
  return limpio ? limpio.slice(0, max) : null
}

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Los últimos 4 dígitos de un número enmascarado («•••• 4417», «************4417»), o null. */
export function ultimos4De(v: unknown): string | null {
  const t = texto(v, 40)
  if (!t) return null
  const m = /(\d{4})\D*$/.exec(t)
  return m ? m[1] : null
}

/** Código de conector o de método → pasarela ('bold', 'mercadopago', 'wompi'…), o el código. */
export function pasarelaDeCodigo(codigo: string | null | undefined): string | null {
  const c = (codigo ?? '').trim().toLowerCase()
  if (!c) return null
  if (['mp', 'mercadopago', 'mercado_pago', 'mp_checkout'].includes(c)) return 'mercadopago'
  if (c.startsWith('bold')) return 'bold'
  if (c === 'wompi' || c === 'wompi_co') return 'wompi'
  if (c === 'payu' || c === 'payu_co') return 'payu'
  if (c === 'stripe' || c === 'stripe_payments') return 'stripe'
  if (c === 'paypal' || c === 'paypal_checkout') return 'paypal'
  return c.slice(0, 40)
}

// ─── Bold ────────────────────────────────────────────────────────────────────

const EVENTO_BOLD: Record<string, EventoIntento> = {
  SALE_APPROVED: 'approved',
  SALE_REJECTED: 'declined',
  VOID_APPROVED: 'voided',
  // VOID_REJECTED: una anulación rechazada; la venta sigue aprobada. No es un intento.
}

/** Medio de Bold (CARD_WEB, NEQUI, PSE, QR…) → medio normalizado. */
export function medioBold(v: unknown): string | null {
  const t = (texto(v, 40) ?? '').toUpperCase()
  if (!t) return null
  if (t === 'CARD_WEB' || t === 'CARD' || t.startsWith('CARD')) return 'card'
  if (t === 'NEQUI') return 'nequi'
  if (t === 'PSE') return 'pse'
  if (t === 'QR') return 'qr'
  if (t === 'DAVIPLATA') return 'daviplata'
  return t.toLowerCase()
}

/** Aviso del webhook de Bold (CloudEvents: `{ type, data }`). Null si no es un intento. */
export function intentoDeBold(cuerpo: unknown): DatosIntento | null {
  const b = (cuerpo ?? {}) as Record<string, any>
  const evento = EVENTO_BOLD[String(b.type ?? '')]
  if (!evento) return null
  const d = (b.data ?? {}) as Record<string, any>
  const tarjeta = (d.card ?? {}) as Record<string, any>
  return {
    pasarela: 'bold',
    evento,
    // Bold no manda motivo del rechazo: la tarjeta del ERP lo dice en vez de inventarlo.
    motivo: null,
    medio: medioBold(d.payment_method),
    marca: texto(tarjeta.brand, 30)?.toLowerCase() ?? null,
    ultimos4: ultimos4De(tarjeta.masked_pan),
    referencia: texto(d.payment_id ?? b.subject, 120),
    monto: numero(d.amount?.total),
    moneda: texto(d.amount?.currency, 3) ?? 'COP',
  }
}

/** Comprobante de la consulta del Botón de pagos (/checkout/resultado). Null si no es un intento. */
export function intentoDeComprobanteBold(comprobante: unknown): DatosIntento | null {
  const c = (comprobante ?? {}) as Record<string, any>
  const estado = String(c.payment_status ?? '').toUpperCase()
  const evento: EventoIntento | null =
    estado === 'APPROVED' ? 'approved' : estado === 'REJECTED' ? 'declined' : estado === 'FAILED' ? 'error' : estado === 'VOIDED' ? 'voided' : null
  if (!evento) return null
  return {
    pasarela: 'bold',
    evento,
    motivo: null,
    medio: medioBold(c.payment_method),
    referencia: texto(c.transaction_id, 120),
    monto: numero(c.total),
    moneda: 'COP',
  }
}

// ─── Mercado Pago ────────────────────────────────────────────────────────────

/** Estado de un pago de Mercado Pago → evento del intento. Null si no es un intento. */
export function eventoMercadoPago(estado: unknown, detalle?: unknown): EventoIntento | null {
  switch (String(estado ?? '')) {
    case 'approved':
      return 'approved'
    case 'authorized': // reserva sin capturar: aún no es plata cobrada
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return 'pending'
    case 'rejected':
      return 'declined'
    case 'cancelled':
      // `cancelled` con `expired`: el pago en efectivo o la transferencia no se hicieron a tiempo.
      return String(detalle ?? '') === 'expired' ? 'expired' : 'declined'
    case 'refunded':
    case 'charged_back':
      return 'voided'
    default:
      return null
  }
}

/** Medio de Mercado Pago (`payment_type_id` + `payment_method_id`) → medio normalizado. */
export function medioMercadoPago(tipo: unknown, metodo: unknown): string | null {
  const t = (texto(tipo, 40) ?? '').toLowerCase()
  const m = (texto(metodo, 40) ?? '').toLowerCase()
  if (m === 'pse') return 'pse'
  if (t === 'credit_card' || t === 'debit_card' || t === 'prepaid_card') return 'card'
  if (t) return t
  return m || null
}

/** Pago de Mercado Pago (respuesta de `GET /v1/payments/:id` o de la búsqueda). */
export function intentoDeMercadoPago(pago: unknown): DatosIntento | null {
  const p = (pago ?? {}) as Record<string, any>
  const evento = eventoMercadoPago(p.status, p.status_detail)
  if (!evento) return null
  const medio = medioMercadoPago(p.payment_type_id, p.payment_method_id)
  return {
    pasarela: 'mercadopago',
    evento,
    // Código a traducir en el ERP (cc_rejected_insufficient_amount → «Fondos insuficientes»).
    codigoMotivo: texto(p.status_detail, 80),
    medio,
    marca: medio === 'card' ? texto(p.payment_method_id, 30)?.toLowerCase() ?? null : null,
    ultimos4: ultimos4De(p.card?.last_four_digits),
    referencia: p.id != null ? texto(String(p.id), 120) : null,
    monto: numero(p.transaction_amount),
    moneda: texto(p.currency_id, 3) ?? 'COP',
  }
}

// ─── Wompi ───────────────────────────────────────────────────────────────────

const EVENTO_WOMPI: Record<string, EventoIntento> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  ERROR: 'error',
  PENDING: 'pending',
  VOIDED: 'voided',
}

/** `data.transaction` del evento `transaction.updated` de Wompi (o de su consulta). */
export function intentoDeWompi(transaccion: unknown): DatosIntento | null {
  const tx = (transaccion ?? {}) as Record<string, any>
  const evento = EVENTO_WOMPI[String(tx.status ?? '').toUpperCase()]
  if (!evento) return null
  const extra = (tx.payment_method?.extra ?? {}) as Record<string, any>
  const centavos = numero(tx.amount_in_cents)
  return {
    pasarela: 'wompi',
    evento,
    // El texto del motivo, tal cual, solo en rechazos y errores.
    motivo: evento === 'declined' || evento === 'error' ? texto(tx.status_message, 200) : null,
    medio: texto(tx.payment_method_type, 40)?.toLowerCase() ?? null,
    marca: texto(extra.brand, 30)?.toLowerCase() ?? null,
    ultimos4: ultimos4De(extra.last_four),
    banco: texto(extra.financial_institution_name, 80),
    referencia: texto(tx.id, 120),
    monto: centavos === null ? null : centavos / 100,
    moneda: texto(tx.currency, 3) ?? 'COP',
  }
}

// ─── Enlace de pago creado (checkout/init) ───────────────────────────────────

export function intentoEnlaceCreado(pasarela: string, monto: unknown, moneda?: string | null): DatosIntento {
  return {
    pasarela: pasarelaDeCodigo(pasarela) ?? pasarela,
    evento: 'link_created',
    monto: numero(monto),
    moneda: texto(moneda, 3) ?? 'COP',
  }
}

/** Parámetros de `fn_web_order_intento_registrar` (la base vuelve a recortar y validar). */
export function parametrosIntento(
  organizationId: number,
  webOrderId: string,
  concepto: ConceptoIntento,
  d: DatosIntento,
): Record<string, unknown> {
  return {
    p_organization_id: organizationId,
    p_web_order_id: webOrderId,
    p_concepto: concepto,
    p_pasarela: d.pasarela,
    p_evento: d.evento,
    p_motivo: d.motivo ?? null,
    p_codigo_motivo: d.codigoMotivo ?? null,
    p_medio: d.medio ?? null,
    p_marca: d.marca ?? null,
    p_ultimos4: d.ultimos4 ?? null,
    p_banco: d.banco ?? null,
    p_referencia: d.referencia ?? null,
    p_monto: d.monto ?? null,
    p_moneda: d.moneda ?? null,
  }
}
