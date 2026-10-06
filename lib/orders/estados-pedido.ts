/**
 * Estados, tipos de entrega y estados de pago de `web_orders`, alineados con los CHECK reales.
 *
 * Verificado por MCP el 2026-10-06 (`pg_get_constraintdef`):
 * - `web_orders_status_check`: pending, confirmed, preparing, ready, in_delivery, delivered,
 *   cancelled, rejected, refunded, expired.
 * - `web_orders_delivery_type_check`: pickup, delivery_own, delivery_third_party
 *   (+ `dine_in` cuando se aplique la migración E1 del ERP).
 * - `web_orders_payment_status_check`: pending, paid, partial, refunded, failed.
 *
 * Antes cada pantalla tenía su propio mapa con estados que no existen (`shipped`, `completed`,
 * `approved`, `declined`, `voided`) y comparaba el tipo con `'delivery'`, que nunca se guarda:
 * el seguimiento de un domicilio no mostraba ni «En camino» ni el mapa. `scripts/verify-orders.mjs`
 * lee los CHECK de la base y falla si algún valor no tiene etiqueta aquí.
 *
 * Puro: lo usan servidor y navegador.
 */

export const ESTADOS_PEDIDO = [
  'pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered',
  'cancelled', 'rejected', 'refunded', 'expired',
] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

/** Estados en los que el pedido ya no avanza: el seguimiento deja de consultar. */
export const ESTADOS_FINALES: ReadonlySet<string> = new Set<EstadoPedido>([
  'delivered', 'cancelled', 'rejected', 'refunded', 'expired',
])

/** Estados de cierre sin entrega (se pintan como evento terminal en la línea de tiempo). */
export const ESTADOS_SIN_ENTREGA: ReadonlySet<string> = new Set<EstadoPedido>([
  'cancelled', 'rejected', 'refunded', 'expired',
])

export const TIPOS_ENTREGA = ['pickup', 'delivery_own', 'delivery_third_party', 'dine_in'] as const
export type TipoEntrega = (typeof TIPOS_ENTREGA)[number]

export const ESTADOS_PAGO = ['pending', 'paid', 'partial', 'refunded', 'failed'] as const
export type EstadoPago = (typeof ESTADOS_PAGO)[number]

export function esEstadoFinal(estado: string | null | undefined): boolean {
  return !!estado && ESTADOS_FINALES.has(estado)
}

/** Domicilio = cualquiera de los dos valores de entrega guardados (propio o de terceros). */
export function esDomicilio(tipo: string | null | undefined): boolean {
  return tipo === 'delivery_own' || tipo === 'delivery_third_party'
}

/** Pedido para comer en el local: `dine_in` real (tras E1) o el mapeo temporal a `pickup` con mesa. */
export function esComerAqui(tipo: string | null | undefined, notasInternas?: string | null): boolean {
  return tipo === 'dine_in' || (tipo === 'pickup' && !!notasInternas && notasInternas.startsWith(MARCA_COMER_AQUI))
}

/**
 * Marca de `internal_notes` mientras `web_orders` no admite `dine_in` (E1 sin aplicar): el pedido
 * se guarda como `pickup` y la nota empieza por esta marca, para que el ERP y la cocina lo pinten
 * como «Comer aquí · Mesa N».
 */
export const MARCA_COMER_AQUI = '[Comer aquí]'

export interface EstiloEstado {
  etiqueta: string
  color: string
  icono: string
}

export const ESTILO_ESTADO: Record<EstadoPedido, EstiloEstado> = {
  pending: { etiqueta: 'Pendiente', color: '#B45309', icono: '⏳' },
  confirmed: { etiqueta: 'Confirmado', color: '#1D4ED8', icono: '✅' },
  preparing: { etiqueta: 'En preparación', color: '#6D28D9', icono: '👨‍🍳' },
  ready: { etiqueta: 'Listo', color: '#047857', icono: '🔔' },
  in_delivery: { etiqueta: 'En camino', color: '#1D4ED8', icono: '🛵' },
  delivered: { etiqueta: 'Entregado', color: '#047857', icono: '🎉' },
  cancelled: { etiqueta: 'Cancelado', color: '#B91C1C', icono: '❌' },
  rejected: { etiqueta: 'Rechazado', color: '#B91C1C', icono: '⛔' },
  refunded: { etiqueta: 'Reembolsado', color: '#4B5563', icono: '↩️' },
  expired: { etiqueta: 'Expirado', color: '#4B5563', icono: '⌛' },
}

const ESTILO_DESCONOCIDO: EstiloEstado = { etiqueta: 'En proceso', color: '#4B5563', icono: '📦' }

export function estiloEstado(estado: string | null | undefined): EstiloEstado {
  return (estado && (ESTILO_ESTADO as Record<string, EstiloEstado>)[estado]) || ESTILO_DESCONOCIDO
}

export const ETIQUETA_PAGO: Record<EstadoPago, { etiqueta: string; color: string }> = {
  pending: { etiqueta: 'Pago pendiente', color: '#B45309' },
  paid: { etiqueta: 'Pagado', color: '#047857' },
  partial: { etiqueta: 'Pago parcial', color: '#B45309' },
  refunded: { etiqueta: 'Reembolsado', color: '#4B5563' },
  failed: { etiqueta: 'Pago fallido', color: '#B91C1C' },
}

export function etiquetaPago(estado: string | null | undefined): { etiqueta: string; color: string } {
  return (estado && (ETIQUETA_PAGO as Record<string, { etiqueta: string; color: string }>)[estado])
    || { etiqueta: estado || '—', color: '#4B5563' }
}

const TIPO_RESTAURANTE: Record<TipoEntrega, string> = {
  delivery_own: '🛵 Domicilio',
  delivery_third_party: '🛵 Domicilio',
  pickup: '🏪 Recoger en el local',
  dine_in: '🍽️ Comer aquí',
}

const TIPO_COMERCIO: Record<TipoEntrega, string> = {
  delivery_own: '🚚 Envío a domicilio',
  delivery_third_party: '🚚 Envío por transportadora',
  pickup: '🏪 Recoger en tienda',
  dine_in: '🍽️ Consumo en el local',
}

/** Etiqueta del tipo de entrega guardado (`organizations.type_id = 1` es restaurante). */
export function etiquetaTipoEntrega(
  tipo: string | null | undefined,
  esRestaurante: boolean,
  notasInternas?: string | null,
): string {
  if (!tipo) return ''
  if (esComerAqui(tipo, notasInternas)) return (esRestaurante ? TIPO_RESTAURANTE : TIPO_COMERCIO).dine_in
  const mapa = esRestaurante ? TIPO_RESTAURANTE : TIPO_COMERCIO
  return (mapa as Record<string, string>)[tipo] || tipo
}

/** Etiqueta del último paso según el tipo: «Entregado», «Servido» o «Recogido». */
export function etiquetaEntregaFinal(tipo: string | null | undefined, esRestaurante: boolean, notasInternas?: string | null): string {
  if (!esRestaurante || esDomicilio(tipo)) return 'Entregado'
  if (esComerAqui(tipo, notasInternas)) return 'Servido'
  return 'Recogido'
}
