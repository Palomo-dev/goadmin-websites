/**
 * Arma lo que el enlace «Retomar mi compra» necesita para reabrir el checkout.
 *
 * La organización sale del host. El pedido se lee con service role y se filtra
 * por esa organización. Los precios son los de ahora (la misma resolución que
 * `/api/orders`): si un producto ya no está, se omite. Si el pedido ya se pagó,
 * no hay líneas: la página no arma otro carrito.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { esSede, leerCartaSede, resolverSedeCarta, type CartaSede } from '@/lib/products/carta-sede'
import { leerDatosPrecio } from '@/lib/products/precio-servidor-lectura'
import { resolverLineasPedido } from '@/lib/products/precio-servidor'
import { rutaSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { SLUGS_RESERVADOS } from '@/lib/outlet/rutaSitio'
import {
  datosClienteRetomar,
  decisionRetoma,
  destinoRetomar,
  lineaRetoma,
  type DatosClienteRetomar,
  type LineaRetoma,
} from '@/lib/orders/compraPendiente'
import {
  atributosVariante,
  imagenRetoma,
  uuidProducto,
  type FotoProducto,
} from '@/lib/orders/imagenProducto'

export interface ProductoOmitido {
  nombre: string
  detalle: string
}

export type ResultadoRetoma =
  | { tipo: 'no_encontrado' }
  | { tipo: 'error' }
  | { tipo: 'pagado'; numero: string; nombre: string; rutaSeguimiento: string }
  | { tipo: 'en_curso'; numero: string; rutaSeguimiento: string }
  | {
      tipo: 'retomar'
      numero: string
      nombre: string
      lineas: LineaRetoma[]
      omitidos: ProductoOmitido[]
      rutaCheckout: string
      branchId: number | null
      cliente: DatosClienteRetomar
    }

interface FilaItem {
  product_id: number | null
  product_name: string | null
  product_sku: string | null
  quantity: number | string | null
  unit_price: number | string | null
  modifiers: unknown
  notes: string | null
}

export async function cargarRetoma(organizationId: number, orderId: string): Promise<ResultadoRetoma> {
  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[retomar] Falta SUPABASE_SERVICE_ROLE_KEY')
    return { tipo: 'error' }
  }
  const sb = supabase as any
  const { data: pedido, error } = await sb
    .from('web_orders')
    .select('id, order_number, organization_id, branch_id, status, payment_status, customer_name, customer_email, customer_phone')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) {
    console.error('[retomar] No se pudo leer el pedido', { organizationId, error: error.message })
    return { tipo: 'error' }
  }
  if (!pedido) return { tipo: 'no_encontrado' }
  const decision = decisionRetoma(pedido.status, pedido.payment_status)
  if (decision === 'pagado') {
    return {
      tipo: 'pagado',
      numero: String(pedido.order_number || ''),
      nombre: String(pedido.customer_name || ''),
      rutaSeguimiento: rutaSeguimiento(organizationId, pedido),
    }
  }
  if (decision === 'en_curso') {
    return {
      tipo: 'en_curso',
      numero: String(pedido.order_number || ''),
      rutaSeguimiento: rutaSeguimiento(organizationId, pedido),
    }
  }

  const { data: sede } = await sb
    .from('branches')
    .select('id, slug, is_web_published')
    .eq('id', pedido.branch_id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  const destino = destinoRetomar(
    sede
      ? { id: Number(sede.id), slug: sede.slug ?? null, publicada: sede.is_web_published === true }
      : null,
    SLUGS_RESERVADOS,
  )
  const cliente = datosClienteRetomar(pedido.customer_name, pedido.customer_email, pedido.customer_phone)
  const base = {
    numero: String(pedido.order_number || ''),
    nombre: String(pedido.customer_name || ''),
    rutaCheckout: destino.ruta,
    branchId: destino.branchId,
    cliente,
  }

  const { data: items, error: errorItems } = await sb
    .from('web_order_items')
    .select('product_id, product_name, product_sku, quantity, unit_price, modifiers, notes')
    .eq('web_order_id', pedido.id)
  if (errorItems) {
    console.error('[retomar] No se pudieron leer las líneas', { organizationId, error: errorItems.message })
    return { tipo: 'error' }
  }

  const omitidos: ProductoOmitido[] = []
  const lineasCliente: {
    productId: number
    name: unknown
    quantity: unknown
    price: unknown
    sku: unknown
    modifiers: unknown
    notes: unknown
  }[] = []
  for (const item of (items || []) as FilaItem[]) {
    const productId = Number(item.product_id)
    if (!Number.isInteger(productId) || productId <= 0) {
      omitidos.push({ nombre: String(item.product_name || 'Producto'), detalle: 'ya no está disponible' })
      continue
    }
    lineasCliente.push({
      productId,
      name: item.product_name,
      quantity: item.quantity,
      price: item.unit_price,
      sku: item.product_sku,
      modifiers: item.modifiers,
      notes: item.notes,
    })
  }
  if (lineasCliente.length === 0) {
    return { tipo: 'retomar', ...base, lineas: [], omitidos }
  }

  const productIds = lineasCliente.map((l) => l.productId)
  const sedeCarta = destino.branchId ?? await resolverSedeCarta(organizationId, null)
  const lectura = await leerDatosPrecio(sb, organizationId, productIds, sedeCarta)
  if (!lectura.ok) {
    console.error('[retomar] No se pudieron leer los precios', { organizationId, error: lectura.error })
    return { tipo: 'error' }
  }
  let carta: CartaSede | null = null
  if (esSede(sedeCarta)) {
    const lecturaCarta = await leerCartaSede(sb, organizationId, sedeCarta, productIds)
    if (lecturaCarta.ok) carta = lecturaCarta.carta
    else console.error('[retomar] Carta de sede ilegible; se usan los precios vigentes', { organizationId, error: lecturaCarta.error })
  }
  const resuelto = resolverLineasPedido(lineasCliente, lectura.datos, { organizationId, carta })
  const ficha = await fichaDeProductos(sb, organizationId, resuelto.lineas.map((l) => l.productId))
  const lineas: LineaRetoma[] = []
  for (const l of resuelto.lineas) {
    const producto = ficha.get(l.productId)
    const linea = lineaRetoma({
      productId: l.productId,
      nombre: l.nombre,
      precioUnitario: l.precioUnitario,
      cantidad: l.cantidad,
      sku: l.sku,
      modificadores: l.modificadores,
      sinPrecio: l.modificadoresSinPrecio,
      notas: l.notas,
      imageUrl: producto
        ? imagenRetoma(producto.fotos, l.productId, producto.parentId, baseImagen())
        : null,
      uuid: producto?.uuid ?? null,
      variantAttributes: producto?.atributos ?? null,
    })
    if (linea) lineas.push(linea)
    else omitidos.push({ nombre: l.nombre, detalle: 'ya no está disponible' })
  }
  for (const p of resuelto.problemas) {
    omitidos.push({ nombre: p.nombre, detalle: p.detalle })
  }
  return { tipo: 'retomar', ...base, lineas, omitidos }
}

function baseImagen(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'
}

interface FichaProducto {
  uuid: string | null
  parentId: number | null
  atributos: Record<string, string> | null
  fotos: FotoProducto[]
}

/** Imagen, uuid y variante. Si la variante no tiene foto, se usa la del padre. */
async function fichaDeProductos(
  sb: any,
  organizationId: number,
  productIds: number[],
): Promise<Map<number, FichaProducto>> {
  const mapa = new Map<number, FichaProducto>()
  if (productIds.length === 0) return mapa
  const { data: productos, error } = await sb
    .from('products')
    .select('id, uuid, parent_product_id, variant_data')
    .eq('organization_id', organizationId)
    .in('id', productIds)
  if (error) {
    console.error('[retomar] No se pudieron leer las fichas', { organizationId, error: error.message })
    return mapa
  }
  const padres: number[] = []
  for (const fila of (productos || []) as any[]) {
    const id = Number(fila.id)
    if (!Number.isInteger(id)) continue
    const parentId = Number(fila.parent_product_id)
    const padre = Number.isInteger(parentId) && parentId > 0 ? parentId : null
    if (padre) padres.push(padre)
    mapa.set(id, {
      uuid: uuidProducto(fila.uuid),
      parentId: padre,
      atributos: atributosVariante(fila.variant_data),
      fotos: [],
    })
  }
  const idsFoto = Array.from(new Set([...mapa.keys(), ...padres]))
  if (idsFoto.length === 0) return mapa
  const { data: imagenes, error: errorImagenes } = await sb
    .from('product_images')
    .select('product_id, storage_path, is_primary, display_order, shared_images(storage_path)')
    .in('product_id', idsFoto)
    .order('display_order', { ascending: true })
  if (errorImagenes) {
    console.error('[retomar] No se pudieron leer las fotos', { organizationId, error: errorImagenes.message })
    return mapa
  }
  const fotos: FotoProducto[] = ((imagenes || []) as any[]).map((img) => {
    const compartida = img.shared_images
    const sharedPath = Array.isArray(compartida) ? compartida[0]?.storage_path : compartida?.storage_path
    return {
      productId: Number(img.product_id),
      storagePath: typeof img.storage_path === 'string' ? img.storage_path : null,
      sharedPath: typeof sharedPath === 'string' ? sharedPath : null,
      isPrimary: img.is_primary === true,
      displayOrder: Number.isFinite(Number(img.display_order)) ? Number(img.display_order) : 0,
    }
  })
  // imagenRetoma elige la del producto y, si no hay, la del padre.
  for (const ficha of mapa.values()) ficha.fotos = fotos
  return mapa
}
