/**
 * Etiquetas de las promociones REALES en la tienda: «2 X 1», «−20 %», «−$ 5.000», «Combo» en las
 * tarjetas y en la ficha (Figma «16 Sitio web» 3036:78040), y lo que se explica al tocarlas (B).
 * Puro y sin base de datos: lo usan el servidor (lectura cacheada por organización), el navegador
 * (en memoria, por producto) y `scripts/verify-etiquetas-ficha.mjs`.
 *
 * Mismo criterio que `escalonesTienda.ts` (precio por volumen), con las MISMAS piezas del cobro
 * para que lo que se promete coincida con lo que se cobra:
 *  - vigencia (fechas, horario, sede, usos, método de pago): `filterActivePromotions`;
 *  - qué productos entran (producto/padre, categoría, marca, exclusiones): `promoAlcanzaProducto`
 *    (= `itemMatchesRules`);
 *  - el ejemplo «2 × $ 44.900 · Descuento −$ 44.900 · Pagas $ 44.900» sale de `calculatePromotions`,
 *    el motor que usan /api/promotions/check y /api/orders.
 *
 * Lo que NO se promete (mejor no mostrar que prometer):
 *  - promociones con compra mínima o limitadas a un método de pago: dependen del carrito o del
 *    checkout;
 *  - promociones «solo para un grupo de clientes» o con usos por cliente, a quien no está en el
 *    grupo. Sin cliente quedan `requiereCliente` y NO viajan al navegador; con sesión, el servidor
 *    (/api/promotions/etiquetas) verifica el grupo y devuelve solo las que le aplican.
 *  - `free_shipping` (no es del producto) y `volume_tiers` (tiene su propia etiqueta y su tabla).
 *
 * Imports relativos (no `@/`): los verify lo cargan con `--experimental-strip-types`.
 */
import { calculatePromotions, filterActivePromotions, type PromotionRow, type ResolvedPromoItem } from '../promotions'
import { promoAlcanzaProducto, type ProductoEscalones, type ReglaEscalonesTienda } from './escalonesTienda'
import { promocionRequiereCliente, type ClientePromocion } from './precioVolumen'

/** Tipos de promoción con etiqueta propia en la tienda. */
export const TIPOS_PROMO_ETIQUETA = ['buy_x_get_y', 'percentage', 'fixed_amount', 'bundle'] as const
export type TipoPromoEtiqueta = (typeof TIPOS_PROMO_ETIQUETA)[number]

/** Regla tal como viaja al navegador: la del volumen más la cantidad de un combo. */
export type ReglaPromoEtiqueta = ReglaEscalonesTienda & { quantity?: number | null }

/** Promoción vigente, lista para pintar. Serializable (viaja del servidor al cliente). */
export interface PromoEtiquetaTienda {
  id: string
  tipo: TipoPromoEtiqueta
  /** `discount_value`: % o monto según el tipo. */
  valor: number
  /** Compra X Lleva Y. */
  compra: number
  lleva: number
  /** Precio del combo (`bundle_price`); 0 = combo por porcentaje. */
  precioCombo: number
  minCantidad: number | null
  cadaN: number | null
  tope: number | null
  prioridad: number
  creada: string | null
  appliesTo: string
  reglas: ReglaPromoEtiqueta[]
  /** `end_date` (timestamptz) o null. */
  fin: string | null
  /** Solo para un grupo de clientes o con usos por cliente (verificado en el servidor). */
  requiereCliente: boolean
}

export interface ContextoEtiquetasPromo {
  branchId?: number | null
  date?: Date
  timeZone?: string
  /**
   * Cliente de la SESIÓN armado en el servidor. Con él, las promociones que lo exigen se filtran
   * de verdad (grupo y usos). Sin él, se marcan `requiereCliente`.
   */
  cliente?: ClientePromocion | null
}

function entero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n > 0 ? n : null
}

function numero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function fecha(v: string | null | undefined): number {
  const t = v ? new Date(v).getTime() : NaN
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

function esTipo(v: unknown): v is TipoPromoEtiqueta {
  return typeof v === 'string' && (TIPOS_PROMO_ETIQUETA as readonly string[]).includes(v)
}

/** ¿La fila trae lo necesario para decir algo cierto? */
function tieneValor(p: PromotionRow): boolean {
  switch (p.promotion_type) {
    case 'buy_x_get_y':
      return (entero(p.buy_quantity) ?? 0) > 0 && (entero(p.get_quantity) ?? 0) > 0
    case 'percentage':
    case 'fixed_amount':
      return numero(p.discount_value) > 0
    case 'bundle':
      return (numero(p.bundle_price) > 0 || numero(p.discount_value) > 0)
        && (p.promotion_rules ?? p.rules ?? []).some((r) => r.rule_type === 'include_product' && r.product_id != null)
    default:
      return false
  }
}

/**
 * Promociones con etiqueta vigentes ahora en la sede, sin método de pago (la tienda no lo conoce
 * hasta el checkout). Sin `cliente`, las que lo exigen quedan marcadas `requiereCliente`; con él,
 * solo pasan las que le aplican. Orden: mayor prioridad primero; empate, la más antigua.
 */
export function prepararEtiquetasPromo(filas: readonly PromotionRow[] | null | undefined, ctx: ContextoEtiquetasPromo = {}): PromoEtiquetaTienda[] {
  const candidatas = (filas ?? []).filter((p) => p && esTipo(p.promotion_type) && tieneValor(p))
  if (candidatas.length === 0) return []
  const conCliente = ctx.cliente != null
  const vigentes = new Set(
    filterActivePromotions(
      conCliente ? [...candidatas] : candidatas.map((p) => ({ ...p, customer_segment_id: null, usage_limit_per_customer: null })),
      { branchId: ctx.branchId ?? null, date: ctx.date, timeZone: ctx.timeZone, paymentMethod: null, cliente: ctx.cliente ?? null },
    ).map((p) => p.id),
  )
  return candidatas
    .filter((p) => vigentes.has(p.id))
    // Con compra mínima depende del resto del carrito: no se promete.
    .filter((p) => !(numero(p.min_purchase_amount) > 0))
    .sort((a, b) => numero(b.priority) - numero(a.priority) || fecha(a.created_at) - fecha(b.created_at))
    .map((p): PromoEtiquetaTienda => ({
      id: String(p.id),
      tipo: p.promotion_type as TipoPromoEtiqueta,
      valor: numero(p.discount_value),
      compra: entero(p.buy_quantity) ?? 0,
      lleva: entero(p.get_quantity) ?? 0,
      precioCombo: Math.max(0, numero(p.bundle_price)),
      minCantidad: entero(p.min_quantity),
      cadaN: entero(p.repeat_every_quantity),
      tope: numero(p.max_discount_amount) > 0 ? numero(p.max_discount_amount) : null,
      prioridad: numero(p.priority),
      creada: p.created_at ?? null,
      appliesTo: String(p.applies_to ?? 'all'),
      reglas: (p.promotion_rules ?? p.rules ?? []).map((r) => ({
        rule_type: r.rule_type,
        product_id: r.product_id ?? null,
        category_id: r.category_id ?? null,
        brand: r.brand ?? null,
        tier_group: r.tier_group ?? null,
        quantity: r.quantity ?? null,
      })),
      fin: p.end_date ?? null,
      requiereCliente: promocionRequiereCliente(p),
    }))
}

/** Lo que viaja a TODOS los navegadores: sin las de grupo de clientes, más un aviso de que existen. */
export function separarPublicas(promos: readonly PromoEtiquetaTienda[]): { publicas: PromoEtiquetaTienda[]; hayDeCliente: boolean } {
  return {
    publicas: promos.filter((p) => !p.requiereCliente),
    hayDeCliente: promos.some((p) => p.requiereCliente),
  }
}

/** Ordena como el motor al competir: prioridad, luego la más antigua. */
export function ordenarPromos(promos: readonly PromoEtiquetaTienda[]): PromoEtiquetaTienda[] {
  return [...promos].sort((a, b) => b.prioridad - a.prioridad || fecha(a.creada) - fecha(b.creada))
}

/** La promoción con etiqueta de un producto: la primera (por prioridad) que lo alcanza. */
export function promoParaProducto(promos: readonly PromoEtiquetaTienda[] | null | undefined, prod: ProductoEscalones): PromoEtiquetaTienda | null {
  for (const p of promos ?? []) {
    if (promoAlcanzaProducto({ appliesTo: p.appliesTo, reglas: p.reglas, modo: 'promotion_mix' }, prod) === true) return p
  }
  return null
}

// ── Texto ────────────────────────────────────────────────────────────────────────────────────────

/** «Lleva X, paga Y» con la misma regla del cobro (`unidadesGratisCompraLleva`). */
export function llevaPaga(compra: number, lleva: number): { lleva: number; paga: number } {
  // Y < X: «XxY» (llevas X, pagas Y). Y ≥ X: Y gratis además de las X que se pagan.
  return lleva < compra ? { lleva: compra, paga: lleva } : { lleva: compra + lleva, paga: compra }
}

function pct(v: number): string {
  const r = Math.round(v * 100) / 100
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
}

export type Formatear = (n: number) => string

/** Texto de la etiqueta: «2 X 1», «−20 %», «Desde 3: −10 %», «−$ 5.000», «Combo». */
export function textoEtiquetaPromo(p: PromoEtiquetaTienda, formatear: Formatear): string {
  const desde = p.minCantidad != null && p.minCantidad > 1 ? `Desde ${p.minCantidad}: ` : ''
  switch (p.tipo) {
    case 'buy_x_get_y': {
      const { lleva, paga } = llevaPaga(p.compra, p.lleva)
      return `${lleva} X ${paga}`
    }
    case 'percentage':
      return `${desde}−${pct(p.valor)} %`
    case 'fixed_amount':
      return `${desde}−${formatear(p.valor)}`
    case 'bundle':
      return p.precioCombo > 0 ? 'Combo' : `Combo −${pct(p.valor)} %`
  }
}

export interface LineaEjemplo {
  etiqueta: string
  valor: string
  tipo: 'normal' | 'descuento' | 'total'
}

export interface ExplicacionPromo {
  /** «2 X 1» (lo mismo que la etiqueta). */
  etiqueta: string
  /** «Lleva 2, paga 1». */
  titulo: string
  /** «Agrega 2 al carrito y pagas solo 1. El descuento se ve en el carrito y al pagar.» */
  texto: string
  /** Cuenta de ejemplo con el motor del cobro; null si depende de otros productos. */
  ejemplo: LineaEjemplo[] | null
  /** Unidades del ejemplo (botón «Llevar 2 · $ 44.900»); null sin ejemplo. */
  cantidad: number | null
  /** Total del ejemplo. */
  total: number | null
  /** Notas cortas (tope, repetición, grupo de clientes). */
  notas: string[]
}

/** Fila mínima para el motor, con los datos de la promoción ya preparada. */
function filaMotor(p: PromoEtiquetaTienda): PromotionRow {
  return {
    id: p.id,
    name: '',
    description: null,
    promotion_type: p.tipo,
    discount_value: p.valor,
    buy_quantity: p.compra,
    get_quantity: p.lleva,
    min_purchase_amount: null,
    min_quantity: p.minCantidad,
    repeat_every_quantity: p.cadaN,
    max_discount_amount: p.tope,
    applies_to: p.appliesTo,
    start_date: null,
    end_date: null,
    is_active: true,
    usage_limit: null,
    usage_count: null,
    is_combinable: true,
    priority: p.prioridad,
    branches: null,
    applies_to_web: true,
    applicable_days: null,
    bundle_price: p.precioCombo,
    promotion_rules: p.reglas.map((r) => ({ ...r, product_id: r.product_id ?? null, category_id: r.category_id ?? null })),
  }
}

/** Unidades del ejemplo, o null si la cuenta necesita otros productos (combo con varios). */
function unidadesEjemplo(p: PromoEtiquetaTienda, prod: ProductoEscalones): number | null {
  switch (p.tipo) {
    case 'buy_x_get_y':
      return llevaPaga(p.compra, p.lleva).lleva
    case 'percentage':
    case 'fixed_amount':
      return Math.max(1, p.minCantidad ?? 1, p.cadaN ?? 1)
    case 'bundle': {
      const del = p.reglas.filter((r) => r.rule_type === 'include_product' && r.product_id != null)
      const propios = del.filter((r) => Number(r.product_id) === Number(prod.id) || (prod.parent_product_id != null && Number(r.product_id) === Number(prod.parent_product_id)))
      if (del.length === 0 || propios.length !== del.length) return null
      return Math.max(...propios.map((r) => entero(r.quantity) ?? 1))
    }
  }
}

/**
 * Lo que explica la etiqueta al tocarla (B): título, texto y la cuenta de ejemplo para ESTE
 * producto a `precio`, calculada con el motor del cobro. Solo informativo: lo que se cobra lo decide
 * el servidor con el carrito completo.
 */
export function explicarPromo(p: PromoEtiquetaTienda, prod: ProductoEscalones, precio: number, formatear: Formatear): ExplicacionPromo {
  const etiqueta = textoEtiquetaPromo(p, formatear)
  const base = Math.max(0, Number(precio) || 0)
  const notas: string[] = []
  let titulo: string
  let texto: string
  const alPagar = 'El descuento se ve en el carrito y al pagar.'
  switch (p.tipo) {
    case 'buy_x_get_y': {
      const { lleva, paga } = llevaPaga(p.compra, p.lleva)
      titulo = `Lleva ${lleva}, paga ${paga}`
      texto = `Agrega ${lleva} al carrito y pagas solo ${paga}. ${alPagar}`
      notas.push('Las unidades se cuentan por referencia: misma talla y color.')
      break
    }
    case 'percentage':
      titulo = p.minCantidad != null && p.minCantidad > 1 ? `${pct(p.valor)} % menos desde ${p.minCantidad} unidades` : `${pct(p.valor)} % de descuento`
      texto = p.minCantidad != null && p.minCantidad > 1
        ? `Lleva ${p.minCantidad} o más y cada una te sale ${pct(p.valor)} % más barata. ${alPagar}`
        : `Este producto tiene ${pct(p.valor)} % de descuento. ${alPagar}`
      break
    case 'fixed_amount':
      titulo = p.minCantidad != null && p.minCantidad > 1 ? `${formatear(p.valor)} menos desde ${p.minCantidad} unidades` : `${formatear(p.valor)} de descuento`
      texto = p.minCantidad != null && p.minCantidad > 1
        ? `Lleva ${p.minCantidad} o más y te descontamos ${formatear(p.valor)}. ${alPagar}`
        : `Te descontamos ${formatear(p.valor)} en tu compra de este producto. ${alPagar}`
      break
    case 'bundle':
      titulo = p.precioCombo > 0 ? `Combo por ${formatear(p.precioCombo)}` : `Combo con ${pct(p.valor)} % de descuento`
      texto = `Este producto hace parte de un combo: agrega al carrito todo lo del combo y el precio especial se aplica solo. ${alPagar}`
      break
  }
  if (p.cadaN != null && p.cadaN > 1 && (p.tipo === 'percentage' || p.tipo === 'fixed_amount')) notas.push(`El descuento se aplica por cada ${p.cadaN} unidades.`)
  if (p.tope != null) notas.push(`Descuento máximo de ${formatear(p.tope)}.`)
  if (p.requiereCliente) notas.push('Precio especial para tu cuenta.')

  const n = unidadesEjemplo(p, prod)
  let ejemplo: LineaEjemplo[] | null = null
  let total: number | null = null
  if (n != null && base > 0) {
    const item: ResolvedPromoItem = {
      id: 'ejemplo',
      productId: prod.id,
      name: '',
      price: base,
      quantity: n,
      product_id: Number(prod.id),
      parent_product_id: prod.parent_product_id ?? null,
      category_id: prod.category_id ?? null,
      brand: prod.brand ?? null,
    }
    const r = calculatePromotions([filaMotor(p)], [item], { applyFilters: false })
    const bruto = Math.round(base) * n
    if (r.totalDiscount > 0) {
      total = bruto - r.totalDiscount
      ejemplo = [
        { etiqueta: `${n} × ${formatear(Math.round(base))}`, valor: formatear(bruto), tipo: 'normal' },
        { etiqueta: `Descuento ${etiqueta}`, valor: `−${formatear(r.totalDiscount)}`, tipo: 'descuento' },
        { etiqueta: n === 1 ? 'Pagas' : `Pagas por los ${n}`, valor: formatear(total), tipo: 'total' },
      ]
    }
  }
  if (p.tipo === 'bundle' && ejemplo) texto = `Lleva ${n} y pagas ${formatear(total ?? 0)}. ${alPagar}`
  return { etiqueta, titulo, texto, ejemplo, cantidad: ejemplo ? n : null, total, notas }
}

/** «30 de noviembre» en la zona de la organización (end_date es timestamptz). */
export function fechaFinPromo(fin: string | null | undefined, zona: string): string | null {
  if (!fin) return null
  const d = new Date(fin)
  if (!Number.isFinite(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: zona }).format(d)
  } catch {
    return null
  }
}
