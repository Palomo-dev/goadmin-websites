/**
 * Favoritos de la tienda: lado servidor (API y página /favoritos).
 *
 * Seguridad (CLAUDE.md del ERP, reglas 5 y 6):
 * - La organización sale del HOST (`getOrgIdDelHost`), nunca del body ni de la query.
 * - El cliente sale de la SESIÓN de la tienda (`auth.getUser()` con las cookies) y de la fila de
 *   `customers` de esa organización con ese `user_id` (la misma validación que hacía
 *   /api/favorites). Sin sesión no hay cuenta: los favoritos viven en el dispositivo.
 * - Se escribe con service role solo después de esas dos comprobaciones, y cada consulta filtra
 *   por organización y cliente.
 *
 * Tabla `store_favorites` (migración PENDIENTE_tienda_favoritos del ERP). Mientras no exista, se
 * lee y escribe `customers.metadata.favorites` como antes (respaldo): la tienda puede desplegarse
 * antes que la migración sin romper nada.
 */
import { randomBytes } from 'node:crypto'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import {
  enriquecerListadoPublico,
  getOrganizationCategories,
  getOrganizationProductsConEstado,
  getProductsByIdsCatalog,
} from '@/lib/supabase/queries'
import { getAvailableStock } from '@/lib/stock'
import { getProductComparePrice, getProductImageUrl, getProductPrice, isParentProduct } from '@/lib/products/datosTarjeta'
import {
  MAX_FAVORITOS,
  MAX_LISTA_COMPARTIDA,
  elegirSugerencias,
  juntarFavoritos,
  ordenarPorFecha,
  tokenListaValido,
  type FavoritoGuardado,
  type FichaFavorito,
  type FuenteSugerencias,
} from './logica'

/** Tabla y columnas fuera de los tipos generados de la tienda: se consultan sin tipos, en un solo lugar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SinTipos = any
const sinTipos = (c: unknown): SinTipos => c

export interface ContextoFavoritos {
  organizationId: number
  /** `null` = visitante sin sesión (o sin cliente en esta organización). */
  customerId: string | null
}

/** Organización del host y cliente de la sesión. `null` = el host no es una tienda. */
export async function contextoFavoritos(): Promise<ContextoFavoritos | null> {
  const organizationId = await getOrgIdDelHost()
  if (!organizationId) return null
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { organizationId, customerId: null }
    const { data } = await sinTipos(supabase)
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    return { organizationId, customerId: (data?.id as string | undefined) ?? null }
  } catch {
    return { organizationId, customerId: null }
  }
}

/** La tabla todavía no existe (migración sin aplicar): PostgREST PGRST205 / Postgres 42P01. */
export function esTablaFaltante(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /store_favorite/.test(error.message ?? '')
}

function admin(): SinTipos {
  const c = createAdminClient()
  if (!c) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return sinTipos(c)
}

/** Precio vigente (la regla de la tienda: `effective_to` nulo, el de mayor id). */
async function precioVigente(db: SinTipos, productId: number): Promise<number | null> {
  const { data } = await db
    .from('product_prices')
    .select('price')
    .eq('product_id', productId)
    .is('effective_to', null)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  const n = data ? Number(data.price) : NaN
  return Number.isFinite(n) ? n : null
}

/** El producto (y la variante, si viene) es de la organización y está activo. */
async function productoDeLaOrganizacion(db: SinTipos, organizationId: number, ids: number[]): Promise<boolean> {
  const { data, error } = await db.from('products').select('id').eq('organization_id', organizationId).eq('status', 'active').in('id', ids)
  if (error) return false
  return (data ?? []).length === new Set(ids).size
}

// ─── Respaldo: customers.metadata.favorites ───────────────────────────────────────────────────

async function leerMetadata(db: SinTipos, ctx: Required<ContextoFavoritos>): Promise<{ metadata: Record<string, unknown>; ids: number[] }> {
  const { data } = await db.from('customers').select('metadata').eq('id', ctx.customerId).eq('organization_id', ctx.organizationId).maybeSingle()
  const metadata = (data?.metadata && typeof data.metadata === 'object' ? data.metadata : {}) as Record<string, unknown>
  const ids = Array.isArray(metadata.favorites) ? (metadata.favorites as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
  return { metadata, ids }
}

async function escribirMetadata(db: SinTipos, ctx: Required<ContextoFavoritos>, metadata: Record<string, unknown>, ids: number[]): Promise<void> {
  await db
    .from('customers')
    .update({ metadata: { ...metadata, favorites: Array.from(new Set(ids)).slice(0, MAX_FAVORITOS) } })
    .eq('id', ctx.customerId)
    .eq('organization_id', ctx.organizationId)
}

const desdeIds = (ids: number[]): FavoritoGuardado[] =>
  // metadata no guarda fecha: el orden de la lista hace de fecha (el último, el más reciente).
  ids.map((productId, i) => ({ productId, variantId: null, guardadoEn: new Date(Date.UTC(2000, 0, 1) + i * 1000).toISOString(), precioAlGuardar: null }))

// ─── Cuenta ───────────────────────────────────────────────────────────────────────────────────

type ConCliente = ContextoFavoritos & { customerId: string }

/** Favoritos de la cuenta, los más recientes primero. */
export async function leerFavoritosCuenta(ctx: ConCliente): Promise<FavoritoGuardado[]> {
  const db = admin()
  const { data, error } = await db
    .from('store_favorites')
    .select('product_id, variant_id, price_at_save, created_at')
    .eq('organization_id', ctx.organizationId)
    .eq('customer_id', ctx.customerId)
    .order('created_at', { ascending: false })
    .limit(MAX_FAVORITOS)
  if (esTablaFaltante(error)) return ordenarPorFecha(desdeIds((await leerMetadata(db, ctx)).ids))
  if (error) throw new Error(error.message)
  return ((data ?? []) as { product_id: number; variant_id: number | null; price_at_save: number | string | null; created_at: string }[]).map((f) => ({
    productId: Number(f.product_id),
    variantId: f.variant_id === null ? null : Number(f.variant_id),
    guardadoEn: new Date(f.created_at).toISOString(),
    precioAlGuardar: f.price_at_save === null ? null : Number(f.price_at_save),
  }))
}

/** Agrega un favorito con el precio vigente. `false` si el producto no es de la tienda. */
export async function agregarFavoritoCuenta(ctx: ConCliente, productId: number, variantId: number | null): Promise<boolean> {
  const db = admin()
  if (!(await productoDeLaOrganizacion(db, ctx.organizationId, variantId ? [productId, variantId] : [productId]))) return false
  const fila = {
    organization_id: ctx.organizationId,
    customer_id: ctx.customerId,
    product_id: productId,
    variant_id: variantId,
    price_at_save: await precioVigente(db, variantId ?? productId),
  }
  const { error } = await db.from('store_favorites').insert(fila)
  if (esTablaFaltante(error)) {
    const { metadata, ids } = await leerMetadata(db, ctx)
    if (!ids.includes(productId)) await escribirMetadata(db, ctx, metadata, [...ids, productId])
    return true
  }
  // 23505: ya estaba (índice único). Agregar dos veces no es un error.
  if (error && error.code !== '23505') throw new Error(error.message)
  return true
}

export async function quitarFavoritoCuenta(ctx: ConCliente, productId: number, variantId: number | null): Promise<void> {
  const db = admin()
  let consulta = db.from('store_favorites').delete().eq('organization_id', ctx.organizationId).eq('customer_id', ctx.customerId).eq('product_id', productId)
  consulta = variantId === null ? consulta.is('variant_id', null) : consulta.eq('variant_id', variantId)
  const { error } = await consulta
  if (esTablaFaltante(error)) {
    const { metadata, ids } = await leerMetadata(db, ctx)
    if (ids.includes(productId)) await escribirMetadata(db, ctx, metadata, ids.filter((id) => id !== productId))
    return
  }
  if (error) throw new Error(error.message)
}

/**
 * Junta los favoritos del dispositivo con los de la cuenta, sin duplicar (al iniciar sesión).
 * Solo se agregan productos activos de esta organización. Devuelve la lista final.
 */
export async function juntarEnCuenta(ctx: ConCliente, dispositivo: FavoritoGuardado[]): Promise<FavoritoGuardado[]> {
  const db = admin()
  const cuenta = await leerFavoritosCuenta(ctx)
  const { nuevos } = juntarFavoritos(cuenta, dispositivo)
  if (nuevos.length === 0) return cuenta
  const ids = Array.from(new Set(nuevos.flatMap((f) => (f.variantId ? [f.productId, f.variantId] : [f.productId]))))
  const { data: validos } = await db.from('products').select('id').eq('organization_id', ctx.organizationId).eq('status', 'active').in('id', ids)
  const permitidos = new Set(((validos ?? []) as { id: number }[]).map((p) => Number(p.id)))
  const aGuardar = nuevos.filter((f) => permitidos.has(f.productId) && (f.variantId === null || permitidos.has(f.variantId)))
  if (aGuardar.length === 0) return cuenta

  const ahora = new Date().toISOString()
  const filas = aGuardar.map((f) => ({
    organization_id: ctx.organizationId,
    customer_id: ctx.customerId,
    product_id: f.productId,
    variant_id: f.variantId,
    // El precio que vio el visitante al guardar (para «Bajó de precio»); sin él, el de hoy.
    price_at_save: f.precioAlGuardar,
    // La fecha viene del navegador: nunca en el futuro (solo ordena «Recientes»).
    created_at: f.guardadoEn < ahora ? f.guardadoEn : ahora,
  }))
  const { error } = await db.from('store_favorites').insert(filas)
  if (esTablaFaltante(error)) {
    const { metadata, ids: actuales } = await leerMetadata(db, ctx)
    await escribirMetadata(db, ctx, metadata, [...actuales, ...aGuardar.map((f) => f.productId)])
  } else if (error?.code === '23505') {
    // Otro dispositivo guardó alguno entre la lectura y la escritura: uno por uno, sin repetir.
    for (const fila of filas) {
      const r = await db.from('store_favorites').insert(fila)
      if (r.error && r.error.code !== '23505') throw new Error(r.error.message)
    }
  } else if (error) {
    throw new Error(error.message)
  }
  return leerFavoritosCuenta(ctx)
}

// ─── Productos ────────────────────────────────────────────────────────────────────────────────

/** Ficha de un producto del catálogo (precio vigente, foto, stock, variantes, categoría). */
export function fichaDesdeProducto(p: Record<string, unknown>, categorias: Map<number, string>): FichaFavorito {
  const categoriaId = typeof p.category_id === 'number' ? p.category_id : p.category_id != null ? Number(p.category_id) : null
  const variantes = p.variant_count === undefined || p.variant_count === null ? null : Number(p.variant_count)
  return {
    id: Number(p.id),
    uuid: typeof p.uuid === 'string' ? p.uuid : null,
    nombre: String(p.name ?? ''),
    categoriaId: Number.isFinite(categoriaId) ? categoriaId : null,
    categoria: categoriaId !== null && Number.isFinite(categoriaId) ? categorias.get(categoriaId) ?? null : null,
    precio: getProductPrice(p),
    precioAnterior: getProductComparePrice(p),
    imagen: getProductImageUrl(p),
    sku: typeof p.sku === 'string' ? p.sku : null,
    esPadre: isParentProduct(p),
    variantes: variantes !== null && Number.isFinite(variantes) ? variantes : null,
    requiereElegir: p.requires_choice === true,
    stock: getAvailableStock(p as { track_stock?: boolean; stock_levels?: { qty_on_hand: number; qty_reserved: number }[] }),
    ventas: Number(p.sales_count) || 0,
  }
}

async function mapaCategorias(organizationId: number, branchId: number | null): Promise<Map<number, string>> {
  try {
    const lista = (await getOrganizationCategories(organizationId, branchId)) as { id: number; name: string }[] | null
    return new Map((lista ?? []).map((c) => [Number(c.id), String(c.name)]))
  } catch {
    return new Map()
  }
}

/** Fichas de los ids pedidos, en el mismo orden (los que ya no existen o no se ven, fuera). */
export async function fichasDeProductos(organizationId: number, ids: number[], branchId: number | null): Promise<FichaFavorito[]> {
  if (ids.length === 0) return []
  const [crudos, categorias] = await Promise.all([getProductsByIdsCatalog(ids.slice(0, MAX_FAVORITOS), organizationId, branchId), mapaCategorias(organizationId, branchId)])
  const enriquecidos = await enriquecerListadoPublico(organizationId, (crudos ?? []) as Record<string, unknown>[])
  const porId = new Map(enriquecidos.map((p: Record<string, unknown>) => [Number(p.id), fichaDesdeProducto(p, categorias)]))
  return ids.map((id) => porId.get(id)).filter((f): f is FichaFavorito => !!f)
}

/** «También te puede gustar»: del listado del catálogo (cacheado), sin consultas nuevas. */
export async function sugerenciasFavoritos(organizationId: number, branchId: number | null, favoritas: FichaFavorito[], fuente: FuenteSugerencias): Promise<FichaFavorito[]> {
  const [{ products, error }, categorias] = await Promise.all([getOrganizationProductsConEstado(organizationId, 60, branchId), mapaCategorias(organizationId, branchId)])
  if (error) return []
  return elegirSugerencias((products as Record<string, unknown>[]).map((p) => fichaDesdeProducto(p, categorias)), favoritas, fuente)
}

// ─── Listas compartidas ───────────────────────────────────────────────────────────────────────

/**
 * Guarda una lista compartida y devuelve la ruta corta. Solo ids de productos activos de la
 * organización. Sin la tabla, el enlace largo con los ids (`/favoritos?ids=…`).
 */
export async function crearListaCompartida(ctx: ContextoFavoritos, ids: number[]): Promise<string | null> {
  const db = admin()
  const pedidos = Array.from(new Set(ids)).slice(0, MAX_LISTA_COMPARTIDA)
  if (pedidos.length === 0) return null
  const { data } = await db.from('products').select('id').eq('organization_id', ctx.organizationId).eq('status', 'active').in('id', pedidos)
  const validos = new Set(((data ?? []) as { id: number }[]).map((p) => Number(p.id)))
  const lista = pedidos.filter((id) => validos.has(id))
  if (lista.length === 0) return null
  const token = randomBytes(12).toString('base64url')
  const { error } = await db.from('store_favorite_lists').insert({ token, organization_id: ctx.organizationId, customer_id: ctx.customerId, product_ids: lista })
  if (esTablaFaltante(error)) return `/favoritos?ids=${lista.join(',')}`
  if (error) throw new Error(error.message)
  return `/favoritos?lista=${token}`
}

/** Ids de una lista compartida de ESTA organización y vigente; `null` si no existe o caducó. */
export async function leerListaCompartida(organizationId: number, token: string): Promise<number[] | null> {
  if (!tokenListaValido(token)) return null
  try {
    const { data, error } = await admin()
      .from('store_favorite_lists')
      .select('product_ids, expires_at')
      .eq('token', token)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (error || !data) return null
    if (data.expires_at && Date.parse(data.expires_at) < Date.now()) return null
    return ((data.product_ids ?? []) as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  } catch {
    return null
  }
}
