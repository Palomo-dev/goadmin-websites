/**
 * Corrida diaria del correo «¿Qué te pareció tu compra?» (cron `/api/cron/pedir-resena`, pg_cron
 * `pedir-resena-sitio` → `fn_websites_cron_post`, 10:00 de Colombia).
 *
 * 1. Tiendas con `website_settings.reviews_request_enabled = true` (nadie lo tiene encendido al
 *    crear esto: ninguna tienda recibe correos nuevos hasta que el dueño lo encienda).
 * 2. Por tienda: pedidos del sitio entregados en la ventana (`pedirResena.ts`), sin solicitud y sin
 *    baja del correo. Reclamo = INSERT en `product_review_requests` (UNIQUE por pedido): si otra
 *    corrida ya lo reclamó, 23505 y se salta. Luego se envía y se anota `sent_at`.
 * 3. Recordatorios: solicitudes enviadas hace 5–20 días, sin baja, sin opinión del pedido; reclamo
 *    con `UPDATE … WHERE reminder_claimed_at IS NULL`.
 *
 * Un fallo de una tienda o de un correo no tumba la corrida. Tope: 100 envíos por corrida.
 */

import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { sobreCorreoPedido } from '@/lib/email/marcaCorreoPedido'
import { correoRespaldoTiendas } from '@/lib/email/remitenteRespaldo'
import { claveResend } from '@/lib/orders/claveResend'
import { origenSitio } from '@/lib/orders/cargarOrigenSitio'
import { fotosDeProductos } from '@/lib/orders/fotosLinea'
import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { leerAjustesResenas, COLUMNAS_AJUSTES_RESENAS, type AjustesResenas } from '@/lib/resenas/ajustesResenas'
import { firmarBajaResenas, firmarEnlaceResena } from '@/lib/resenas/firmaResena'
import { armarCorreoPedirResena, enviarPorResend } from '@/lib/resenas/correoPedirResena'
import {
  MAX_ENVIOS_CORRIDA,
  correoValidoPedido,
  nombrePila,
  planPrimerCorreo,
  productosDelCorreo,
  rangoPrimerCorreo,
  rangoRecordatorio,
  type LineaPedido,
} from '@/lib/resenas/pedirResena'

type Cliente = { from: (tabla: string) => any; rpc: (fn: string, args: Record<string, string>) => any }

export interface ResultadoPedirResenas {
  tiendas: number
  enviados: number
  recordatorios: number
  omitidos: number
  errores: number
  motivo?: 'sin_resend'
}

interface PedidoCorreo {
  id: string
  organization_id: number
  branch_id: number | null
  order_number: string
  customer_name: string | null
  customer_email: string | null
  delivered_at: string | null
  web_order_items: { product_id: number | null; product_name: string | null }[] | null
}

function fechaEntrega(valor: string | null, zona: string): string {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: zona }).format(d)
  } catch {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: ZONA_POR_DEFECTO }).format(d)
  }
}

async function lineasConFicha(sb: Cliente, organizationId: number, items: PedidoCorreo['web_order_items']): Promise<LineaPedido[]> {
  const lineas = (items ?? []).map((i) => ({ productId: Number(i.product_id) || null, nombre: String(i.product_name || '') }))
  const ids = Array.from(new Set(lineas.map((l) => l.productId).filter((x): x is number => !!x)))
  const padres = new Map<number, number | null>()
  if (ids.length > 0) {
    const { data } = await sb.from('products').select('id, parent_product_id').eq('organization_id', organizationId).in('id', ids)
    for (const f of (data ?? []) as { id: number; parent_product_id: number | null }[]) padres.set(f.id, f.parent_product_id ?? null)
  }
  return lineas.map((l) => ({ ...l, fichaId: l.productId ? padres.get(l.productId) ?? l.productId : null }))
}

async function enviarUno(
  sb: Cliente,
  apiKey: string,
  pedido: PedidoCorreo,
  solicitudId: string,
  recordatorio: boolean,
  cache: { zona: string; origen: string },
): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const org = Number(pedido.organization_id)
  const email = correoValidoPedido(pedido.customer_email)
  if (!email) return { ok: false, id: null, error: 'sin correo' }
  if (!cache.origen) return { ok: false, id: null, error: 'sin dominio del sitio' }
  const token = firmarEnlaceResena(org, pedido.id)
  const baja = firmarBajaResenas(org, solicitudId)
  if (!token || !baja) return { ok: false, id: null, error: 'sin secreto para firmar' }

  const lineas = await lineasConFicha(sb, org, pedido.web_order_items)
  const productos = productosDelCorreo(lineas)
  if (productos.length === 0) return { ok: false, id: null, error: 'sin productos' }
  const fotos = await fotosDeProductos(sb, org, productos.map((p) => p.fichaId))

  const base = `${cache.origen}/opinar/${encodeURIComponent(pedido.id)}?t=${encodeURIComponent(token)}`
  const enlaceBaja = `${cache.origen}/api/reviews/baja?s=${encodeURIComponent(solicitudId)}&t=${encodeURIComponent(baja)}`
  const marca = await cargarMarcaPedido(sb, org, pedido.branch_id ?? null)
  const sobre = sobreCorreoPedido({
    nombre: marca.nombre,
    correoTienda: marca.correo,
    logoUrl: marca.logoUrl,
    color: marca.color,
    dominios: marca.dominios,
    respaldo: correoRespaldoTiendas(),
  })
  const correo = armarCorreoPedirResena({
    sobre,
    nombreCliente: nombrePila(pedido.customer_name),
    numeroPedido: pedido.order_number,
    entregado: fechaEntrega(pedido.delivered_at, cache.zona),
    productos: productos.map((p) => ({
      nombre: p.nombre,
      foto: fotos.get(p.fichaId) ?? null,
      estrellas: [1, 2, 3, 4, 5].map((n) => `${base}&p=${p.fichaId}&r=${n}`),
    })),
    enlaceEscribir: base,
    enlaceBaja,
    host: new URL(cache.origen).host,
    recordatorio,
  })
  const envio = await enviarPorResend(apiKey, sobre, email, correo, enlaceBaja)
  return { ok: envio.ok, id: envio.id, error: envio.ok ? null : 'no se pudo enviar' }
}

const COLUMNAS_PEDIDO = 'id, organization_id, branch_id, order_number, customer_name, customer_email, delivered_at, web_order_items ( product_id, product_name )'

export async function procesarPedirResenas(supabase: object, ahora: Date = new Date()): Promise<ResultadoPedirResenas> {
  const sb = supabase as Cliente
  const r: ResultadoPedirResenas = { tiendas: 0, enviados: 0, recordatorios: 0, omitidos: 0, errores: 0 }

  const { data: filas, error } = await sb
    .from('website_settings')
    .select(`organization_id, ${COLUMNAS_AJUSTES_RESENAS}`)
    .eq('reviews_request_enabled', true)
    .is('branch_id', null)
  if (error) throw new Error(`No se pudieron leer los ajustes: ${error.message}`)
  const tiendas = new Map<number, AjustesResenas>()
  for (const f of (filas ?? []) as Record<string, unknown>[]) tiendas.set(Number(f.organization_id), leerAjustesResenas(f))
  r.tiendas = tiendas.size
  if (tiendas.size === 0) return r

  const apiKey = await claveResend(supabase)
  if (!apiKey) return { ...r, motivo: 'sin_resend' }

  let envios = 0
  for (const [org, ajustes] of tiendas) {
    if (envios >= MAX_ENVIOS_CORRIDA) break
    try {
      const [{ data: orgFila }, origen] = await Promise.all([
        sb.from('organizations').select('timezone').eq('id', org).maybeSingle(),
        origenSitio(sb, org),
      ])
      const cache = { zona: orgFila?.timezone || ZONA_POR_DEFECTO, origen }

      // Bajas de la tienda.
      const { data: bajasFilas } = await sb.from('product_review_requests').select('email').eq('organization_id', org).not('unsubscribed_at', 'is', null)
      const bajas = new Set(((bajasFilas ?? []) as { email: string }[]).map((b) => b.email.toLowerCase()))

      // ── Primer correo ──
      const rango = rangoPrimerCorreo(ahora, ajustes.correo.dias)
      const { data: pedidos, error: errorPedidos } = await sb
        .from('web_orders')
        .select(COLUMNAS_PEDIDO)
        .eq('organization_id', org)
        .eq('status', 'delivered')
        .eq('source', 'website')
        .gte('delivered_at', rango.desde)
        .lte('delivered_at', rango.hasta)
        .order('delivered_at', { ascending: true })
        .limit(200)
      if (errorPedidos) throw new Error(errorPedidos.message)
      const lista = (pedidos ?? []) as PedidoCorreo[]
      const ids = lista.map((p) => p.id)
      const conSolicitud = new Set<string>()
      if (ids.length > 0) {
        const { data: ya } = await sb.from('product_review_requests').select('web_order_id').in('web_order_id', ids)
        for (const f of (ya ?? []) as { web_order_id: string }[]) conSolicitud.add(f.web_order_id)
      }
      const porId = new Map(lista.map((p) => [p.id, p]))
      for (const id of planPrimerCorreo(lista.map((p) => ({ id: p.id, email: p.customer_email, deliveredAt: p.delivered_at })), conSolicitud, bajas, ahora, ajustes.correo.dias)) {
        if (envios >= MAX_ENVIOS_CORRIDA) break
        const pedido = porId.get(id)!
        const { data: reclamo, error: errorReclamo } = await sb
          .from('product_review_requests')
          .insert({ organization_id: org, web_order_id: id, email: correoValidoPedido(pedido.customer_email) })
          .select('id')
          .single()
        if (errorReclamo || !reclamo?.id) {
          if (errorReclamo?.code === '23505') r.omitidos += 1
          else { r.errores += 1; console.error('[pedir-resena] No se pudo reclamar', { org, error: errorReclamo?.message }) }
          continue
        }
        envios += 1
        const envio = await enviarUno(sb, apiKey, pedido, String(reclamo.id), false, cache)
        await sb
          .from('product_review_requests')
          .update(envio.ok ? { sent_at: new Date().toISOString(), resend_id: envio.id, last_error: null } : { last_error: envio.error })
          .eq('id', reclamo.id)
        if (envio.ok) r.enviados += 1
        else r.errores += 1
      }

      // ── Recordatorio ──
      if (!ajustes.correo.recordatorio || envios >= MAX_ENVIOS_CORRIDA) continue
      const rr = rangoRecordatorio(ahora)
      const { data: solicitudes } = await sb
        .from('product_review_requests')
        .select('id, web_order_id, email')
        .eq('organization_id', org)
        .is('reminder_claimed_at', null)
        .is('unsubscribed_at', null)
        .gte('sent_at', rr.desde)
        .lte('sent_at', rr.hasta)
        .limit(100)
      for (const s of (solicitudes ?? []) as { id: string; web_order_id: string; email: string }[]) {
        if (envios >= MAX_ENVIOS_CORRIDA) break
        if (bajas.has(s.email.toLowerCase())) continue
        const { data: opiniones } = await sb.from('product_reviews').select('id').eq('organization_id', org).eq('order_id', s.web_order_id).limit(1)
        if (Array.isArray(opiniones) && opiniones.length > 0) {
          await sb.from('product_review_requests').update({ reminder_claimed_at: new Date().toISOString(), last_error: 'ya opinó' }).eq('id', s.id).is('reminder_claimed_at', null)
          r.omitidos += 1
          continue
        }
        const { data: gano } = await sb
          .from('product_review_requests')
          .update({ reminder_claimed_at: new Date().toISOString() })
          .eq('id', s.id)
          .is('reminder_claimed_at', null)
          .select('id')
        if (!Array.isArray(gano) || gano.length === 0) { r.omitidos += 1; continue }
        const { data: pedido } = await sb.from('web_orders').select(COLUMNAS_PEDIDO).eq('organization_id', org).eq('id', s.web_order_id).maybeSingle()
        if (!pedido) { r.omitidos += 1; continue }
        envios += 1
        const envio = await enviarUno(sb, apiKey, pedido as PedidoCorreo, s.id, true, cache)
        await sb
          .from('product_review_requests')
          .update(envio.ok ? { reminder_sent_at: new Date().toISOString(), reminder_resend_id: envio.id } : { last_error: envio.error })
          .eq('id', s.id)
        if (envio.ok) r.recordatorios += 1
        else r.errores += 1
      }
    } catch (err) {
      r.errores += 1
      console.error('[pedir-resena] Falló la tienda', { org, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return r
}
