/**
 * Correo «Termina tu pago»: a quién, cuándo y una sola vez.
 *
 * Un pedido del sitio con pasarela (Wompi, Mercado Pago, Bold…) que sigue sin pagar recibe UN
 * recordatorio antes de vencer. El plazo sale de la base (`fn_web_order_plazo_minutos`, el mismo
 * del vencimiento `expire_pending_web_orders`): vence = `created_at + plazo`.
 *
 * - Cuándo: a los 10 minutos de creado, o a la mitad del plazo si el plazo es más corto; nunca
 *   con menos de 2 minutos por delante (no vale la pena) ni después de vencer.
 * - Quién: `source = 'website'`, `status = 'pending'`, pago `pending` (o `failed` con el pedido
 *   aún vivo), stock sin liberar, correo válido, método de pasarela, ni mesa ni comer aquí.
 * - Una vez: cualquier fila `recordatorio_pago` del pedido en `web_order_email_log` lo deja fuera.
 * - Mismo comprador (organización + correo): solo su pedido más reciente, y si a ese correo ya
 *   se le recordó otro pedido en las últimas 2 horas, no se le vuelve a escribir. Un pedido
 *   más nuevo del mismo correo (pagado o no) quiere decir que el cliente ya siguió adelante.
 *
 * Puro: sin Next ni Supabase. Lo prueba `scripts/verify-recordatorio-pago.mjs`.
 */

import { esComerAqui } from '@/lib/orders/estados-pedido'
import { esMetodoPasarela, metodoPuedeSerPasarela } from '@/lib/orders/metodoPasarela'

export const TIPO_RECORDATORIO_PAGO = 'recordatorio_pago'
/** Espera normal desde que se crea el pedido. */
export const ESPERA_RECORDATORIO_MS = 10 * 60 * 1000
/** Si quedan menos de esto para vencer, no se escribe. */
export const MARGEN_RECORDATORIO_MS = 2 * 60 * 1000
/** Hacia atrás: un pedido más viejo ya no recibe recordatorio (el cron estuvo caído, por ejemplo). */
export const VENTANA_RECORDATORIO_MS = 6 * 60 * 60 * 1000
/** Un recordatorio por comprador y tienda en este lapso. */
export const DEDUPE_CORREO_RECORDATORIO_MS = 2 * 60 * 60 * 1000
/** Tope de envíos por corrida. */
export const LOTE_RECORDATORIOS = 20
/** Tope de filas leídas por corrida. */
export const FILAS_RECORDATORIO = 500

export type MotivoSinRecordatorio =
  | 'ya_enviado'
  | 'sin_correo'
  | 'no_es_sitio'
  | 'estado'
  | 'pago'
  | 'liberado'
  | 'mesa'
  | 'nativo'
  | 'sin_plazo'
  | 'aun_no'
  | 'vencido'
  | 'hay_otro_mas_reciente'
  | 'correo_reciente'
  | 'tope'

export interface RecordatorioRegistrado {
  createdAt: string | null
}

export interface PedidoRecordatorio {
  id: string
  organizationId: number
  status: string
  paymentStatus: string | null
  paymentMethod: string | null
  source: string | null
  email: string | null
  deliveryType: string | null
  restaurantTableId: string | null
  notasInternas: string | null
  createdAt: string | null
  stockReleasedAt: string | null
  /** Filas `recordatorio_pago` de este pedido en `web_order_email_log`, cualquier estado. */
  recordatorios: RecordatorioRegistrado[]
}

/** Lo que dice la base del método del pedido en su organización. */
export interface ContextoMetodo {
  /** `fn_web_order_metodo_nativo`. null = no se supo. */
  nativo: boolean | null
  /** `fn_web_order_plazo_minutos`. null = no se supo. */
  plazoMinutos: number | null
}

export function correoValido(valor: string | null | undefined): boolean {
  if (!valor) return false
  const limpio = valor.trim()
  if (limpio.length > 254 || limpio.length < 3) return false
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(limpio)
}

export function clavePar(organizationId: number, metodo: string | null | undefined): string {
  return `${organizationId}\n${(metodo || '').trim()}`
}

function plazoUtil(minutos: number | null | undefined): number | null {
  const n = Number(minutos)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Milisegundos desde la creación hasta el recordatorio: 10 min, o la mitad de un plazo corto. */
export function esperaRecordatorioMs(plazoMinutos: number): number {
  return Math.min(ESPERA_RECORDATORIO_MS, Math.floor((plazoMinutos * 60_000) / 2))
}

/** Instante (ms) en que vence el pedido, o null. */
export function venceMs(createdAt: string | null | undefined, plazoMinutos: number | null | undefined): number | null {
  const plazo = plazoUtil(plazoMinutos)
  const t = Date.parse(createdAt || '')
  if (plazo === null || !Number.isFinite(t)) return null
  return t + plazo * 60_000
}

/**
 * Lo que se decide sin preguntar a la base. Sirve para no consultar el plazo de pedidos que de
 * todas formas no se escriben.
 */
export function motivoPrevio(pedido: PedidoRecordatorio, ahora: Date): MotivoSinRecordatorio | null {
  if (pedido.recordatorios.length > 0) return 'ya_enviado'
  if (!correoValido(pedido.email)) return 'sin_correo'
  if (pedido.source !== 'website') return 'no_es_sitio'
  if (pedido.status !== 'pending') return 'estado'
  if (pedido.paymentStatus !== 'pending' && pedido.paymentStatus !== 'failed') return 'pago'
  if (pedido.stockReleasedAt) return 'liberado'
  if (esComerAqui(pedido.deliveryType, pedido.notasInternas) || pedido.restaurantTableId) return 'mesa'
  if (!metodoPuedeSerPasarela(pedido.paymentMethod)) return 'nativo'
  const creado = Date.parse(pedido.createdAt || '')
  if (!Number.isFinite(creado)) return 'sin_plazo'
  const edad = ahora.getTime() - creado
  if (edad > VENTANA_RECORDATORIO_MS) return 'vencido'
  return null
}

/** `null` = le toca el recordatorio a este pedido (antes de mirar a sus hermanos del mismo correo). */
export function motivoSinRecordatorio(
  pedido: PedidoRecordatorio,
  ahora: Date,
  contexto: ContextoMetodo | null | undefined,
): MotivoSinRecordatorio | null {
  const previo = motivoPrevio(pedido, ahora)
  if (previo) return previo
  if (!esMetodoPasarela(pedido.paymentMethod, contexto?.nativo)) return 'nativo'
  const plazo = plazoUtil(contexto?.plazoMinutos)
  const vence = venceMs(pedido.createdAt, plazo)
  if (plazo === null || vence === null) return 'sin_plazo'
  const creado = Date.parse(pedido.createdAt || '')
  const t = ahora.getTime()
  if (t < creado + esperaRecordatorioMs(plazo)) return 'aun_no'
  if (vence - t < MARGEN_RECORDATORIO_MS) return 'vencido'
  return null
}

export interface PlanRecordatorios {
  enviar: { id: string; plazoMinutos: number }[]
  motivos: Record<string, MotivoSinRecordatorio>
}

function claveComprador(pedido: PedidoRecordatorio): string | null {
  const email = (pedido.email || '').trim().toLowerCase()
  return email ? `${pedido.organizationId}\n${email}` : null
}

/** Más reciente primero; a igual hora, el id mayor. */
function masReciente(a: PedidoRecordatorio, b: PedidoRecordatorio): number {
  const delta = (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
  if (delta !== 0) return delta
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/**
 * Plan de una corrida. `pedidos` son TODOS los pedidos del sitio de la ventana (pagados, vencidos
 * o pendientes), con sus recordatorios: los demás pedidos del mismo correo deciden si este se
 * escribe. `contextos` va por par organización + método (`clavePar`).
 */
export function planRecordatorios(
  pedidos: readonly PedidoRecordatorio[],
  ahora: Date,
  contextos: ReadonlyMap<string, ContextoMetodo>,
  lote: number = LOTE_RECORDATORIOS,
): PlanRecordatorios {
  const motivos: Record<string, MotivoSinRecordatorio> = {}
  const grupos = new Map<string, PedidoRecordatorio[]>()
  for (const pedido of pedidos) {
    const clave = claveComprador(pedido)
    if (!clave) continue
    const lista = grupos.get(clave) ?? []
    lista.push(pedido)
    grupos.set(clave, lista)
  }
  const t = ahora.getTime()
  const candidatos: PedidoRecordatorio[] = []
  for (const pedido of pedidos) {
    const motivo = motivoSinRecordatorio(pedido, ahora, contextos.get(clavePar(pedido.organizationId, pedido.paymentMethod)))
    if (motivo) {
      motivos[pedido.id] = motivo
      continue
    }
    const hermanos = grupos.get(claveComprador(pedido) as string) ?? [pedido]
    const primero = [...hermanos].sort(masReciente)[0]
    if (primero.id !== pedido.id) {
      motivos[pedido.id] = 'hay_otro_mas_reciente'
      continue
    }
    const reciente = hermanos.some((h) =>
      h.recordatorios.some((r) => {
        const enviado = Date.parse(r.createdAt || '')
        return Number.isFinite(enviado) && t - enviado >= 0 && t - enviado <= DEDUPE_CORREO_RECORDATORIO_MS
      }),
    )
    if (reciente) {
      motivos[pedido.id] = 'correo_reciente'
      continue
    }
    candidatos.push(pedido)
  }
  // Los que vencen primero, primero: son los que más se pierden si esperan a la próxima corrida.
  const vence = (p: PedidoRecordatorio) =>
    venceMs(p.createdAt, contextos.get(clavePar(p.organizationId, p.paymentMethod))?.plazoMinutos) ?? Infinity
  candidatos.sort((a, b) => vence(a) - vence(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const enviar: PlanRecordatorios['enviar'] = []
  for (const pedido of candidatos) {
    if (enviar.length >= Math.max(0, lote)) {
      motivos[pedido.id] = 'tope'
      continue
    }
    const plazo = contextos.get(clavePar(pedido.organizationId, pedido.paymentMethod))?.plazoMinutos as number
    enviar.push({ id: pedido.id, plazoMinutos: plazo })
  }
  return { enviar, motivos }
}

/** Pares organización + método que hace falta preguntar a la base (solo los que pasan el filtro previo). */
export function paresPorConsultar(pedidos: readonly PedidoRecordatorio[], ahora: Date): { organizationId: number; metodo: string }[] {
  const vistos = new Map<string, { organizationId: number; metodo: string }>()
  for (const pedido of pedidos) {
    if (motivoPrevio(pedido, ahora)) continue
    const metodo = (pedido.paymentMethod || '').trim()
    vistos.set(clavePar(pedido.organizationId, metodo), { organizationId: pedido.organizationId, metodo })
  }
  return [...vistos.values()]
}

/**
 * Dos corridas a la vez (dos proyectos con el mismo `vercel.json`) pueden reclamar el mismo
 * pedido. Gana la fila más vieja (a igual hora, el id menor); la otra no envía.
 */
export function ganaReclamo(filas: readonly { id: string; createdAt: string | null }[], miId: string): boolean {
  if (filas.length === 0) return false
  const ordenadas = [...filas].sort((a, b) => {
    const delta = (Date.parse(a.createdAt || '') || 0) - (Date.parse(b.createdAt || '') || 0)
    if (delta !== 0) return delta
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return ordenadas[0].id === miId
}
