/**
 * Precio por volumen para MOSTRAR en la tienda: ficha («Compra más, paga menos», Figma «16 Sitio
 * web» S1/S1b/S2) y tarjetas de los listados («Desde 6: −14 %», S3/S4). Puro y sin base de datos.
 *
 * No calcula lo que se cobra: eso lo hace `lib/promotions.ts` en /api/promotions/check y
 * /api/orders. Aquí se usan las MISMAS piezas para que lo que se promete coincida con lo que se
 * cobra:
 *  - vigencia (fechas, horario, sede, usos): `filterActivePromotions`;
 *  - qué productos entran (producto/padre, categoría, marca, exclusiones): `itemMatchesRules`;
 *  - escalones, modo de conteo y precio por unidad: `precioVolumen.ts` (copia del POS).
 *
 * Lo que la ficha NO promete:
 *  - promociones con grupo de clientes o usos por cliente (`customer_segment_id`,
 *    `usage_limit_per_customer`): solo se sabe que existen (`requiereCliente`), sin escalones;
 *    la ficha invita a ingresar (S1b). El precio real lo verifica el servidor con la sesión.
 *  - promociones limitadas a un método de pago o con compra mínima: dependen del checkout o del
 *    resto del carrito, así que no se pintan.
 * Un dato del producto que no se conoce (`undefined`: el listado no trajo la categoría o la marca)
 * y que una regla necesita deja la promoción fuera de esa tarjeta: mejor no mostrar que prometer.
 *
 * El precio base entra por parámetro (`precioBase`): hoy el precio de la ficha o de la tarjeta;
 * mañana el de una lista de precios por cliente, que se aplica ANTES de las promociones.
 *
 * Imports relativos (no `@/`): los verify lo cargan con `--experimental-strip-types`.
 */
import { filterActivePromotions, itemMatchesRules, type PromotionRow, type PromotionRule, type ResolvedPromoItem } from '../promotions'
import {
  desempateMasReciente,
  escalonPara,
  grupoDeLinea,
  modoConteo,
  normalizarEscalones,
  normalizarMarca,
  precioConEscalon,
  promocionRequiereCliente,
  siguienteEscalon,
  type Escalon,
  type ModoConteoEscalones,
} from './precioVolumen'

/** Regla tal como viaja al navegador (solo lo que mira `itemMatchesRules` y el grupo). */
export type ReglaEscalonesTienda = Pick<PromotionRule, 'rule_type' | 'product_id' | 'category_id' | 'brand' | 'tier_group'>

/** Promoción por volumen vigente, lista para pintar. Serializable (viaja del servidor al cliente). */
export interface PromoEscalonesTienda {
  id: string
  nombre: string
  modo: ModoConteoEscalones
  /** Escalones de menor a mayor. Vacío si `requiereCliente`: sin sesión no se promete ese precio. */
  escalones: Escalon[]
  /** Solo para un grupo de clientes o con usos por cliente. */
  requiereCliente: boolean
  appliesTo: string
  reglas: ReglaEscalonesTienda[]
  /** `end_date` (timestamptz) o null. */
  fin: string | null
}

export interface ContextoEscalonesTienda {
  /** Sede del pedido web (la misma regla que /api/promotions/check). */
  branchId?: number | null
  date?: Date
  timeZone?: string
}

const round = (n: number) => Math.round(n)

/**
 * Promociones `volume_tiers` vigentes ahora en la sede, sin método de pago (la ficha no lo
 * conoce) y sin mirar al cliente: las que lo exigen quedan marcadas `requiereCliente` y sin
 * escalones. Orden: mayor prioridad primero; empate, la más antigua (como el motor al competir).
 */
export function prepararEscalonesTienda(filas: readonly PromotionRow[] | null | undefined, ctx: ContextoEscalonesTienda = {}): PromoEscalonesTienda[] {
  const porVolumen = (filas ?? []).filter((p) => p && p.promotion_type === 'volume_tiers')
  if (porVolumen.length === 0) return []
  // Vigencia sin el filtro de cliente (se marca aparte) y sin método de pago: una promoción
  // limitada a un método no pasa (`paymentMethod: null`), y así debe ser en la ficha.
  const vigentes = new Set(
    filterActivePromotions(
      porVolumen.map((p) => ({ ...p, customer_segment_id: null, usage_limit_per_customer: null })),
      { branchId: ctx.branchId ?? null, date: ctx.date, timeZone: ctx.timeZone, paymentMethod: null, cliente: null },
    ).map((p) => p.id),
  )
  return porVolumen
    .filter((p) => vigentes.has(p.id))
    // Con compra mínima depende del resto del carrito: no se promete en la ficha.
    .filter((p) => !(Number(p.min_purchase_amount || 0) > 0))
    // Mismo orden que el desempate del cobro: prioridad y, empatadas, la MÁS RECIENTE.
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || desempateMasReciente(a, b))
    .map((p): PromoEscalonesTienda => {
      const requiereCliente = promocionRequiereCliente(p)
      const reglas = (p.promotion_rules ?? p.rules ?? []).map((r) => ({
        rule_type: r.rule_type,
        product_id: r.product_id ?? null,
        category_id: r.category_id ?? null,
        brand: r.brand ?? null,
        tier_group: r.tier_group ?? null,
      }))
      return {
        id: p.id,
        nombre: p.name,
        modo: modoConteo(p.tiers_count_mode),
        escalones: requiereCliente ? [] : normalizarEscalones(p.promotion_tiers),
        requiereCliente,
        appliesTo: String(p.applies_to ?? 'all'),
        reglas,
        fin: p.end_date ?? null,
      }
    })
    .filter((p) => p.requiereCliente || p.escalones.length > 0)
}

/**
 * Producto que se quiere pintar. `undefined` = el listado no trajo ese dato (desconocido);
 * `null` = no tiene (sin padre, sin categoría, sin marca).
 */
export interface ProductoEscalones {
  id: number
  parent_product_id?: number | null
  category_id?: number | null
  brand?: string | null
}

/** ¿La promoción alcanza el producto? null = no se puede saber con los datos que hay. */
export function promoAlcanzaProducto(p: Pick<PromoEscalonesTienda, 'appliesTo' | 'reglas' | 'modo'>, prod: ProductoEscalones): boolean | null {
  const id = Number(prod.id)
  if (!Number.isFinite(id)) return null
  const reglas = p.reglas as PromotionRule[]
  if (p.appliesTo !== 'all') {
    const usaCategoria = reglas.some((r) => String(r.rule_type).endsWith('_category'))
    const usaMarca = reglas.some((r) => String(r.rule_type).endsWith('_brand') && !!normalizarMarca(r.brand))
    const usaPadre = reglas.some((r) => String(r.rule_type).endsWith('_product') || (String(r.rule_type).endsWith('_brand') && !normalizarMarca(r.brand)))
    if (usaCategoria && prod.category_id === undefined) return null
    if (usaMarca && prod.brand === undefined) return null
    if (usaPadre && prod.parent_product_id === undefined) return null
  }
  const item: ResolvedPromoItem = {
    id,
    name: '',
    price: 0,
    quantity: 1,
    product_id: id,
    parent_product_id: prod.parent_product_id ?? null,
    category_id: prod.category_id ?? null,
    brand: prod.brand ?? null,
  }
  if (!itemMatchesRules(item, reglas, p.appliesTo)) return false
  // `product_group`: una línea sin grupo no recibe precio por volumen (igual que el motor).
  if (p.modo === 'product_group' && grupoDeLinea(p.reglas, id, prod.parent_product_id ?? null) == null) return false
  return true
}

/** Lo que la tienda sabe del precio por volumen de un producto. */
export interface VolumenProducto {
  promoId: string
  nombre: string
  modo: ModoConteoEscalones
  escalones: Escalon[]
  /** Hay una promoción por volumen solo para clientes identificados (S1b: «Ingresa para verlos»). */
  requiereCliente: boolean
  fin: string | null
}

/**
 * La promoción por volumen que se pinta para un producto: la primera (por prioridad) con escalones
 * que lo alcanza. Si solo lo alcanza una que exige cliente, se devuelve marcada y sin escalones.
 */
export function escalonesParaProducto(promos: readonly PromoEscalonesTienda[] | null | undefined, prod: ProductoEscalones): VolumenProducto | null {
  let soloCliente: PromoEscalonesTienda | null = null
  for (const p of promos ?? []) {
    if (promoAlcanzaProducto(p, prod) !== true) continue
    if (p.requiereCliente) {
      soloCliente ??= p
      continue
    }
    return { promoId: p.id, nombre: p.nombre, modo: p.modo, escalones: p.escalones, requiereCliente: false, fin: p.fin }
  }
  return soloCliente
    ? { promoId: soloCliente.id, nombre: soloCliente.nombre, modo: soloCliente.modo, escalones: [], requiereCliente: true, fin: soloCliente.fin }
    : null
}

// ── Vista ────────────────────────────────────────────────────────────────────────────────────────

export interface FilaEscalonVista {
  desde: number
  /** Última unidad del tramo; null = «o más». */
  hasta: number | null
  /** Precio por unidad en pesos enteros. */
  precio: number
  /** Ahorro frente al precio base, en % entero. */
  ahorroPct: number
  /** Tramo sin escalón (precio normal). */
  esBase: boolean
}

function pct(base: number, precio: number): number {
  return base > 0 ? Math.max(0, round(((base - precio) / base) * 100)) : 0
}

/** Filas de la tabla «1 a 5 unidades / 6 a 11 / 12 o más». */
export function filasEscalones(escalones: readonly Escalon[], precioBase: number): FilaEscalonVista[] {
  const base = Math.max(0, Number(precioBase) || 0)
  const filas: FilaEscalonVista[] = []
  if (escalones.length === 0) return filas
  if (escalones[0].desde > 1) filas.push({ desde: 1, hasta: escalones[0].desde - 1, precio: round(base), ahorroPct: 0, esBase: true })
  escalones.forEach((e, i) => {
    const precio = round(precioConEscalon(base, e))
    filas.push({ desde: e.desde, hasta: i + 1 < escalones.length ? escalones[i + 1].desde - 1 : null, precio, ahorroPct: pct(base, precio), esBase: false })
  })
  return filas
}

/** Etiqueta de una fila: «1 a 5 unidades», «12 o más», «6 unidades». */
export function etiquetaFila(f: Pick<FilaEscalonVista, 'desde' | 'hasta'>, corta = false): string {
  const u = corta ? ' u.' : ' unidades'
  if (f.hasta == null) return `${f.desde} o más${corta ? ' u.' : ''}`
  if (f.hasta === f.desde) return `${f.desde}${f.desde === 1 ? (corta ? ' u.' : ' unidad') : u}`
  return `${f.desde} a ${f.hasta}${u}`
}

export interface CotizacionCantidad {
  cantidad: number
  /** Precio por unidad con el escalón alcanzado (o el base). */
  unitario: number
  total: number
  /** Frente a `cantidad × precioBase`. */
  ahorro: number
  ahorroPct: number
  escalon: Escalon | null
  siguiente: { faltan: number; unitario: number; desde: number } | null
}

/**
 * Precio de `cantidad` unidades de ESTE producto con los escalones. Cuenta solo estas unidades:
 * lo que ya está en el carrito (o, con `promotion_mix`, otros sabores) puede bajarlo más, y eso lo
 * dice el carrito con el cálculo del servidor.
 */
export function cotizarCantidad(escalones: readonly Escalon[], precioBase: number, cantidad: number): CotizacionCantidad {
  const base = Math.max(0, Number(precioBase) || 0)
  const q = Math.max(1, Math.floor(Number(cantidad) || 1))
  const escalon = escalonPara(escalones, q)
  const unitario = round(precioConEscalon(base, escalon))
  const total = unitario * q
  const normal = round(base) * q
  const sig = siguienteEscalon(escalones, q)
  return {
    cantidad: q,
    unitario,
    total,
    ahorro: Math.max(0, normal - total),
    ahorroPct: pct(base, unitario),
    escalon,
    siguiente: sig ? { faltan: sig.faltan, unitario: round(precioConEscalon(base, sig.escalon)), desde: sig.escalon.desde } : null,
  }
}

/** Lo que dice el botón de compra cuando la cantidad elegida cae en un escalón (S1/S2). */
export interface BotonVolumen {
  cantidad: number
  /** Precio por unidad con el escalón. */
  unitario: number
  /** `cantidad × unitario`: el «Total» de la ficha. */
  total: number
  /** Frente a `cantidad × precioBase`. */
  ahorro: number
}

/**
 * «Agregar 6 al carrito · $ 57.000»: la cantidad y el total con el precio del escalón (la misma
 * `cotizarCantidad` del «Total» de la ficha). null fuera de escalón, sin escalones que bajen el
 * precio o si la promoción es solo para un grupo de clientes: el botón de siempre.
 */
export function botonConVolumen(volumen: Pick<VolumenProducto, 'escalones' | 'requiereCliente'> | null | undefined, precioBase: number | null | undefined, cantidad: number): BotonVolumen | null {
  if (!volumen || volumen.requiereCliente || volumen.escalones.length === 0) return null
  const base = Number(precioBase)
  if (!(base > 0)) return null
  const cot = cotizarCantidad(volumen.escalones, base, cantidad)
  if (!cot.escalon || !(cot.unitario < round(base))) return null
  return { cantidad: cot.cantidad, unitario: cot.unitario, total: cot.total, ahorro: cot.ahorro }
}

/**
 * Mete la cantidad en el texto del botón: «Agregar al carrito» → «Agregar 6 al carrito»,
 * «Agregar» → «Agregar 6». Un texto propio que no empieza por «Agregar» queda igual (el total va
 * después, con `textoBotonConPrecio`).
 */
export function textoAgregarConCantidad(texto: string, cantidad: number): string {
  const n = Math.max(1, Math.floor(Number(cantidad) || 1))
  return texto.replace(/^(\s*agregar)(?=\s|$)/i, `$1 ${n}`)
}

/** Resumen para la tarjeta: el primer escalón que ahorra algo («Desde 6: −14 %», «6 o más: $ 9.500 c/u»). */
export function resumenTarjeta(escalones: readonly Escalon[], precioBase: number): { desde: number; unitario: number; ahorroPct: number } | null {
  const base = Math.max(0, Number(precioBase) || 0)
  if (!(base > 0)) return null
  for (const e of escalones) {
    const unitario = round(precioConEscalon(base, e))
    if (unitario < round(base)) return { desde: e.desde, unitario, ahorroPct: pct(base, unitario) }
  }
  return null
}

/** Cómo cuentan las unidades, en palabras de cliente (lista de beneficios de la ficha). */
export function textoModoConteo(modo: ModoConteoEscalones): string {
  switch (modo) {
    case 'same_product':
      return 'Los escalones cuentan las unidades de este producto: sus variantes suman juntas.'
    case 'same_variant':
      return 'Los escalones cuentan las unidades de la misma referencia.'
    case 'product_group':
      return 'Los escalones cuentan las unidades de los productos de su grupo en la promoción.'
    default:
      return 'Los escalones cuentan unidades de toda la promoción: puedes mezclar productos.'
  }
}
