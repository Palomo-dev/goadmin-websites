/**
 * Datos de Mi cuenta en el servidor (Figma «16 Sitio web» 2975:71910, aprobado 2026-11-24).
 *
 * - La organización la pasa la página desde `getOrgContext()` (HOST), nunca del body ni la query.
 * - El usuario sale de la cookie de sesión; las consultas van con service role (RLS no aplica en
 *   este repo): CADA consulta filtra por `organization_id` o por ids ya filtrados por ella.
 * - Pedidos sin cuenta: viven en la ficha del correo (`web_orders.customer_id`). Se muestran las
 *   fichas de ese correo en la organización solo si el correo de la sesión está verificado
 *   (entró con el código o lo confirmó). Sin `UPDATE` a `web_orders`: su trigger contable corre en
 *   cada actualización.
 * - Por lotes: una consulta de pedidos, una de productos, una de fotos, una de facturas y una RPC
 *   por método de pago pendiente (no por pedido). Nada de N+1.
 */
import { cache } from 'react'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { fotosDeProductos } from '@/lib/orders/fotosLinea'
import { rutaRetomar } from '@/lib/orders/tokenSeguimiento'
import { igualdadSinMayusculas } from '@/lib/auth/clienteSesion'
import {
  accionesPedido,
  avancePedido,
  correoVerificado,
  grupoPedido,
  normalizarCorreo,
  type AccionPedido,
  type CifrasCuenta,
  type GrupoPedido,
} from '@/lib/cuenta/reglasCuenta'
import { ESTADOS_FINALES } from '@/lib/orders/estados-pedido'
import type { TonoInsignia } from '@/lib/orders/consultaPedido'

type Db = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any }

export interface FichaCuenta {
  id: string
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  identification_type: string | null
  identification_number: string | null
  customer_type: string | null
  company_name: string | null
  dv: number | null
  city: string | null
  preferences: unknown
  created_at: string | null
}

export interface CuentaCliente {
  userId: string
  correo: string | null
  /** Entró con el código o confirmó el correo. */
  verificado: boolean
  /** Ficha principal de la organización (la vinculada al usuario). */
  cliente: FichaCuenta | null
  /** Fichas cuyos pedidos ve: la suya y, con el correo verificado, las de ese correo. */
  idsCliente: string[]
}

const COLUMNAS_FICHA =
  'id, email, phone, first_name, last_name, identification_type, identification_number, customer_type, company_name, dv, city, preferences, created_at'

function db(): Db | null {
  return createAdminClient() as unknown as Db | null
}

/** La cuenta de la sesión en esta organización; null sin sesión. Una vez por petición (react.cache). */
export const getCuentaCliente = cache(async (organizationId: number): Promise<CuentaCliente | null> => {
  try {
    const sesion = await createServerSupabaseClient()
    const { data } = await sesion.auth.getUser()
    const user = data?.user
    if (!user) return null
    const verificado = correoVerificado(user)
    const correo = normalizarCorreo(user.email)
    const sb = db()
    if (!sb) return { userId: user.id, correo, verificado, cliente: null, idsCliente: [] }

    const [porUsuario, porCorreo] = await Promise.all([
      sb.from('customers').select(COLUMNAS_FICHA).eq('organization_id', organizationId).eq('user_id', user.id).order('created_at', { ascending: true }).limit(5),
      verificado && correo
        ? sb.from('customers').select(COLUMNAS_FICHA).eq('organization_id', organizationId).ilike('email', igualdadSinMayusculas(correo)).order('created_at', { ascending: true }).limit(5)
        : Promise.resolve({ data: [] }),
    ])
    const propias = (porUsuario.data ?? []) as FichaCuenta[]
    const delCorreo = (porCorreo.data ?? []) as FichaCuenta[]
    const cliente = propias[0] ?? delCorreo[0] ?? null
    // Sin correo verificado no se muestra ningún pedido: ni el de la ficha (pudo vincularse al
    // registrarse sin confirmar) ni los del correo.
    const idsCliente = verificado ? Array.from(new Set([...propias, ...delCorreo].map((f) => f.id))) : []
    return { userId: user.id, correo, verificado, cliente, idsCliente }
  } catch (error) {
    console.error('[cuenta] No se pudo leer la cuenta', error)
    return null
  }
})

// ─── Pedidos ──────────────────────────────────────────────────────────────────────────────────

/**
 * Métodos que no se pagan en línea. Misma lista que la consulta del pedido
 * (app/api/orders/[id]/tracking/route.ts, `MANUALES`), que no puede exportarla: es una ruta.
 */
/** ¿El método se paga fuera de una pasarela? Una llamada por método, nunca por pedido. */
const RPC_METODO_NATIVO = 'fn_web_order_metodo_nativo'

const METODOS_MANUALES = new Set(['transfer', 'cash', 'bancolombia_transfer', 'bancolombia_collect', 'pse', 'mesa'])

export interface ProductoPedidoCuenta {
  nombre: string
  cantidad: number
  foto: string | null
}

export interface PedidoCuenta {
  id: string
  numero: string
  status: string
  paymentStatus: string | null
  total: number
  deliveryType: string | null
  notasInternas: string | null
  nombre: string | null
  createdAt: string
  deliveredAt: string | null
  grupo: GrupoPedido
  esPasarela: boolean
  productos: ProductoPedidoCuenta[]
  cantidadProductos: number
  facturaId: string | null
  acciones: AccionPedido[]
  /** Detalle en la cuenta (la página del pedido rediseñada, con su token). */
  rutaDetalle: string
  /** `/retomar/<id>?t=…&recompra=1`, solo entregado y con secreto. */
  rutaRecompra: string | null
}

const COLUMNAS_PEDIDO =
  'id, order_number, status, payment_status, payment_method, total, delivery_type, internal_notes, customer_name, created_at, delivered_at, sale_id'

/** ¿El pedido es de esta cuenta? (misma regla que la lista: sus fichas o, sin ficha, su correo verificado). */
export async function pedidoDeCuenta(organizationId: number, cuenta: CuentaCliente, orderId: string): Promise<{ id: string; order_number: string } | null> {
  const sb = db()
  if (!sb || !cuenta.verificado) return null
  const { data } = await sb
    .from('web_orders')
    .select('id, order_number, customer_id, customer_email')
    .eq('organization_id', organizationId)
    .eq('id', orderId)
    .maybeSingle()
  if (!data) return null
  const deFicha = !!data.customer_id && cuenta.idsCliente.includes(data.customer_id)
  const sinFichaMismoCorreo = !data.customer_id && !!cuenta.correo && normalizarCorreo(data.customer_email) === cuenta.correo
  return deFicha || sinFichaMismoCorreo ? { id: data.id, order_number: data.order_number } : null
}

export async function pedidosDeCuenta(
  organizationId: number,
  cuenta: CuentaCliente,
  opciones: { limite?: number; desde?: string | null; productosPorPedido?: number } = {},
): Promise<PedidoCuenta[]> {
  const sb = db()
  if (!sb || !cuenta.verificado) return []
  const limite = Math.min(Math.max(opciones.limite ?? 50, 1), 200)
  const fotosPorPedido = opciones.productosPorPedido ?? 3

  // 1) Pedidos de sus fichas y, sin ficha, los de su correo verificado.
  const consultas: Promise<{ data: any[] | null; error?: { message: string } | null }>[] = []
  if (cuenta.idsCliente.length > 0) {
    let q = sb.from('web_orders').select(COLUMNAS_PEDIDO).eq('organization_id', organizationId).in('customer_id', cuenta.idsCliente)
    if (opciones.desde) q = q.gte('created_at', opciones.desde)
    consultas.push(q.order('created_at', { ascending: false }).limit(limite))
  }
  if (cuenta.correo) {
    let q = sb.from('web_orders').select(COLUMNAS_PEDIDO).eq('organization_id', organizationId).is('customer_id', null).ilike('customer_email', igualdadSinMayusculas(cuenta.correo))
    if (opciones.desde) q = q.gte('created_at', opciones.desde)
    consultas.push(q.order('created_at', { ascending: false }).limit(20))
  }
  const resultados = await Promise.all(consultas)
  const vistos = new Set<string>()
  const filas: any[] = []
  for (const r of resultados) {
    if (r.error) console.error('[cuenta] No se pudieron leer los pedidos', { organizationId, error: r.error.message })
    for (const f of r.data ?? []) {
      if (vistos.has(f.id)) continue
      vistos.add(f.id)
      filas.push(f)
    }
  }
  filas.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const pedidos = filas.slice(0, limite)
  if (pedidos.length === 0) return []

  // 2) Productos, facturas y métodos de pago, por lotes.
  const ids = pedidos.map((p) => p.id as string)
  const saleIds = pedidos.filter((p) => p.status === 'delivered' && p.sale_id).map((p) => p.sale_id as string)
  const metodosPendientes = Array.from(
    new Set(
      pedidos
        .filter((p) => p.status === 'pending' && p.payment_status !== 'paid' && p.payment_method && !METODOS_MANUALES.has(String(p.payment_method)))
        .map((p) => String(p.payment_method)),
    ),
  )
  const [itemsRes, facturasRes, ...nativos] = await Promise.all([
    sb.from('web_order_items').select('web_order_id, product_id, product_name, quantity').in('web_order_id', ids).order('created_at', { ascending: true }),
    saleIds.length > 0
      ? sb.from('invoice_sales').select('id, sale_id, status, document_type').eq('organization_id', organizationId).in('sale_id', saleIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    ...metodosPendientes.map((m) => sb.rpc(RPC_METODO_NATIVO, { p_organization_id: organizationId, p_metodo: m })),
  ])
  if (itemsRes.error) console.error('[cuenta] No se pudieron leer los productos de los pedidos', { organizationId, error: itemsRes.error.message })
  const pasarela = new Map<string, boolean>()
  metodosPendientes.forEach((m, i) => pasarela.set(m, (nativos[i] as { data: unknown })?.data === false))

  const itemsPorPedido = new Map<string, { product_id: number | null; product_name: string | null; quantity: unknown }[]>()
  for (const it of (itemsRes.data ?? []) as { web_order_id: string; product_id: number | null; product_name: string | null; quantity: unknown }[]) {
    const lista = itemsPorPedido.get(it.web_order_id) ?? []
    lista.push(it)
    itemsPorPedido.set(it.web_order_id, lista)
  }
  const idsFoto: number[] = []
  for (const lista of itemsPorPedido.values()) {
    for (const it of lista.slice(0, fotosPorPedido)) if (Number.isInteger(Number(it.product_id)) && Number(it.product_id) > 0) idsFoto.push(Number(it.product_id))
  }
  const fotos = idsFoto.length > 0 ? await fotosDeProductos(sb, organizationId, idsFoto) : new Map<number, string | null>()

  const facturaDeVenta = new Map<string, string>()
  for (const f of (facturasRes.data ?? []) as { id: string; sale_id: string; status: string | null; document_type: string | null }[]) {
    if ((f.document_type || 'invoice') !== 'invoice') continue
    if (['void', 'voided', 'cancelled', 'draft', 'rejected'].includes(String(f.status || ''))) continue
    if (!facturaDeVenta.has(f.sale_id)) facturaDeVenta.set(f.sale_id, f.id)
  }

  return pedidos.map((p) => {
    const lista = itemsPorPedido.get(p.id) ?? []
    const productos = lista.map((it) => {
      const pid = Number(it.product_id)
      return {
        nombre: String(it.product_name || 'Producto'),
        cantidad: Number(it.quantity) || 0,
        foto: Number.isInteger(pid) && pid > 0 ? fotos.get(pid) ?? null : null,
      }
    })
    const esPasarela = p.status === 'pending' && p.payment_status !== 'paid' && !!p.payment_method && pasarela.get(String(p.payment_method)) === true
    const facturaId = p.sale_id ? facturaDeVenta.get(p.sale_id) ?? null : null
    const retomar = p.status === 'delivered' ? rutaRetomar(organizationId, p.id) : null
    return {
      id: p.id,
      numero: p.order_number,
      status: p.status,
      paymentStatus: p.payment_status ?? null,
      total: Number(p.total) || 0,
      deliveryType: p.delivery_type ?? null,
      notasInternas: p.internal_notes ?? null,
      nombre: p.customer_name ?? null,
      createdAt: p.created_at,
      deliveredAt: p.delivered_at ?? null,
      grupo: grupoPedido(p.status),
      esPasarela,
      productos,
      cantidadProductos: productos.reduce((s, x) => s + (x.cantidad > 0 ? x.cantidad : 1), 0),
      facturaId,
      acciones: accionesPedido({ status: p.status, paymentStatus: p.payment_status ?? null, esPasarela, tieneFactura: !!facturaId, puedeRecomprar: !!retomar }),
      rutaDetalle: `/mi-cuenta/pedidos/${p.id}`,
      rutaRecompra: retomar ? `${retomar}&recompra=1` : null,
    }
  })
}

// ─── Resumen de Inicio ────────────────────────────────────────────────────────────────────────

export interface ResumenCuenta {
  direcciones: number
  principal: string | null
  favoritos: number
  cupones: number
  /** Días para que venza el cupón más próximo (≤ 7), o null. */
  cuponVenceEnDias: number | null
}

/** Cifras de los accesos: tres consultas en paralelo, todas por organización y ficha. */
export async function resumenCuenta(organizationId: number, clienteId: string): Promise<ResumenCuenta> {
  const sb = db()
  const vacio: ResumenCuenta = { direcciones: 0, principal: null, favoritos: 0, cupones: 0, cuponVenceEnDias: null }
  if (!sb) return vacio
  const [dirs, favs, cupones] = await Promise.all([
    sb.from('customer_addresses').select('label, is_default').eq('organization_id', organizationId).eq('customer_id', clienteId).eq('is_active', true).limit(50),
    sb.from('store_favorites').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('customer_id', clienteId),
    sb
      .from('coupons')
      .select('end_date, start_date')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .or(`customer_id.eq.${clienteId},customer_id.is.null`)
      .limit(200),
  ])
  const listaDirs = (dirs.data ?? []) as { label: string | null; is_default: boolean | null }[]
  const vigentes = ((cupones.data ?? []) as { end_date: string | null; start_date: string | null }[]).filter(
    (c) => (!c.start_date || Date.parse(c.start_date) <= Date.now()) && (!c.end_date || Date.parse(c.end_date) >= Date.now()),
  )
  let vence: number | null = null
  for (const c of vigentes) {
    if (!c.end_date) continue
    const dias = Math.ceil((Date.parse(c.end_date) - Date.now()) / 86_400_000)
    if (dias >= 0 && dias <= 7 && (vence === null || dias < vence)) vence = dias
  }
  return {
    direcciones: listaDirs.length,
    principal: listaDirs.find((d) => d.is_default)?.label ?? null,
    favoritos: favs.count ?? 0,
    cupones: vigentes.length,
    cuponVenceEnDias: vence,
  }
}

// ─── Mi cuenta V2 y menú del avatar (Figma «16 Sitio web» 3044:78726) ────────────────────────

/** Filtros de «pedidos de esta cuenta»: sus fichas y, sin ficha, su correo verificado. */
function consultasPedidosCuenta(sb: Db, organizationId: number, cuenta: CuentaCliente, columnas: string, ajustar: (q: any) => any, limite: number) {
  const consultas: Promise<{ data: any[] | null; error?: { message: string } | null }>[] = []
  if (cuenta.idsCliente.length > 0) {
    consultas.push(ajustar(sb.from('web_orders').select(columnas).eq('organization_id', organizationId).in('customer_id', cuenta.idsCliente)).order('created_at', { ascending: false }).limit(limite))
  }
  if (cuenta.correo) {
    consultas.push(
      ajustar(sb.from('web_orders').select(columnas).eq('organization_id', organizationId).is('customer_id', null).ilike('customer_email', igualdadSinMayusculas(cuenta.correo)))
        .order('created_at', { ascending: false })
        .limit(limite),
    )
  }
  return consultas
}

/** Lista de estados finales para el filtro `not in` de PostgREST. */
const FINALES_POSTGREST = `(${Array.from(ESTADOS_FINALES).join(',')})`

/**
 * Cifras de Mi cuenta (Inicio, menú lateral y menú del avatar), todas calculadas:
 * - pedidos, en curso y fecha del último: una consulta liviana de `web_orders` (id, estado,
 *   venta, fecha) por ficha y una por correo sin ficha;
 * - facturas: las válidas de las ventas de esos pedidos (`invoice_sales` por `sale_id`), sin
 *   columna nueva;
 * - direcciones, favoritos y cupones: `resumenCuenta`.
 * Todo filtra por la organización. Una vez por petición (react.cache): layout y página comparten.
 */
export const cifrasCuenta = cache(async (organizationId: number, cuenta: CuentaCliente | null, conPedidos: boolean): Promise<CifrasCuenta> => {
  const vacio: CifrasCuenta = { pedidos: 0, enCurso: 0, ultimoPedidoEn: null, favoritos: 0, cupones: 0, cuponVenceEnDias: null, direcciones: 0, principal: null, facturas: 0 }
  const sb = db()
  if (!sb || !cuenta) return vacio
  const clienteId = cuenta.cliente?.id ?? null
  const [resumen, ...resultados] = await Promise.all([
    clienteId ? resumenCuenta(organizationId, clienteId) : Promise.resolve(null),
    ...(conPedidos && cuenta.verificado ? consultasPedidosCuenta(sb, organizationId, cuenta, 'id, status, sale_id, created_at', (q) => q, 500) : []),
  ])
  const vistos = new Set<string>()
  const filas: { id: string; status: string; sale_id: string | null; created_at: string }[] = []
  for (const r of resultados as { data: any[] | null; error?: { message: string } | null }[]) {
    if (r.error) console.error('[cuenta] No se pudieron contar los pedidos', { organizationId, error: r.error.message })
    for (const f of r.data ?? []) {
      if (vistos.has(f.id)) continue
      vistos.add(f.id)
      filas.push(f)
    }
  }
  let ultimo: string | null = null
  for (const f of filas) if (!ultimo || Date.parse(f.created_at) > Date.parse(ultimo)) ultimo = f.created_at
  const ventas = Array.from(new Set(filas.filter((f) => f.status === 'delivered' && f.sale_id).map((f) => f.sale_id as string)))
  let facturas = 0
  if (ventas.length > 0) {
    const { data, error } = await sb.from('invoice_sales').select('sale_id, status, document_type').eq('organization_id', organizationId).in('sale_id', ventas.slice(0, 300))
    if (error) console.error('[cuenta] No se pudieron contar las facturas', { organizationId, error: error.message })
    const conFactura = new Set<string>()
    for (const f of (data ?? []) as { sale_id: string; status: string | null; document_type: string | null }[]) {
      if ((f.document_type || 'invoice') !== 'invoice') continue
      if (['void', 'voided', 'cancelled', 'draft', 'rejected'].includes(String(f.status || ''))) continue
      conFactura.add(f.sale_id)
    }
    facturas = conFactura.size
  }
  return {
    pedidos: filas.length,
    enCurso: filas.filter((f) => grupoPedido(f.status) === 'en_curso').length,
    ultimoPedidoEn: ultimo,
    favoritos: resumen?.favoritos ?? 0,
    cupones: resumen?.cupones ?? 0,
    cuponVenceEnDias: resumen?.cuponVenceEnDias ?? null,
    direcciones: resumen?.direcciones ?? 0,
    principal: resumen?.principal ?? null,
    facturas,
  }
})

/** Pedido en curso para el avatar y su menú: número, insignia («En camino») y la línea de avance. */
export interface PedidoEnCursoAvatar {
  id: string
  numero: string
  insignia: string
  tono: TonoInsignia
  titulo: string
  ruta: string
  /** «Pagar» si falta el pago por pasarela; si no, «Seguir». */
  accion: 'pagar' | 'seguir'
}

/**
 * El pedido en curso más reciente, liviano: una consulta por ficha y una por correo (límite 1,
 * solo estados que no terminaron) y, solo si espera pago, una RPC para saber si es pasarela. Lo
 * pide el avatar de la cabecera una vez por sesión (se guarda en el navegador unos minutos); los
 * visitantes sin sesión nunca lo piden.
 */
export async function pedidoEnCursoAvatar(organizationId: number, cuenta: CuentaCliente, esRestaurante: boolean): Promise<PedidoEnCursoAvatar | null> {
  const sb = db()
  if (!sb || !cuenta.verificado) return null
  const resultados = await Promise.all(
    consultasPedidosCuenta(sb, organizationId, cuenta, 'id, order_number, status, payment_status, payment_method, delivery_type, internal_notes, customer_name, created_at', (q) => q.not('status', 'in', FINALES_POSTGREST), 1),
  )
  let p: any = null
  for (const r of resultados) {
    if (r.error) console.error('[cuenta] No se pudo leer el pedido en curso', { organizationId, error: r.error.message })
    const f = (r.data ?? [])[0]
    if (f && (!p || Date.parse(f.created_at) > Date.parse(p.created_at))) p = f
  }
  if (!p) return null
  let esPasarela = false
  if (p.status === 'pending' && p.payment_status !== 'paid' && p.payment_method && !METODOS_MANUALES.has(String(p.payment_method))) {
    const { data } = await sb.rpc(RPC_METODO_NATIVO, { p_organization_id: organizationId, p_metodo: String(p.payment_method) })
    esPasarela = data === false
  }
  const av = avancePedido({
    status: p.status,
    paymentStatus: p.payment_status ?? null,
    esPasarela,
    deliveryType: p.delivery_type ?? null,
    esRestaurante,
    nombre: p.customer_name ?? null,
    notasInternas: p.internal_notes ?? null,
  })
  return {
    id: p.id,
    numero: p.order_number,
    insignia: av.insignia,
    tono: av.tono,
    titulo: av.titulo,
    ruta: `/mi-cuenta/pedidos/${p.id}`,
    accion: av.vista === 'pagar' || av.vista === 'pago_fallido' ? 'pagar' : 'seguir',
  }
}
