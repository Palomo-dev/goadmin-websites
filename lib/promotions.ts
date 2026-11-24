/**
 * Motor de promociones automáticas del escaparate web.
 *
 * Espejo del motor puro del ERP (`src/lib/promotions/motorPromociones.ts`,
 * canal `web`), para que el cliente vea en el carrito/checkout exactamente el
 * mismo descuento que luego calcula el POS. Mantener ambos alineados: mismos
 * valores de `promotion_type`, `applies_to` y `rule_type`, y la misma cuenta
 * de cantidad mínima, compra mínima, repetición cada N y paquetes. La cantidad mínima es
 * solo `min_quantity`. Vacía es sin mínimo: `buy_quantity` no se usa
 * para deducirla. Compra X Lleva Y no la mira. El redondeo de aquí sigue
 * siendo a pesos enteros; el del ERP, a centavos.
 *
 * Dos capas:
 *  - `calculatePromotions(...)`: pura, sin BD. Recibe promociones ya cargadas y
 *    los items con su `category_id` / `parent_product_id` resueltos.
 *  - `evaluateCartPromotions(...)`: carga promociones y productos desde Supabase
 *    y delega en la anterior. Es la que usan `/api/promotions/check` y
 *    `/api/orders` (recalcula en servidor: el descuento del cliente no se confía).
 */

import {
  calcularDescuentoVolumen,
  compararCompetidoras,
  grupoDeLinea,
  modoConteo,
  normalizarEscalones,
  precioConEscalon,
  promocionHabilitadaParaCliente,
  promocionRequiereCliente,
  reglaMarcaCoincide,
  siguienteEscalon,
  type ClientePromocion,
  type FilaEscalon,
} from './promociones/precioVolumen'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type PromotionType = 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle' | 'free_shipping' | 'volume_tiers'
export type PromotionAppliesTo = 'all' | 'categories' | 'products' | 'brands'
export type PromotionRuleType =
  | 'include_product' | 'exclude_product'
  | 'include_category' | 'exclude_category'
  | 'include_brand' | 'exclude_brand'

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const JS_DAY_TO_WEEKDAY: WeekDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export interface PromotionRule {
  id?: string
  rule_type: PromotionRuleType | string
  product_id: number | null
  category_id: number | null
  /** Unidades de este producto en un paquete. Nulo = 1. */
  quantity?: number | null
  /** Regla de marca: `products.brand`. Nulo = regla antigua por `product_id`. */
  brand?: string | null
  /** Precio por volumen con `product_group`: grupo de conteo. */
  tier_group?: number | null
}

export interface PromotionRow {
  id: string
  name: string
  description: string | null
  promotion_type: PromotionType | string
  discount_value: number | string | null
  buy_quantity: number | string | null
  get_quantity: number | null
  min_purchase_amount: number | string | null
  /** `eligible` = líneas de la promo. `cart` = toda la cuenta. Nulo = se deriva. */
  min_purchase_scope?: string | null
  /** Unidades mínimas de las líneas que entran. Solo porcentaje, monto fijo y paquete. */
  min_quantity?: number | string | null
  /**
   * Repite el descuento cada N unidades. Nulo = el comportamiento de siempre:
   * porcentaje sobre todas las unidades, monto fijo una vez, paquete sin tope.
   */
  repeat_every_quantity?: number | string | null
  max_discount_amount: number | string | null
  applies_to: PromotionAppliesTo | string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_limit: number | null
  usage_count: number | null
  is_combinable: boolean | null
  priority: number | null
  /** Desempate cuando el descuento y la prioridad coinciden: gana la MÁS RECIENTE. */
  created_at?: string | null
  branches: number[] | null
  applies_to_web: boolean | null
  /** ERP 20261028180000: métodos con los que aplica. NULL/[]/ausente = cualquier método. */
  payment_method_codes?: string[] | null
  applicable_days: WeekDay[] | string[] | null
  /** `HH:mm` o `HH:mm:ss` en la zona del negocio. Nulo = todo el día. */
  start_time?: string | null
  end_time?: string | null
  /**
   * ERP 20261120180000: franjas semanales {desde_dia, desde_hora, hasta_dia,
   * hasta_hora} que pueden cruzar días. Con lista no vacía manda sobre
   * `applicable_days` + `start_time`/`end_time`. Llega con el `select('*')`.
   */
  schedule_windows?: unknown
  /** Precio del paquete. Si es mayor que cero, manda sobre el porcentaje. */
  bundle_price?: number | string | null
  /** ERP 20261124200000: precio por volumen (`precioVolumen.ts`, compartido con el POS). */
  tiers_count_mode?: string | null
  promotion_tiers?: FilaEscalon[] | null
  /** Solo clientes de este segmento del CRM (con sesión, verificado en el servidor). */
  customer_segment_id?: string | null
  /** Máximo de pedidos por cliente (con sesión). */
  usage_limit_per_customer?: number | string | null
  promotion_rules?: PromotionRule[] | null
  rules?: PromotionRule[] | null
}

/** Línea del carrito tal como la mandan drawer/checkout/orders. */
export interface PromoCartItem {
  /** Id de línea. Puede ser compuesto (`123_4-5`) cuando hay modificadores. */
  id: number | string
  /** Id real del producto cuando `id` es compuesto. */
  productId?: number | null
  name: string
  price: number
  quantity: number
  /**
   * La línea no recibe promoción y no cuenta para mínimos, paquetes,
   * «lleve X» ni «cada N». El POS la marca al quitar la promoción.
   */
  promo_excluded?: boolean | null
}

/** Línea ya enriquecida con los datos del producto necesarios para las reglas. */
export interface ResolvedPromoItem extends PromoCartItem {
  product_id: number
  parent_product_id: number | null
  category_id: number | null
  /** `products.brand` (reglas de marca). */
  brand?: string | null
}

export interface AppliedPromotion {
  id: string
  name: string
  description: string | null
  promotion_type: string
  discount_value: number
  /** Monto total descontado por esta promoción (entero, en la moneda base). */
  discount: number
  /** Nombres de las líneas afectadas (para mostrar). */
  affectedItems: string[]
  /** Ids de línea de carrito afectados (para pintar el badge en cada item). */
  affectedItemIds: Array<number | string>
  /**
   * Lo que esta promoción descontó en cada línea (id de línea → monto). Con él `/api/orders`
   * registra unidades y ahorro del pedido en `sale_promotions` (ERP 20261125090000).
   */
  perItem?: Record<string, number>
}

/**
 * Precio por volumen de una línea, para pintar «$ 9.500 c/u» y el empujón «Agrega 6 más y cada una
 * te queda en $ 8.800». Solo informativo: el descuento que cuenta es `itemDiscounts`.
 */
export interface VolumeHint {
  promotionId: string
  promotionName: string
  /** Unidades contadas para el escalón (según el modo de conteo). */
  units: number
  /** Precio por unidad con el escalón alcanzado (o el precio normal si no alcanza ninguno). */
  unitPrice: number
  /** Siguiente escalón: unidades que faltan y precio por unidad que quedaría. */
  next: { missing: number; unitPrice: number } | null
}

/**
 * «Compra X lleva Y» de una línea a la que le faltan unidades para la siguiente unidad gratis, para
 * pintar el empujón «Agrega 1 más y llévala gratis (2×1)». Solo informativo: no cambia el cobro.
 */
export interface FreeUnitHint {
  promotionId: string
  promotionName: string
  /** Unidades que faltan (sumadas a la línea) para la siguiente unidad gratis. */
  missing: number
  /** Unidades gratis que se ganan al sumarlas. */
  freeUnits: number
  /** Etiqueta «2×1», «3×2» (llevas tantas, pagas tantas). */
  label: string
}

export interface PromotionEvaluation {
  promotions: AppliedPromotion[]
  totalDiscount: number
  /** Descuento acumulado por id de línea de carrito (string). */
  itemDiscounts: Record<string, number>
  /** Precio por volumen por id de línea (opcional: respuestas viejas no lo traen). */
  volumeHints?: Record<string, VolumeHint>
  /** Empujón de «compra X lleva Y» por id de línea (opcional: respuestas viejas no lo traen). */
  freeHints?: Record<string, FreeUnitHint>
}

const EMPTY: PromotionEvaluation = { promotions: [], totalDiscount: 0, itemDiscounts: {} }

// ── Utilidades ───────────────────────────────────────────────────────────────

export function realProductId(item: PromoCartItem): number {
  if (item.productId != null && Number.isFinite(Number(item.productId))) return Number(item.productId)
  if (typeof item.id === 'number') return item.id
  // `123_4-5` → 123 ; `123` → 123
  const head = String(item.id).split(/[_:-]/)[0]
  return Number(head)
}

/**
 * Unidades gratis de «compra X lleva Y».
 * Si Y < X, la etiqueta es «XxY» (llevas X, pagas Y): de cada X, X−Y de regalo.
 * Si Y ≥ X, Y son unidades gratis además de las X que se pagan.
 * Misma regla que `unidadesGratisCompraLleva` del ERP.
 */
export function unidadesGratisCompraLleva(unidades: number, compra: number, lleva: number): number {
  const n = Math.floor(unidades)
  const x = Math.trunc(compra)
  const y = Math.trunc(lleva)
  if (n <= 0 || x <= 0 || y <= 0) return 0
  if (y < x) return Math.floor(n / x) * (x - y)
  return Math.floor(n / (x + y)) * y
}

function horaEnZona(date: Date, timeZone = 'America/Bogota'): string {
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone,
    }).formatToParts(date)
    const tomar = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '00'
    return `${tomar('hour')}:${tomar('minute')}:${tomar('second')}`
  } catch {
    return '00:00:00'
  }
}

function horaNormalizada(valor: string | null | undefined): string | null {
  if (valor == null || valor === '') return null
  const m = String(valor).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const hh = m[1].padStart(2, '0')
  const mm = m[2]
  const ss = (m[3] ?? '00').padStart(2, '0')
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null
  return `${hh}:${mm}:${ss}`
}

// ── Horario semanal (espejo de `vigencia.ts` del ERP) ───────────────────────
//
// Dos formas de guardar el horario (ERP, migración 20261120180000):
//   1. `applicable_days` + UNA franja diaria `start_time`/`end_time`. Si el fin
//      es anterior al inicio, cruza la medianoche y la madrugada cuenta como el
//      día en que empezó. Extremos incluidos al segundo (02:00:00 aplica).
//   2. `schedule_windows`: franjas semanales que pueden cruzar días
//      («sábado 16:00 → domingo 14:00»), fin EXCLUSIVO (a las 14:00 ya no).
//      Si trae una lista no vacía, manda ella.
// Las dos se reducen a tramos [inicio, fin) en segundos desde el lunes 00:00
// (hora de pared de la zona del negocio). Una ocurrencia pertenece al DÍA EN
// QUE EMPEZÓ frente a `end_date`: si la promoción vence el sábado, la de
// sábado 16:00 → domingo 14:00 sigue completa el domingo.
// Mismas funciones y mismos nombres que en el ERP: `tramosSemanalesDe`,
// `vigenteEnHorario`. Si cambias una, cambia la otra.

const SEGUNDOS_DIA = 24 * 60 * 60
const SEGUNDOS_SEMANA = 7 * SEGUNDOS_DIA
const DIAS_DESDE_LUNES: readonly WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Una franja de `promotions.schedule_windows`. */
export interface FranjaSemanal {
  desde_dia: WeekDay
  desde_hora: string
  hasta_dia: WeekDay
  hasta_hora: string
}

/** [inicio, fin) en segundos desde el lunes 00:00; `fin` puede pasar del domingo. */
export type TramoSemanal = readonly [number, number]

interface HorarioPromocion {
  applicable_days?: unknown
  start_time?: string | null
  end_time?: string | null
  schedule_windows?: unknown
}

function segundosDeHora(valor: unknown): number | null {
  const hora = horaNormalizada(valor == null ? null : String(valor))
  if (!hora) return null
  const [hh, mm, ss] = hora.split(':').map((parte) => Number(parte))
  return hh * 3600 + mm * 60 + ss
}

function indiceDia(dia: unknown): number {
  return DIAS_DESDE_LUNES.indexOf(dia as WeekDay)
}

function tramoDeFranja(f: FranjaSemanal): TramoSemanal {
  const inicio = indiceDia(f.desde_dia) * SEGUNDOS_DIA + (segundosDeHora(f.desde_hora) ?? 0)
  const fin = indiceDia(f.hasta_dia) * SEGUNDOS_DIA + (segundosDeHora(f.hasta_hora) ?? 0)
  const duracion = (((fin - inicio) % SEGUNDOS_SEMANA) + SEGUNDOS_SEMANA) % SEGUNDOS_SEMANA
  return [inicio, inicio + duracion]
}

/** Franja legible (días en inglés, `HH:mm`, duración > 0) o null. */
export function franjaSemanalValida(valor: unknown): FranjaSemanal | null {
  if (!valor || typeof valor !== 'object') return null
  const f = valor as Record<string, unknown>
  if (indiceDia(f.desde_dia) < 0 || indiceDia(f.hasta_dia) < 0) return null
  const desde = horaNormalizada(f.desde_hora == null ? null : String(f.desde_hora))
  const hasta = horaNormalizada(f.hasta_hora == null ? null : String(f.hasta_hora))
  if (!desde || !hasta) return null
  const franja: FranjaSemanal = { desde_dia: f.desde_dia as WeekDay, desde_hora: desde.slice(0, 5), hasta_dia: f.hasta_dia as WeekDay, hasta_hora: hasta.slice(0, 5) }
  const [a, b] = tramoDeFranja(franja)
  return b - a > 0 ? franja : null
}

/** null = esquema de siempre. Lista con solo franjas ilegibles = nunca activa. */
export function franjasSemanalesDe(valor: unknown): FranjaSemanal[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null
  return valor.map(franjaSemanalValida).filter((f): f is FranjaSemanal => f !== null)
}

/** Tramos semanales de la promoción, venga del esquema que venga. */
export function tramosSemanalesDe(p: HorarioPromocion): TramoSemanal[] {
  const franjas = franjasSemanalesDe(p.schedule_windows)
  if (franjas) return franjas.map(tramoDeFranja)
  const ini = segundosDeHora(p.start_time)
  const fin = segundosDeHora(p.end_time)
  let desde: number
  let hasta: number
  if (ini == null && fin == null) { desde = 0; hasta = SEGUNDOS_DIA }
  else if (ini != null && fin == null) { desde = ini; hasta = SEGUNDOS_DIA }
  else if (ini == null && fin != null) { desde = 0; hasta = fin + 1 }
  else if (ini! <= fin!) { desde = ini!; hasta = fin! + 1 }
  else { desde = ini!; hasta = SEGUNDOS_DIA + fin! + 1 }
  const dias = Array.isArray(p.applicable_days) && p.applicable_days.length > 0 ? (p.applicable_days as string[]) : null
  return DIAS_DESDE_LUNES
    .map((dia, i) => [dia, i] as const)
    .filter(([dia]) => !dias || dias.includes(dia))
    .map(([, i]) => [i * SEGUNDOS_DIA + desde, i * SEGUNDOS_DIA + hasta] as TramoSemanal)
}

/** `end_date` nulo = no vence; ilegible = vencida. */
function dentroDeFechaFin(endDate: unknown, instante: Date): boolean {
  if (endDate === null || endDate === undefined || endDate === '') return true
  const limite = new Date(String(endDate)).getTime()
  if (!Number.isFinite(limite)) return false
  return limite >= instante.getTime()
}

/**
 * ¿Está dentro de su horario semanal y, contando la cola de la franja, no ha
 * vencido? Igual que `vigenteEnHorario` del ERP. `start_date` va aparte.
 */
export function vigenteEnHorario(p: HorarioPromocion & { end_date?: unknown }, date: Date, timeZone = 'America/Bogota'): boolean {
  const hora = horaEnZona(date, timeZone)
  const desdeMedianoche = segundosDeHora(hora) ?? 0
  const s = indiceDia(weekdayInTimezone(date, timeZone)) * SEGUNDOS_DIA + desdeMedianoche
  let vigente = false
  for (const [a, b] of tramosSemanalesDe(p)) {
    // `s + semana`: la cola de un tramo que pasó del domingo cae en el lunes siguiente.
    for (const m of [s, s + SEGUNDOS_SEMANA]) {
      if (!(a <= m && m < b)) continue
      const diasDesdeInicio = Math.floor(m / SEGUNDOS_DIA) - Math.floor(a / SEGUNDOS_DIA)
      if (diasDesdeInicio <= 0) {
        if (dentroDeFechaFin(p.end_date, date)) vigente = true
      } else {
        // Último instante (23:59:59) del día en que empezó la ocurrencia.
        const atras = (desdeMedianoche + 1 + (diasDesdeInicio - 1) * SEGUNDOS_DIA) * 1000 + date.getUTCMilliseconds()
        if (dentroDeFechaFin(p.end_date, new Date(date.getTime() - atras))) vigente = true
      }
    }
  }
  return vigente
}

/** Día de la semana en la zona horaria del negocio (por defecto Colombia). */
export function weekdayInTimezone(date: Date, timeZone = 'America/Bogota'): WeekDay {
  try {
    const name = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(date).toLowerCase()
    if ((JS_DAY_TO_WEEKDAY as string[]).includes(name)) return name as WeekDay
  } catch { /* zona inválida: caer al día local */ }
  return JS_DAY_TO_WEEKDAY[date.getDay()]
}

// Los precios del escaparate son enteros (COP); el descuento también.
const round = (n: number) => Math.round(n)

// ── Método de pago (ERP 20261028180000) ─────────────────────────────────────

/** Códigos válidos de `payment_method_codes`; null si no restringe (NULL, [], ausente). */
export function codigosMetodoPromocion(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const codigos = v.map((c) => String(c ?? '').trim()).filter(Boolean)
  return codigos.length > 0 ? codigos : null
}

/** ¿La promoción aplica con este método? Sin restricción, siempre; con restricción, solo con uno de la lista. */
export function promocionAplicaConMetodo(codigosPromocion: unknown, metodo: string | null | undefined): boolean {
  const codigos = codigosMetodoPromocion(codigosPromocion)
  if (!codigos) return true
  if (typeof metodo !== 'string' || !metodo.trim()) return false
  return codigos.includes(metodo.trim())
}

// ── Filtros de vigencia ──────────────────────────────────────────────────────

export interface PromotionFilterContext {
  branchId?: number | null
  /**
   * Método de pago elegido (código de organization_payment_methods). Una
   * promoción con `payment_method_codes` solo aplica con uno de ellos; sin
   * método elegido (drawer, /carrito) todavía no aplica. NULL = cualquiera.
   */
  paymentMethod?: string | null
  date?: Date
  timeZone?: string
  /**
   * Cliente de la SESIÓN con sus segmentos y usos, armado en el servidor
   * (`evaluateCartPromotions`). Nunca del body. Sin él, las promociones con grupo de clientes o
   * usos por cliente no aplican.
   */
  cliente?: ClientePromocion | null
}

/**
 * Deja solo las promociones aplicables al canal web en este momento/sucursal.
 * (La consulta ya filtra org, is_active, start_date y applies_to_web; aquí va
 * lo que PostgREST no puede expresar cómodo en una sola query.)
 */
export function filterActivePromotions(promos: PromotionRow[], ctx: PromotionFilterContext = {}): PromotionRow[] {
  const date = ctx.date || new Date()

  return promos.filter((p) => {
    if (!p.is_active) return false
    if (p.applies_to_web === false) return false
    if (p.start_date && new Date(p.start_date) > date) return false
    if (p.usage_limit && Number(p.usage_count || 0) >= Number(p.usage_limit)) return false
    // Días, franja diaria o franjas semanales, y `end_date` con la cola de la franja.
    if (!vigenteEnHorario(p, date, ctx.timeZone)) return false
    // `branches` jsonb: null/[] = todas las sucursales.
    if (Array.isArray(p.branches) && p.branches.length > 0) {
      if (ctx.branchId == null) return false
      if (!p.branches.map(Number).includes(Number(ctx.branchId))) return false
    }
    if (!promocionAplicaConMetodo(p.payment_method_codes, ctx.paymentMethod)) return false
    if (!promocionHabilitadaParaCliente(p, ctx.cliente)) return false
    return true
  })
}

// ── Reglas ───────────────────────────────────────────────────────────────────

/**
 * ¿La línea entra en la promoción por sus reglas? Exportada (sin cambios) para que la tienda pinte
 * los escalones de la ficha y las tarjetas con la MISMA regla que cobra (`promociones/escalonesTienda.ts`).
 */
export function itemMatchesRules(item: ResolvedPromoItem, rules: PromotionRule[], appliesTo: string): boolean {
  if (appliesTo === 'all') return true
  if (!rules || rules.length === 0) return false

  let included = false
  let excluded = false

  // Una regla sobre un producto alcanza al propio producto y, si el ítem es una
  // variante, a su padre (promocionar "Camiseta" cubre "Camiseta XL").
  const matchesProduct = (ruleProductId: number | null) =>
    ruleProductId != null &&
    (ruleProductId === item.product_id || ruleProductId === item.parent_product_id)

  for (const rule of rules) {
    switch (rule.rule_type) {
      case 'include_product':
        if (matchesProduct(rule.product_id)) included = true
        break
      case 'include_brand': // por `brand` si la trae; si no, vía producto (igual que en el ERP)
        if (reglaMarcaCoincide(rule, item)) included = true
        break
      case 'exclude_product':
        if (matchesProduct(rule.product_id)) excluded = true
        break
      case 'exclude_brand':
        if (reglaMarcaCoincide(rule, item)) excluded = true
        break
      case 'include_category':
        if (rule.category_id != null && item.category_id === rule.category_id) included = true
        break
      case 'exclude_category':
        if (rule.category_id != null && item.category_id === rule.category_id) excluded = true
        break
    }
  }

  const hasIncludeRules = rules.some((r) => String(r.rule_type).startsWith('include_'))
  if (hasIncludeRules) return included && !excluded
  // Solo reglas de exclusión: todo salvo lo excluido.
  return !excluded
}

function rulesOf(p: PromotionRow): PromotionRule[] {
  // PostgREST embebe con el nombre de la tabla (`promotion_rules`).
  return (p.promotion_rules ?? p.rules ?? []) as PromotionRule[]
}

function positiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Toda la cuenta si la promo es general o el alcance es `cart`. Si no, las líneas que entran. */
function purchaseScope(p: PromotionRow): 'eligible' | 'cart' {
  if (p.min_purchase_scope === 'cart' || p.min_purchase_scope === 'eligible') return p.min_purchase_scope
  return p.applies_to === 'all' ? 'cart' : 'eligible'
}

function eligibleUnits(items: ResolvedPromoItem[]): number {
  return items.reduce((s, i) => s + Number(i.quantity), 0)
}

/**
 * Porcentaje, monto fijo y paquete. Solo `min_quantity`. Vacía es sin
 * mínimo. Compra X Lleva Y devuelve null. Igual que el POS.
 */
function cantidadMinimaEfectiva(p: PromotionRow): number | null {
  const tipo = String(p.promotion_type)
  if (tipo !== 'percentage' && tipo !== 'fixed_amount' && tipo !== 'bundle') return null
  return positiveInt(p.min_quantity)
}

function bundleRequirements(promo: PromotionRow): Array<{ productId: number; perPackage: number }> {
  const map = new Map<number, number>()
  for (const r of rulesOf(promo)) {
    if (r.rule_type !== 'include_product' || r.product_id == null) continue
    const q = positiveInt(r.quantity) ?? 1
    map.set(r.product_id, Math.max(map.get(r.product_id) ?? 0, q))
  }
  return Array.from(map.entries()).map(([productId, perPackage]) => ({ productId, perPackage }))
}

function assignBundle(item: ResolvedPromoItem, reqs: Array<{ productId: number }>): number | null {
  if (reqs.some((r) => r.productId === item.product_id)) return item.product_id
  if (item.parent_product_id != null && reqs.some((r) => r.productId === item.parent_product_id)) {
    return item.parent_product_id
  }
  return null
}

/** Reparte un entero en proporción. La última entrada absorbe el redondeo. */
function splitAmount(amount: number, weights: Array<{ key: string; weight: number }>): Record<string, number> {
  const out: Record<string, number> = {}
  const sum = weights.reduce((s, w) => s + w.weight, 0)
  if (!(amount > 0) || !(sum > 0)) return out
  let acc = 0
  weights.forEach((w, i) => {
    const part = i === weights.length - 1 ? amount - acc : round((amount * w.weight) / sum)
    if (part > 0) out[w.key] = (out[w.key] || 0) + part
    acc += part > 0 ? part : 0
  })
  return out
}

// ── Cálculo por promoción ────────────────────────────────────────────────────

/** Precio por volumen de las líneas que entran en la promoción (mismo cálculo que el POS). */
function calcularVolumen(promo: PromotionRow, items: ResolvedPromoItem[]) {
  const modo = modoConteo(promo.tiers_count_mode)
  const reglas = rulesOf(promo)
  return calcularDescuentoVolumen(
    normalizarEscalones(promo.promotion_tiers),
    items.map((i) => ({
      producto: i.product_id,
      padre: i.parent_product_id,
      cantidad: Number(i.quantity),
      precio: Number(i.price),
      grupo: modo === 'product_group' ? grupoDeLinea(reglas, i.product_id, i.parent_product_id) : null,
    })),
    modo,
  )
}

interface PromoDiscountResult {
  discount: number
  perItem: Record<string, number> // id de línea → monto
}

function calculatePromotionDiscount(promo: PromotionRow, items: ResolvedPromoItem[]): PromoDiscountResult {
  const perItem: Record<string, number> = {}
  let total = 0
  const add = (item: ResolvedPromoItem, amount: number) => {
    const d = round(amount)
    if (d <= 0) return
    const key = String(item.id)
    perItem[key] = (perItem[key] || 0) + d
    total += d
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const value = Number(promo.discount_value || 0)

  switch (promo.promotion_type) {
    case 'percentage': {
      const pct = value / 100
      const every = positiveInt(promo.repeat_every_quantity)
      if (every == null) {
        for (const item of items) add(item, item.price * item.quantity * pct)
      } else {
        let left = Math.floor(eligibleUnits(items) / every) * every
        for (const item of items) {
          if (left <= 0) break
          const take = Math.min(Number(item.quantity), left)
          add(item, take * item.price * pct)
          left -= take
        }
      }
      break
    }
    case 'fixed_amount': {
      // Un monto, o floor(unidades/N) veces ese monto, repartido entre las
      // líneas que entran y nunca más que su subtotal.
      const every = positiveInt(promo.repeat_every_quantity)
      let amount = value
      if (every != null) {
        const groups = Math.floor(eligibleUnits(items) / every)
        amount = groups > 0 ? groups * value : 0
      }
      if (subtotal > 0 && amount > 0) {
        const capped = Math.min(amount, subtotal)
        for (const item of items) add(item, capped * ((item.price * item.quantity) / subtotal))
      }
      break
    }
    case 'buy_x_get_y': {
      // Misma regla que el ERP: Y < X regala X−Y por cada X; si no, Y gratis por cada X+Y.
      const buyQty = Number(promo.buy_quantity || 0)
      const getQty = Number(promo.get_quantity || 0)
      if (buyQty > 0 && getQty > 0) {
        const byProduct = new Map<number, ResolvedPromoItem[]>()
        for (const item of items) {
          const arr = byProduct.get(item.product_id) || []
          arr.push(item)
          byProduct.set(item.product_id, arr)
        }
        for (const group of byProduct.values()) {
          const totalQty = group.reduce((s, i) => s + i.quantity, 0)
          let remainingFree = unidadesGratisCompraLleva(totalQty, buyQty, getQty)
          if (remainingFree <= 0) continue
          for (const item of [...group].sort((a, b) => a.price - b.price)) {
            if (remainingFree <= 0) break
            const free = Math.min(remainingFree, item.quantity)
            add(item, free * item.price)
            remainingFree -= free
          }
        }
      }
      break
    }
    case 'bundle': {
      const precio = Number(promo.bundle_price || 0)
      const reqs = bundleRequirements(promo)
      if (precio > 0 && reqs.length > 0) {
        const assigned = new Map<number, ResolvedPromoItem[]>()
        for (const item of items) {
          const dest = assignBundle(item, reqs)
          if (dest == null) continue
          const arr = assigned.get(dest) || []
          arr.push(item)
          assigned.set(dest, arr)
        }
        let packages = Number.POSITIVE_INFINITY
        for (const req of reqs) {
          const qty = (assigned.get(req.productId) || []).reduce((s, i) => s + Number(i.quantity), 0)
          packages = Math.min(packages, Math.floor(qty / req.perPackage))
        }
        if (Number.isFinite(packages) && packages > 0) {
          // Con N, como máximo floor(unidades que entran / N) paquetes llevan
          // el precio. NULL no limita: todos los paquetes completos, como antes.
          const every = positiveInt(promo.repeat_every_quantity)
          if (every != null) packages = Math.min(packages, Math.floor(eligibleUnits(items) / every))
        }
        if (Number.isFinite(packages) && packages > 0) {
          const consumed: Array<{ key: string; weight: number }> = []
          for (const req of reqs) {
            let left = packages * req.perPackage
            for (const item of assigned.get(req.productId) || []) {
              if (left <= 0) break
              const take = Math.min(Number(item.quantity), left)
              const worth = take * Number(item.price)
              if (worth > 0) consumed.push({ key: String(item.id), weight: worth })
              left -= take
            }
          }
          const worth = consumed.reduce((s, c) => s + c.weight, 0)
          const discount = round(worth - packages * precio)
          if (discount > 0) {
            const parts = splitAmount(discount, consumed)
            for (const item of items) {
              const part = parts[String(item.id)]
              if (part > 0) add(item, part)
            }
          }
        }
      } else if (!(precio > 0) && value > 0) {
        // Sin precio de paquete es un porcentaje, con la misma repetición.
        const pct = value / 100
        const every = positiveInt(promo.repeat_every_quantity)
        if (every == null) {
          for (const item of items) add(item, item.price * item.quantity * pct)
        } else {
          let left = Math.floor(eligibleUnits(items) / every) * every
          for (const item of items) {
            if (left <= 0) break
            const take = Math.min(Number(item.quantity), left)
            add(item, take * item.price * pct)
            left -= take
          }
        }
      }
      break
    }
    case 'volume_tiers': {
      // Precio por volumen: el módulo compartido con el POS (`promociones/precioVolumen.ts`)
      // decide el escalón de cada línea; aquí solo se redondea a pesos con `add`.
      const r = calcularVolumen(promo, items)
      items.forEach((item, k) => add(item, r.porLinea[k]))
      break
    }
    // 'free_shipping' no descuenta productos; se ignora aquí.
  }

  // Tope de descuento, repartido proporcionalmente.
  const cap = Number(promo.max_discount_amount || 0)
  if (cap > 0 && total > cap) {
    const ratio = cap / total
    let acc = 0
    const keys = Object.keys(perItem)
    keys.forEach((k, idx) => {
      // El último absorbe el redondeo para que la suma sea exactamente el tope.
      perItem[k] = idx === keys.length - 1 ? cap - acc : round(perItem[k] * ratio)
      acc += perItem[k]
    })
    total = cap
  }

  return { discount: total, perItem }
}

// ── Exclusividad por líneas que se solapan ──────────────────────────────────
// Misma regla que `evaluarPromociones` del ERP. Una promoción de cuenta
// (`applies_to = all` o compra mínima sobre toda la cuenta) toca todas las
// líneas y compite como antes. Dos no combinables sobre productos distintos
// no se pisan y se aplican las dos. Dentro de un grupo, gana la de mayor
// prioridad; empate, la que más descuenta; sigue el empate, la MÁS RECIENTE.

interface CalculoWeb {
  promo: PromotionRow
  applicable: ResolvedPromoItem[]
  discount: number
  perItem: Record<string, number>
  grupo: string[]
}

function esDeCuenta(p: PromotionRow): boolean {
  return p.applies_to === 'all' || purchaseScope(p) === 'cart'
}

function seCruzanIds(a: string[], b: string[]): boolean {
  const menor = a.length <= b.length ? a : b
  const mayor = new Set(a.length <= b.length ? b : a)
  return menor.some((id) => mayor.has(id))
}

function componentesWeb(calculos: CalculoWeb[]): CalculoWeb[][] {
  const n = calculos.length
  const padre = Array.from({ length: n }, (_, i) => i)
  const encontrar = (i: number): number => {
    let x = i
    while (padre[x] !== x) {
      padre[x] = padre[padre[x]]
      x = padre[x]
    }
    return x
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!seCruzanIds(calculos[i].grupo, calculos[j].grupo)) continue
      const ra = encontrar(i)
      const rb = encontrar(j)
      if (ra !== rb) padre[rb] = ra
    }
  }
  const grupos = new Map<number, CalculoWeb[]>()
  calculos.forEach((c, i) => {
    const r = encontrar(i)
    const arr = grupos.get(r) ?? []
    arr.push(c)
    grupos.set(r, arr)
  })
  return Array.from(grupos.values())
}

// Prioridad, luego la que más ahorra y, con el MISMO ahorro, la MÁS RECIENTE: la misma función
// del POS (`compararCompetidoras` de `promociones/precioVolumen.ts`, idéntico byte a byte).
function compararCompetidorasWeb(a: CalculoWeb, b: CalculoWeb): number {
  return compararCompetidoras(a.promo, a.discount, b.promo, b.discount)
}

function elegirEnComponenteWeb(grupo: CalculoWeb[]): CalculoWeb[] {
  const combinables = grupo.filter((c) => !!c.promo.is_combinable)
  const exclusivas = grupo.filter((c) => !c.promo.is_combinable).sort(compararCompetidorasWeb)
  const suma = combinables.reduce((s, c) => s + c.discount, 0)
  const mejor = exclusivas[0] ?? null
  if (mejor && mejor.discount >= suma) return [mejor]
  return combinables
}

// ── Evaluación (pura) ────────────────────────────────────────────────────────

export interface CalculateOptions extends PromotionFilterContext {
  /** Si ya se filtró vigencia fuera, poner `false` para no repetir. */
  applyFilters?: boolean
}

export function calculatePromotions(
  promotionsInput: PromotionRow[],
  items: ResolvedPromoItem[],
  opts: CalculateOptions = {},
): PromotionEvaluation {
  if (!items.length || !promotionsInput.length) return EMPTY

  const promotions = opts.applyFilters === false ? promotionsInput : filterActivePromotions(promotionsInput, opts)
  // Una línea excluida no entra: ni descuento, ni mínimos, ni paquetes, ni «lleve X», ni «cada N».
  const vivos = items.filter((i) => i.promo_excluded !== true && Number(i.quantity) > 0 && Number(i.price) >= 0)
  const cartSubtotal = vivos.reduce((s, i) => s + i.price * i.quantity, 0)
  const idsVivos = vivos.map((i) => String(i.id))

  const passesGates = (p: PromotionRow, applicable: ResolvedPromoItem[]): boolean => {
    const minMoney = Number(p.min_purchase_amount || 0)
    if (minMoney > 0) {
      const base = purchaseScope(p) === 'cart'
        ? cartSubtotal
        : applicable.reduce((s, i) => s + i.price * i.quantity, 0)
      if (base < minMoney) return false
    }
    const minQty = cantidadMinimaEfectiva(p)
    if (minQty != null && eligibleUnits(applicable) < minQty) return false
    return true
  }

  const listos: CalculoWeb[] = []
  for (const p of promotions) {
    const applicable = vivos.filter((i) => itemMatchesRules(i, rulesOf(p), p.applies_to))
    if (!applicable.length || !passesGates(p, applicable)) continue
    const res = calculatePromotionDiscount(p, applicable)
    if (!(res.discount > 0)) continue
    listos.push({
      promo: p,
      applicable,
      discount: res.discount,
      perItem: res.perItem,
      grupo: esDeCuenta(p) ? idsVivos : applicable.map((i) => String(i.id)),
    })
  }

  const toApply = componentesWeb(listos).flatMap(elegirEnComponenteWeb)

  const applied: AppliedPromotion[] = []
  const itemDiscounts: Record<string, number> = {}
  let totalDiscount = 0

  for (const res of toApply) {
    if (res.discount <= 0) continue
    for (const [k, amt] of Object.entries(res.perItem)) itemDiscounts[k] = (itemDiscounts[k] || 0) + amt
    totalDiscount += res.discount
    applied.push({
      id: res.promo.id,
      name: res.promo.name,
      description: res.promo.description ?? null,
      promotion_type: String(res.promo.promotion_type),
      discount_value: Number(res.promo.discount_value || 0),
      discount: res.discount,
      affectedItems: res.applicable.map((i) => i.name),
      affectedItemIds: res.applicable.map((i) => i.id),
      perItem: { ...res.perItem },
    })
  }

  // Nunca descontar más que el subtotal del carrito.
  if (totalDiscount > cartSubtotal) totalDiscount = cartSubtotal

  const volumeHints = pistasVolumen(promotions, vivos)
  // Pistas: solo texto del carrito. Sin pistas, la respuesta de siempre (sin claves nuevas).
  const freeHints = pistasCompraLleva(promotions, vivos, cartSubtotal)
  return {
    promotions: applied,
    totalDiscount,
    itemDiscounts,
    ...(Object.keys(volumeHints).length > 0 ? { volumeHints } : {}),
    ...(Object.keys(freeHints).length > 0 ? { freeHints } : {}),
  }
}

/**
 * Empujón de «compra X lleva Y» por línea: cuántas unidades le faltan al producto para la
 * siguiente unidad gratis (misma regla `unidadesGratisCompraLleva` y mismo agrupado por producto
 * que el cobro). Solo dentro del ciclo en curso: con el ciclo completo (2 en un 2×1) no empuja.
 *
 * Para no prometer de más, la unidad gratis se comprueba con el cálculo real de la promoción
 * (`calculatePromotionDiscount`) sumando esas unidades a la línea: si el tope de descuento ya se
 * alcanzó, no hay pista; con compra mínima, solo si al sumarlas se alcanza. No mira exclusividad:
 * el carrito la pinta solo si la promoción es la aplicada a la línea o la línea no tiene otra.
 */
function pistasCompraLleva(promotions: PromotionRow[], vivos: ResolvedPromoItem[], cartSubtotal: number): Record<string, FreeUnitHint> {
  const out: Record<string, FreeUnitHint> = {}
  for (const p of promotions) {
    if (p.promotion_type !== 'buy_x_get_y') continue
    const compra = positiveInt(p.buy_quantity)
    const lleva = positiveInt(p.get_quantity)
    if (compra == null || lleva == null) continue
    const applicable = vivos.filter((i) => itemMatchesRules(i, rulesOf(p), p.applies_to))
    if (applicable.length === 0) continue
    const ciclo = lleva < compra ? compra : compra + lleva
    const label = lleva < compra ? `${compra}×${lleva}` : `${compra + lleva}×${compra}`
    const minMoney = Number(p.min_purchase_amount || 0)
    const baseCompra = purchaseScope(p) === 'cart' ? cartSubtotal : applicable.reduce((s, i) => s + i.price * i.quantity, 0)
    const descuentoHoy = calculatePromotionDiscount(p, applicable).discount

    const porProducto = new Map<number, ResolvedPromoItem[]>()
    for (const item of applicable) {
      const arr = porProducto.get(item.product_id) || []
      arr.push(item)
      porProducto.set(item.product_id, arr)
    }
    for (const grupo of porProducto.values()) {
      const unidades = grupo.reduce((s, i) => s + Number(i.quantity), 0)
      const gratisHoy = unidadesGratisCompraLleva(unidades, compra, lleva)
      const destino = grupo[0]
      for (let k = 1; k < ciclo; k++) {
        const ganadas = unidadesGratisCompraLleva(unidades + k, compra, lleva) - gratisHoy
        if (ganadas <= 0) continue
        if (minMoney > 0 && baseCompra + Number(destino.price) * k < minMoney) break
        const conMas = applicable.map((i) => (i === destino ? { ...i, quantity: Number(i.quantity) + k } : i))
        if (!(calculatePromotionDiscount(p, conMas).discount > descuentoHoy)) break
        for (const item of grupo) {
          const key = String(item.id)
          if (!out[key]) out[key] = { promotionId: p.id, promotionName: p.name, missing: k, freeUnits: ganadas, label }
        }
        break
      }
    }
  }
  return out
}

/**
 * Pistas de precio por volumen por línea (la primera promoción `volume_tiers` vigente que la
 * alcanza): precio por unidad con el escalón y el siguiente escalón. No mira compra mínima ni
 * exclusividad: es el texto del carrito, no el cobro.
 */
function pistasVolumen(promotions: PromotionRow[], vivos: ResolvedPromoItem[]): Record<string, VolumeHint> {
  const out: Record<string, VolumeHint> = {}
  for (const p of promotions) {
    if (p.promotion_type !== 'volume_tiers') continue
    const escalones = normalizarEscalones(p.promotion_tiers)
    if (escalones.length === 0) continue
    const applicable = vivos.filter((i) => itemMatchesRules(i, rulesOf(p), p.applies_to))
    if (applicable.length === 0) continue
    const r = calcularVolumen(p, applicable)
    applicable.forEach((item, k) => {
      const key = String(item.id)
      if (out[key]) return
      if (modoConteo(p.tiers_count_mode) === 'product_group' && r.unidadesPorLinea[k] === 0) return
      const sig = siguienteEscalon(escalones, r.unidadesPorLinea[k])
      out[key] = {
        promotionId: p.id,
        promotionName: p.name,
        units: r.unidadesPorLinea[k],
        unitPrice: round(precioConEscalon(Number(item.price), r.escalonPorLinea[k])),
        next: sig ? { missing: sig.faltan, unitPrice: round(precioConEscalon(Number(item.price), sig.escalon)) } : null,
      }
    })
  }
  return out
}

// ── Evaluación con BD ────────────────────────────────────────────────────────

export interface EvaluateCartInput {
  organizationId: number
  /**
   * Cliente de la SESIÓN (`getAuthCustomer` del host), nunca del body ni el que se busca por
   * correo para un invitado. Con él se leen sus segmentos y usos; sin él, las promociones «solo
   * para el grupo …» y con usos por cliente no aplican.
   */
  sessionCustomerId?: string | null
  branchId?: number | null
  /** Método de pago elegido (ver PromotionFilterContext.paymentMethod). */
  paymentMethod?: string | null
  items: PromoCartItem[]
  date?: Date
  timeZone?: string
}

/**
 * Carga promociones web vigentes de la organización y los datos de producto
 * (categoría / padre) de las líneas, y calcula el descuento.
 * `supabase` es un cliente de servidor (admin o público).
 */
export async function evaluateCartPromotions(supabase: any, input: EvaluateCartInput): Promise<PromotionEvaluation> {
  const { organizationId, branchId, items, paymentMethod } = input
  if (!organizationId || !Array.isArray(items) || items.length === 0) return EMPTY

  const cleanItems: PromoCartItem[] = items
    .filter((i) => i && Number(i.quantity) > 0)
    .map((i) => ({
      id: i.id,
      productId: i.productId ?? null,
      name: String(i.name ?? ''),
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
      ...(i.promo_excluded === true ? { promo_excluded: true as const } : {}),
    }))
  if (cleanItems.length === 0) return EMPTY

  const now = (input.date || new Date()).toISOString()
  const { data: promos, error } = await supabase
    .from('promotions')
    .select('*, promotion_rules(id, rule_type, product_id, category_id, quantity, brand, tier_group), promotion_tiers(min_quantity, unit_price, discount_percent, sort_order)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('applies_to_web', true)
    .lte('start_date', now)

  if (error) {
    console.error('[Promotions] Error cargando promociones:', error)
    return EMPTY
  }
  if (!promos || promos.length === 0) return EMPTY

  // Resolver categoría y padre de cada producto (el carrito no los guarda).
  const productIds = Array.from(new Set(cleanItems.map(realProductId).filter((n) => Number.isFinite(n))))
  const productMap = new Map<number, { category_id: number | null; parent_product_id: number | null; brand: string | null }>()
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, category_id, parent_product_id, brand')
      .eq('organization_id', organizationId)
      .in('id', productIds)
    for (const p of products || []) {
      productMap.set(Number(p.id), { category_id: p.category_id ?? null, parent_product_id: p.parent_product_id ?? null, brand: p.brand ?? null })
    }
  }

  const resolved: ResolvedPromoItem[] = cleanItems.map((i) => {
    const pid = realProductId(i)
    const meta = productMap.get(pid)
    return { ...i, product_id: pid, category_id: meta?.category_id ?? null, parent_product_id: meta?.parent_product_id ?? null, brand: meta?.brand ?? null }
  })

  const cliente = await cargarClienteSesion(supabase, organizationId, input.sessionCustomerId ?? null, promos as PromotionRow[])
  return calculatePromotions(promos as PromotionRow[], resolved, { branchId, paymentMethod, date: input.date, timeZone: input.timeZone, cliente })
}

/**
 * Segmentos y usos del cliente de la sesión, solo si alguna promoción los mira. Sin sesión:
 * null (esas promociones no aplican). Si la lectura falla: sin segmentos (el grupo no aplica,
 * falla cerrado) y usos en 0.
 */
export async function cargarClienteSesion(
  supabase: any,
  organizationId: number,
  customerId: string | null,
  promos: PromotionRow[],
): Promise<ClientePromocion | null> {
  if (!customerId) return null
  const conCliente = promos.filter((p) => promocionRequiereCliente(p))
  if (conCliente.length === 0) return { id: customerId, segmentos: [], usos: {} }
  const segmentos = Array.from(new Set(conCliente.map((p) => p.customer_segment_id).filter((s): s is string => !!s)))
  const conLimite = conCliente.filter((p) => p.usage_limit_per_customer != null).map((p) => p.id)
  try {
    const [seg, usos] = await Promise.all([
      segmentos.length > 0
        ? supabase.from('segment_members').select('segment_id')
            .eq('organization_id', organizationId).eq('customer_id', customerId).in('segment_id', segmentos)
        : Promise.resolve({ data: [], error: null }),
      conLimite.length > 0
        ? supabase.from('promotion_customer_uses').select('promotion_id, uses')
            .eq('organization_id', organizationId).eq('customer_id', customerId).in('promotion_id', conLimite)
        : Promise.resolve({ data: [], error: null }),
    ])
    const filasSeg: Array<{ segment_id: string }> = seg.error ? [] : (seg.data ?? [])
    const filasUso: Array<{ promotion_id: string; uses: number }> = usos.error ? [] : (usos.data ?? [])
    return {
      id: customerId,
      segmentos: filasSeg.map((f) => String(f.segment_id)),
      usos: Object.fromEntries(filasUso.map((f) => [String(f.promotion_id), Number(f.uses) || 0])),
    }
  } catch {
    return { id: customerId, segmentos: [], usos: {} }
  }
}
