/**
 * Precio unitario de una línea de pedido, resuelto en el servidor con la MISMA regla con la que
 * el sitio lo muestra. Módulo puro (sin Supabase ni Next): lo usa `/api/orders` y se puede probar
 * con datos sueltos. La lectura de la base está en `precio-servidor-lectura.ts`.
 *
 * Regla del sitio, encontrada en el código (no inventada):
 *
 * 1. Precio vigente de `product_prices`: las consultas del sitio traen solo filas con
 *    `effective_to IS NULL` (`.is('product_prices.effective_to', null)` en lib/supabase/queries.ts)
 *    y `normalizeProductPrices` deja primero la de mayor `id`; las tarjetas leen
 *    `product_prices[0].price`. Aquí se reutiliza `getCurrentPrice` (lib/get-current-price.ts), que
 *    aplica esa misma regla. Además se descartan filas con `effective_from` futuro: verificado por
 *    MCP el 2026-10-05, no existe ninguna (0 de 76.335 productos con precio abierto), así que hoy
 *    el resultado es idéntico al que se muestra. Entre los 220 productos con varios precios
 *    abiertos, «mayor id» y «effective_from más reciente» eligen el mismo precio en los 220.
 *    Los planes de membresía muestran su precio con `precioVigente` (lib/memberships/precio.ts:
 *    `effective_from` más reciente, admite `effective_to` futuro). Con los datos de hoy coincide
 *    (0 filas con `effective_to` futuro); si algún día divergen, el checkout recibe 409
 *    PRECIOS_CAMBIARON con el precio de aquí en vez de cobrar distinto en silencio.
 * 2. Carta por sede: si la sede fija `web_price`, ese es el precio (lib/products/carta-sede.ts).
 * 3. Variante (`parent_product_id`): su propio precio. Si no tiene, el del padre: es lo que muestra
 *    `StickyAddToCart` (`selectedVariant.product_prices[0].price || price`), la única vía del sitio
 *    que deja añadir una variante sin precio propio (`VariantSelector` deshabilita el botón).
 *    137 variantes activas sin precio propio; 129 con padre con precio (MCP, 2026-10-05).
 * 4. Modificadores: tabla `product_modifier_groups` (por producto) → `product_modifiers`
 *    (`extra_price`, `is_active`). El carrito suma los extras al precio de la línea
 *    (MenuView y ProductDetailActions: `precio base + Σ extraPrice`). Los modificadores antiguos
 *    (`variant_types`/`variant_values`, con `typeId`/`valueId`) no tienen precio.
 * 5. Venta por peso/medida (`products.sale_mode`): el precio de `product_prices` es SIEMPRE por la
 *    unidad de venta (`unit_code`, p. ej. por kg); `price_ref_qty` es solo presentación («cada
 *    100 g»), comentario de columna del ERP. Así que el precio unitario no cambia: lo que cambia es
 *    que la cantidad admite hasta `qty_decimals` decimales y respeta `min_sale_qty`. Hoy todos los
 *    productos son `sale_mode = 'unit'` y el sitio no ofrece cantidades decimales.
 */

import { getCurrentPrice } from '@/lib/get-current-price'
import {
  agotadoEnSede,
  noListadoEnSede,
  precioWebDeSede,
  type CartaSede,
} from '@/lib/products/carta-sede'
import { esProductoVisibleEnWeb, type FilaProductoConPadre } from '@/lib/products/visibilidad-web'

// ─── Tipos de datos leídos de la base ───────────────────────────────────────────────────────

export interface FilaPrecio {
  id: number
  product_id: number
  price: number | string
  effective_from?: string | null
  effective_to: string | null
}

export interface FilaProductoPrecio extends FilaProductoConPadre {
  id: number
  organization_id: number
  name: string | null
  sku: string | null
  status: string | null
  parent_product_id: number | null
  track_stock: boolean | null
  sale_mode: string | null
  qty_decimals: number | null
  min_sale_qty: number | string | null
}

export interface FilaModificador {
  id: number
  name: string
  extra_price: number | string
  is_active: boolean
}

export interface GrupoModificadores {
  id: number
  product_id: number
  name: string
  selection_mode: string
  max_selections: number | null
  product_modifiers: FilaModificador[] | null
}

export interface DatosPrecio {
  productos: Map<number, FilaProductoPrecio>
  /** Filas de `product_prices` con `effective_to IS NULL`, por `product_id` (productos y padres). */
  precios: Map<number, FilaPrecio[]>
  /** Grupos de modificadores por `product_id`. */
  grupos: Map<number, GrupoModificadores[]>
}

// ─── 1. Precio vigente ──────────────────────────────────────────────────────────────────────

/**
 * Precio vigente con la regla del sitio (ver cabecera). `null` = sin precio: no se vende.
 * Un precio 0 es un precio (el sitio lo muestra y lo vende así).
 */
export function precioVigenteWeb(precios: FilaPrecio[] | null | undefined, ahora: Date = new Date()): number | null {
  if (!Array.isArray(precios) || precios.length === 0) return null
  const ya = ahora.getTime()
  const abiertos = precios.filter((p) => {
    if (p.effective_to !== null && p.effective_to !== undefined) return false
    if (!p.effective_from) return true
    const desde = Date.parse(p.effective_from)
    return !Number.isFinite(desde) || desde <= ya
  })
  const vigente = getCurrentPrice({ product_prices: abiertos })
  if (!vigente) return null
  const precio = Number(vigente.price)
  return Number.isFinite(precio) && precio >= 0 ? precio : null
}

export type OrigenPrecio = 'sede' | 'producto' | 'padre'

/** Precio base (sin modificadores): `web_price` de la sede → propio → del padre. */
export function precioBaseProducto(
  producto: Pick<FilaProductoPrecio, 'id' | 'parent_product_id'>,
  precios: Map<number, FilaPrecio[]>,
  carta: CartaSede | null | undefined,
  ahora: Date = new Date(),
): { precio: number; origen: OrigenPrecio } | null {
  const deSede = precioWebDeSede(carta?.filas.get(Number(producto.id)))
  if (deSede !== null) return { precio: deSede, origen: 'sede' }
  const propio = precioVigenteWeb(precios.get(Number(producto.id)), ahora)
  if (propio !== null) return { precio: propio, origen: 'producto' }
  if (producto.parent_product_id != null) {
    const delPadre = precioVigenteWeb(precios.get(Number(producto.parent_product_id)), ahora)
    if (delPadre !== null) return { precio: delPadre, origen: 'padre' }
  }
  return null
}

// ─── 2. Cantidad ────────────────────────────────────────────────────────────────────────────

export type ResultadoCantidad = { ok: true; cantidad: number } | { ok: false; detalle: string }

/**
 * Cantidad de la línea: > 0; entera en productos por unidad; en peso/medida, hasta `qty_decimals`
 * decimales y al menos `min_sale_qty`.
 */
export function validarCantidad(
  valor: unknown,
  producto: Pick<FilaProductoPrecio, 'sale_mode' | 'qty_decimals' | 'min_sale_qty'>,
): ResultadoCantidad {
  if (typeof valor !== 'number' && typeof valor !== 'string') return { ok: false, detalle: 'cantidad ausente' }
  if (typeof valor === 'string' && valor.trim() === '') return { ok: false, detalle: 'cantidad ausente' }
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return { ok: false, detalle: 'la cantidad debe ser mayor que 0' }

  const porUnidad = !producto.sale_mode || producto.sale_mode === 'unit'
  const decimales = porUnidad ? 0 : Math.max(0, Math.min(3, Math.trunc(Number(producto.qty_decimals) || 0)))
  const factor = 10 ** decimales
  if (Math.abs(Math.round(n * factor) - n * factor) > 1e-6) {
    return {
      ok: false,
      detalle: decimales === 0 ? 'este producto se vende por unidades enteras' : `admite hasta ${decimales} decimales`,
    }
  }
  const minimo = Number(producto.min_sale_qty)
  if (!porUnidad && Number.isFinite(minimo) && minimo > 0 && n < minimo) {
    return { ok: false, detalle: `la cantidad mínima es ${minimo}` }
  }
  return { ok: true, cantidad: Math.round(n * factor) / factor }
}

// ─── 3. Modificadores ───────────────────────────────────────────────────────────────────────

/** Modificador con precio tal como se guarda en la línea (mismo formato que el carrito). */
export interface ModificadorElegido {
  groupId: number
  groupName: string
  modifierId: number
  name: string
  extraPrice: number
}

/** Modificador antiguo (`variant_types`): sin precio, solo descriptivo. */
export interface ModificadorSinPrecio {
  typeId: unknown
  typeName: unknown
  valueId: unknown
  valueName: unknown
}

export type ResultadoModificadores =
  | { ok: true; elegidos: ModificadorElegido[]; sinPrecio: ModificadorSinPrecio[]; extras: number }
  | { ok: false; detalle: string }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Separa lo que manda el carrito en modificadores con precio (los que traen `modifierId`, vengan
 * en `newModifiers` —MenuView— o en `modifiers` —ProductDetailActions—) y antiguos sin precio.
 * Los primeros se validan contra los grupos DEL PRODUCTO de la línea: el `extraPrice`, el nombre y
 * el grupo salen de la base, nunca del cliente.
 */
export function resolverModificadores(
  modifiers: unknown,
  newModifiers: unknown,
  grupos: GrupoModificadores[] | undefined,
): ResultadoModificadores {
  const entrada = [
    ...(Array.isArray(modifiers) ? modifiers : []),
    ...(Array.isArray(newModifiers) ? newModifiers : []),
  ]
  const conPrecio: Record<string, unknown>[] = []
  const sinPrecio: ModificadorSinPrecio[] = []
  for (const m of entrada) {
    if (!esObjeto(m)) return { ok: false, detalle: 'modificador ilegible' }
    if (m.modifierId !== undefined && m.modifierId !== null) conPrecio.push(m)
    else sinPrecio.push({ typeId: m.typeId, typeName: m.typeName, valueId: m.valueId, valueName: m.valueName })
  }
  if (conPrecio.length === 0) return { ok: true, elegidos: [], sinPrecio, extras: 0 }

  const porId = new Map<number, { grupo: GrupoModificadores; mod: FilaModificador }>()
  for (const grupo of grupos || []) {
    for (const mod of grupo.product_modifiers || []) {
      if (mod.is_active) porId.set(Number(mod.id), { grupo, mod })
    }
  }

  const vistos = new Set<number>()
  const porGrupo = new Map<number, number>()
  const elegidos: ModificadorElegido[] = []
  for (const m of conPrecio) {
    const id = Number(m.modifierId)
    if (!Number.isInteger(id)) return { ok: false, detalle: 'modificador ilegible' }
    const hallado = porId.get(id)
    if (!hallado) return { ok: false, detalle: `la opción «${String(m.name ?? id)}» ya no está disponible para este producto` }
    if (vistos.has(id)) return { ok: false, detalle: `la opción «${hallado.mod.name}» está repetida` }
    vistos.add(id)
    const { grupo, mod } = hallado
    const enGrupo = (porGrupo.get(grupo.id) || 0) + 1
    porGrupo.set(grupo.id, enGrupo)
    const maximo = grupo.selection_mode === 'single' ? 1 : grupo.max_selections
    if (maximo !== null && maximo !== undefined && enGrupo > Number(maximo)) {
      return { ok: false, detalle: `«${grupo.name}» admite como máximo ${maximo} opción(es)` }
    }
    const extra = Number(mod.extra_price)
    elegidos.push({
      groupId: Number(grupo.id),
      groupName: grupo.name,
      modifierId: id,
      name: mod.name,
      extraPrice: Number.isFinite(extra) && extra > 0 ? extra : 0,
    })
  }
  const extras = elegidos.reduce((s, e) => s + e.extraPrice, 0)
  return { ok: true, elegidos, sinPrecio, extras }
}

// ─── 4. Línea completa ──────────────────────────────────────────────────────────────────────

/** Línea tal como la manda el checkout. Todo es `unknown`: viene del navegador. */
export interface LineaCliente {
  id?: unknown
  productId?: unknown
  lineId?: unknown
  name?: unknown
  price?: unknown
  quantity?: unknown
  sku?: unknown
  modifiers?: unknown
  newModifiers?: unknown
  notes?: unknown
}

export interface LineaResuelta {
  /** Posición en el array del cliente (el checkout lo usa para actualizar su carrito). */
  indice: number
  lineId: string | number | null
  productId: number
  nombre: string
  sku: string | null
  cantidad: number
  precioBase: number
  extras: number
  /** Precio unitario que se cobra: base + extras. */
  precioUnitario: number
  origenPrecio: OrigenPrecio
  modificadores: ModificadorElegido[]
  modificadoresSinPrecio: ModificadorSinPrecio[]
  notas: string | null
  /** Precio unitario que mostró el carrito (solo para detectar desfases). */
  precioCliente: number | null
  trackStock: boolean
}

export type MotivoProblema =
  | 'no_disponible'
  | 'inactivo'
  | 'sin_precio'
  | 'no_disponible_en_sede'
  | 'cantidad'
  | 'modificador'

export interface ProblemaLinea {
  indice: number
  productId: number | null
  nombre: string
  motivo: MotivoProblema
  detalle: string
}

export interface ResultadoLineas {
  lineas: LineaResuelta[]
  problemas: ProblemaLinea[]
}

/** El id del carrito puede ser compuesto (`123_4-5`); el id real viaja en `productId` o en `id`. */
export function productIdDeLinea(item: LineaCliente): number {
  const n = Number(item.productId ?? item.id)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

const redondear2 = (n: number): number => Math.round(n * 100) / 100

function texto(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/**
 * Resuelve cada línea con datos del servidor. No lanza: acumula problemas por línea para
 * devolverlos todos juntos (el cliente ve la lista completa, no el primero).
 */
export function resolverLineasPedido(
  items: LineaCliente[],
  datos: DatosPrecio,
  ctx: { organizationId: number; carta?: CartaSede | null; ahora?: Date },
): ResultadoLineas {
  const ahora = ctx.ahora ?? new Date()
  const lineas: LineaResuelta[] = []
  const problemas: ProblemaLinea[] = []

  items.forEach((item, indice) => {
    const productId = productIdDeLinea(item)
    const producto = Number.isNaN(productId) ? undefined : datos.productos.get(productId)
    const nombreCliente = texto(item.name, 200) ?? (Number.isNaN(productId) ? 'Producto' : `Producto ${productId}`)
    const problema = (motivo: MotivoProblema, detalle: string) =>
      problemas.push({ indice, productId: Number.isNaN(productId) ? null : productId, nombre: producto?.name ?? nombreCliente, motivo, detalle })

    // Existe, es de la organización del host y no está dado de baja (ni su padre).
    if (!producto || !esProductoVisibleEnWeb(producto, ctx.organizationId)) {
      problema('no_disponible', 'ya no está disponible')
      return
    }
    // Las lecturas del sitio solo muestran `status = 'active'`.
    if (producto.status !== 'active') {
      problema('inactivo', 'ya no está a la venta')
      return
    }
    const filaSede = ctx.carta?.filas.get(productId)
    if (noListadoEnSede(filaSede) || agotadoEnSede(filaSede, ahora)) {
      problema('no_disponible_en_sede', 'no está disponible en esta sede')
      return
    }
    const base = precioBaseProducto(producto, datos.precios, ctx.carta, ahora)
    if (!base) {
      problema('sin_precio', 'no tiene precio de venta')
      return
    }
    const cantidad = validarCantidad(item.quantity, producto)
    if (!cantidad.ok) {
      problema('cantidad', cantidad.detalle)
      return
    }
    const mods = resolverModificadores(item.modifiers, item.newModifiers, datos.grupos.get(productId))
    if (!mods.ok) {
      problema('modificador', mods.detalle)
      return
    }

    const precioClienteNum = Number(item.price)
    const lineId = typeof item.lineId === 'string' || typeof item.lineId === 'number' ? item.lineId : null
    lineas.push({
      indice,
      lineId,
      productId,
      nombre: producto.name ?? nombreCliente,
      sku: producto.sku ?? texto(item.sku, 100),
      cantidad: cantidad.cantidad,
      precioBase: base.precio,
      extras: mods.extras,
      precioUnitario: redondear2(base.precio + mods.extras),
      origenPrecio: base.origen,
      modificadores: mods.elegidos,
      modificadoresSinPrecio: mods.sinPrecio,
      notas: texto(item.notes),
      precioCliente: item.price === undefined || item.price === null || !Number.isFinite(precioClienteNum) ? null : precioClienteNum,
      trackStock: producto.track_stock === true,
    })
  })

  return { lineas, problemas }
}

// ─── 5. Desfases y subtotal ─────────────────────────────────────────────────────────────────

/**
 * Diferencia de precio unitario a partir de la cual se considera que el cliente vio otro precio.
 * Medio centavo: absorbe el ruido de coma flotante y nada más. Cualquier cambio real de precio
 * (subió, bajó, cambió un extra) se le muestra al cliente antes de cobrar.
 */
export const UMBRAL_DESFASE_UNITARIO = 0.005

export interface DesfasePrecio {
  indice: number
  lineId: string | number | null
  productId: number
  nombre: string
  precioAnterior: number | null
  precioNuevo: number
}

export function desfasesDePrecio(lineas: LineaResuelta[], umbral = UMBRAL_DESFASE_UNITARIO): DesfasePrecio[] {
  return lineas
    .filter((l) => l.precioCliente === null || Math.abs(l.precioCliente - l.precioUnitario) > umbral)
    .map((l) => ({
      indice: l.indice,
      lineId: l.lineId,
      productId: l.productId,
      nombre: l.nombre,
      precioAnterior: l.precioCliente,
      precioNuevo: l.precioUnitario,
    }))
}

/** Subtotal del pedido con precios del servidor (Σ precio unitario × cantidad). */
export function subtotalDeLineas(lineas: Pick<LineaResuelta, 'precioUnitario' | 'cantidad'>[]): number {
  return redondear2(lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0))
}
