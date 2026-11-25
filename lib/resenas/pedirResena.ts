/**
 * Reglas del correo «¿Qué te pareció tu compra?» (Figma 3A, pasos 4–5 de 5A). Puro: sin red.
 *
 * - Primer correo: pedido del sitio ENTREGADO hace `dias` días (1–30, ajuste de la tienda), con
 *   correo, sin solicitud previa y sin baja de ese correo en la tienda. Ventana de 7 días después
 *   de cumplirse el plazo: al encender el ajuste no se escribe a compras viejas.
 * - Recordatorio: uno solo, 5 días después del primero (hasta 20 días), si la tienda lo tiene
 *   encendido, no hubo baja y el pedido no tiene ninguna opinión. Nunca más de 2 correos.
 * - Hasta 3 productos por correo (los primeros del pedido, sin repetir la ficha).
 */

export const DIA_MS = 24 * 60 * 60 * 1000
export const VENTANA_PRIMER_CORREO_DIAS = 7
export const DIAS_RECORDATORIO = 5
export const VENTANA_RECORDATORIO_DIAS = 20
export const MAX_PRODUCTOS_CORREO = 3
export const MAX_ENVIOS_CORRIDA = 100

export interface PedidoEntregado {
  id: string
  email: string | null
  deliveredAt: string | null
}

/** Rango de `delivered_at` para el primer correo: [desde, hasta]. */
export function rangoPrimerCorreo(ahora: Date, dias: number): { desde: string; hasta: string } {
  const hasta = new Date(ahora.getTime() - dias * DIA_MS)
  const desde = new Date(hasta.getTime() - VENTANA_PRIMER_CORREO_DIAS * DIA_MS)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}

/** Rango de `sent_at` para el recordatorio: [desde, hasta]. */
export function rangoRecordatorio(ahora: Date): { desde: string; hasta: string } {
  return {
    desde: new Date(ahora.getTime() - VENTANA_RECORDATORIO_DIAS * DIA_MS).toISOString(),
    hasta: new Date(ahora.getTime() - DIAS_RECORDATORIO * DIA_MS).toISOString(),
  }
}

export function correoValidoPedido(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(t) ? t : null
}

/** Pedidos a los que toca el primer correo. */
export function planPrimerCorreo(
  pedidos: readonly PedidoEntregado[],
  conSolicitud: ReadonlySet<string>,
  bajas: ReadonlySet<string>,
  ahora: Date,
  dias: number,
): string[] {
  const { desde, hasta } = rangoPrimerCorreo(ahora, dias)
  const d = Date.parse(desde)
  const h = Date.parse(hasta)
  const salida: string[] = []
  for (const p of pedidos) {
    const correo = correoValidoPedido(p.email)
    const t = p.deliveredAt ? Date.parse(p.deliveredAt) : NaN
    if (!correo || !Number.isFinite(t) || t < d || t > h) continue
    if (conSolicitud.has(p.id) || bajas.has(correo)) continue
    salida.push(p.id)
  }
  return salida
}

export interface LineaPedido {
  productId: number | null
  /** Padre si el producto es una variante (la ficha es la del padre). */
  fichaId: number | null
  nombre: string
}

/** Fichas distintas del pedido, hasta 3, en el orden del pedido. */
export function productosDelCorreo(lineas: readonly LineaPedido[]): { fichaId: number; nombre: string }[] {
  const vistos = new Set<number>()
  const salida: { fichaId: number; nombre: string }[] = []
  for (const l of lineas) {
    const id = l.fichaId ?? l.productId
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    salida.push({ fichaId: id, nombre: l.nombre })
    if (salida.length >= MAX_PRODUCTOS_CORREO) break
  }
  return salida
}

/** «Laura» de «Laura Martínez»; vacío si no hay nombre. */
export function nombrePila(nombre: unknown): string {
  if (typeof nombre !== 'string') return ''
  return nombre.trim().split(/\s+/)[0]?.slice(0, 40) ?? ''
}
